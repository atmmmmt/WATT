import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as QRCode from 'qrcode';
import { ProvidersService } from '../providers/providers.service';
import { ProviderType } from '../providers/schemas/provider-account.schema';
import type {
  IncomingWhatsappMessageEvent,
  WhatsappChatHistorySnapshot,
  WhatsappMessageAckEvent,
  WhatsappMessageEditEvent,
  WhatsappSessionUpdateEvent,
} from './whatsapp-sessions.service';
import {
  WhatsappBaileysAuth,
  WhatsappBaileysAuthDocument,
} from './schemas/whatsapp-baileys-auth.schema';
import {
  WhatsappSession,
  WhatsappSessionDocument,
  WhatsappSessionStatus,
} from './schemas/whatsapp-session.schema';

type AsyncListener<T> = (event: T) => Promise<void> | void;
type BaileysModule = Record<string, any>;
type SocketLike = any;

const SESSIONS_DISABLED = String(process.env.WA_DISABLE_SESSIONS || '').toLowerCase() === 'true';
const RECONNECT_DELAYS_MS = [2_000, 5_000, 10_000, 30_000, 60_000];
const MAX_CACHED_MESSAGES_PER_TENANT = Number(process.env.WA_MESSAGE_CACHE_LIMIT || 1000);
const MAX_HISTORY_CHATS_PER_TENANT = Number(process.env.WA_HISTORY_CHAT_LIMIT || 100);
const MAX_HISTORY_MESSAGES_PER_CHAT = Number(process.env.WA_HISTORY_MESSAGE_LIMIT || 100);

@Injectable()
export class BaileysWhatsappSessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysWhatsappSessionsService.name);
  private readonly sockets = new Map<string, SocketLike>();
  private readonly starts = new Map<string, Promise<void>>();
  private readonly reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly reconnectAttempts = new Map<string, number>();
  private readonly manualStops = new Set<string>();
  private readonly jidPhoneMap = new Map<string, Map<string, string>>();
  private readonly messageCache = new Map<string, Map<string, any>>();
  private readonly history = new Map<string, Map<string, WhatsappChatHistorySnapshot>>();
  private readonly incomingMessageListeners = new Set<AsyncListener<IncomingWhatsappMessageEvent>>();
  private readonly ackListeners = new Set<AsyncListener<WhatsappMessageAckEvent>>();
  private readonly editListeners = new Set<AsyncListener<WhatsappMessageEditEvent>>();
  private readonly sessionUpdateListeners = new Set<AsyncListener<WhatsappSessionUpdateEvent>>();
  private baileysPromise?: Promise<BaileysModule>;
  private shuttingDown = false;

  private readonly baileysLogger: any = {
    level: 'silent',
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
    child: () => this.baileysLogger,
  };

  constructor(
    @InjectModel(WhatsappSession.name)
    private readonly sessionModel: Model<WhatsappSessionDocument>,
    @InjectModel(WhatsappBaileysAuth.name)
    private readonly authModel: Model<WhatsappBaileysAuthDocument>,
    private readonly providersService: ProvidersService,
  ) {}

  async onModuleInit() {
    if (SESSIONS_DISABLED) {
      this.logger.warn('WA_DISABLE_SESSIONS=true — Baileys sessions are disabled');
      return;
    }
    setTimeout(() => void this.restorePreviousSessions(), 2500).unref?.();
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.reconnectTimers.clear();
    await Promise.allSettled(
      [...this.sockets.values()].map(async (socket) => {
        try {
          socket.end?.(new Error('server shutdown'));
        } catch {
          // Preserve credentials on process shutdown.
        }
      }),
    );
    this.sockets.clear();
  }

  onIncomingMessage(listener: AsyncListener<IncomingWhatsappMessageEvent>) {
    this.incomingMessageListeners.add(listener);
    return () => this.incomingMessageListeners.delete(listener);
  }

  onMessageAck(listener: AsyncListener<WhatsappMessageAckEvent>) {
    this.ackListeners.add(listener);
    return () => this.ackListeners.delete(listener);
  }

  onMessageEdit(listener: AsyncListener<WhatsappMessageEditEvent>) {
    this.editListeners.add(listener);
    return () => this.editListeners.delete(listener);
  }

  onSessionUpdate(listener: AsyncListener<WhatsappSessionUpdateEvent>) {
    this.sessionUpdateListeners.add(listener);
    return () => this.sessionUpdateListeners.delete(listener);
  }

  async getSession(tenantId: string) {
    const session = await this.sessionModel
      .findOne({ tenantId: new Types.ObjectId(tenantId) })
      .lean();
    return (
      session || {
        tenantId,
        status: WhatsappSessionStatus.IDLE,
        qrDataUrl: null,
        sessionId: null,
        phoneNumber: null,
        displayName: null,
        lastDisconnectReason: null,
        lastReadyAt: null,
        lastActivityAt: null,
      }
    );
  }

  async getClientSessionStatus(tenantId: string) {
    const session = await this.getSession(tenantId);
    return {
      status: session.status,
      qrDataUrl: session.qrDataUrl,
      phoneNumber: session.phoneNumber,
      displayName: session.displayName,
      lastDisconnectReason: session.lastDisconnectReason,
      lastReadyAt: session.lastReadyAt,
      lastActivityAt: session.lastActivityAt,
      isConnected: session.status === WhatsappSessionStatus.READY,
      engine: 'baileys',
    };
  }

  async startSession(tenantId: string) {
    if (SESSIONS_DISABLED) {
      throw new ServiceUnavailableException(
        'WhatsApp sessions are disabled on this instance (WA_DISABLE_SESSIONS=true)',
      );
    }

    this.manualStops.delete(tenantId);
    const pendingReconnect = this.reconnectTimers.get(tenantId);
    if (pendingReconnect) {
      clearTimeout(pendingReconnect);
      this.reconnectTimers.delete(tenantId);
    }
    if (this.sockets.has(tenantId)) return this.getSession(tenantId);

    let starting = this.starts.get(tenantId);
    if (!starting) {
      starting = this.createSocket(tenantId).finally(() => this.starts.delete(tenantId));
      this.starts.set(tenantId, starting);
    }
    await starting;
    return this.getSession(tenantId);
  }

  async disconnectSession(tenantId: string) {
    this.manualStops.add(tenantId);
    const timer = this.reconnectTimers.get(tenantId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(tenantId);

    const socket = this.sockets.get(tenantId);
    this.sockets.delete(tenantId);
    if (socket) {
      try {
        await socket.logout?.();
      } catch (error) {
        this.logger.warn(
          `Baileys logout failed for ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
      try {
        socket.end?.(new Error('manual logout'));
      } catch {
        // Ignore transport teardown failures after logout.
      }
    }

    await this.deleteAuthState(tenantId);
    await this.upsertSessionAndNotify(tenantId, {
      status: WhatsappSessionStatus.DISCONNECTED,
      qrDataUrl: null,
      sessionId: null,
      phoneNumber: null,
      displayName: null,
      lastDisconnectReason: 'LOGOUT',
      lastActivityAt: new Date(),
    });
    return this.getSession(tenantId);
  }

  async purgeTenantSession(tenantId: string) {
    this.manualStops.add(tenantId);
    const timer = this.reconnectTimers.get(tenantId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(tenantId);

    const socket = this.sockets.get(tenantId);
    this.sockets.delete(tenantId);
    if (socket) {
      try {
        await socket.logout?.();
      } catch {
        // Continue tenant deletion even if WhatsApp is unreachable.
      }
      try {
        socket.end?.(new Error('tenant purged'));
      } catch {
        // Ignore transport teardown failures.
      }
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    await Promise.all([
      this.sessionModel.deleteOne({ tenantId: tenantObjectId }),
      this.authModel.deleteMany({ tenantId: tenantObjectId }),
    ]);
    this.messageCache.delete(tenantId);
    this.history.delete(tenantId);
    this.jidPhoneMap.delete(tenantId);
  }

  async sendOtpMessage(
    tenantId: string,
    phoneNumber: string,
    code: string,
    minutes: number,
  ) {
    const message = `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة ${minutes} دقيقة`;
    const result = await this.sendMessageToTarget(tenantId, phoneNumber, { text: message });
    return {
      providerType: ProviderType.WHATSAPP_WEB,
      providerMessageId: result.providerMessageId,
    };
  }

  async sendTextMessage(
    tenantId: string,
    chatIdOrPhone: string,
    message: string,
    options?: { quotedMessageId?: string },
  ) {
    const result = await this.sendMessageToTarget(
      tenantId,
      chatIdOrPhone,
      { text: message },
      options,
    );
    return {
      providerType: ProviderType.WHATSAPP_WEB,
      providerMessageId: result.providerMessageId,
    };
  }

  async sendMediaMessage(
    tenantId: string,
    chatIdOrPhone: string,
    base64Data: string,
    mimetype: string,
    filename: string,
    caption?: string,
  ) {
    const buffer = Buffer.from(base64Data, 'base64');
    let content: Record<string, unknown>;
    if (mimetype.startsWith('image/')) {
      content = { image: buffer, mimetype, caption: caption || undefined };
    } else if (mimetype.startsWith('video/')) {
      content = { video: buffer, mimetype, caption: caption || undefined };
    } else if (mimetype.startsWith('audio/')) {
      content = { audio: buffer, mimetype, ptt: /ogg|opus/i.test(mimetype) };
    } else {
      content = {
        document: buffer,
        mimetype,
        fileName: filename || 'attachment',
        caption: caption || undefined,
      };
    }

    const result = await this.sendMessageToTarget(tenantId, chatIdOrPhone, content);
    return {
      providerType: ProviderType.WHATSAPP_WEB,
      providerMessageId: result.providerMessageId,
    };
  }

  async resolveChatId(tenantId: string, phoneNumber: string) {
    const socket = await this.ensureSocketReady(tenantId);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) throw new Error('Invalid phone number');

    if (typeof socket.onWhatsApp === 'function') {
      const matches = await socket.onWhatsApp(cleanPhone);
      const match = Array.isArray(matches)
        ? matches.find((item: any) => item?.exists !== false)
        : null;
      if (!match?.jid) {
        throw new Error(`Phone number ${cleanPhone} is not registered on WhatsApp`);
      }
      return this.normalizeJid(match.jid);
    }
    return `${cleanPhone}@s.whatsapp.net`;
  }

  async resolveContactPhone(tenantId: string, whatsappChatId: string): Promise<string | null> {
    if (!whatsappChatId) return null;
    const normalized = this.normalizeJid(whatsappChatId);
    const direct = this.phoneFromJid(normalized);
    if (direct) return direct;

    const mapped = this.jidPhoneMap.get(tenantId)?.get(normalized);
    if (mapped) return mapped;

    const socket = this.sockets.get(tenantId);
    try {
      const pn = await socket?.signalRepository?.lidMapping?.getPNForLID?.(normalized);
      const phone = this.phoneFromJid(String(pn || ''));
      if (phone) {
        this.rememberJidPhone(tenantId, normalized, phone);
        return phone;
      }
    } catch {
      // Best effort: LID internals can change between WhatsApp protocol versions.
    }
    return null;
  }

  async listRecentChats(
    tenantId: string,
    options?: { chatLimit?: number; messageLimit?: number; skipScroll?: boolean },
  ): Promise<WhatsappChatHistorySnapshot[]> {
    const chatLimit = options?.chatLimit ?? 50;
    const messageLimit = options?.messageLimit ?? 25;
    return [...(this.history.get(tenantId)?.values() || [])]
      .sort((a, b) => (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0))
      .slice(0, chatLimit)
      .map((chat) => ({ ...chat, messages: chat.messages.slice(-messageLimit) }));
  }

  private async getBaileys(): Promise<BaileysModule> {
    if (!this.baileysPromise) {
      const nativeImport = new Function('specifier', 'return import(specifier)') as (
        specifier: string,
      ) => Promise<BaileysModule>;
      this.baileysPromise = nativeImport('@whiskeysockets/baileys');
    }
    return this.baileysPromise;
  }

  private async createSocket(tenantId: string) {
    const baileys = await this.getBaileys();
    const makeWASocket = baileys.makeWASocket || baileys.default;
    if (typeof makeWASocket !== 'function') {
      throw new Error('Baileys makeWASocket export was not found');
    }

    await this.upsertSessionAndNotify(tenantId, {
      status: WhatsappSessionStatus.INITIALIZING,
      qrDataUrl: null,
      lastDisconnectReason: null,
      lastActivityAt: new Date(),
    });

    await this.providersService.upsertForTenant({
      tenantId,
      providerType: ProviderType.WHATSAPP_WEB,
      status: 'active',
      config: { engine: 'baileys' },
    });

    const { state, saveCreds } = await this.loadAuthState(tenantId, baileys);
    const socket = makeWASocket({
      auth: state,
      logger: this.baileysLogger,
      browser: baileys.Browsers?.ubuntu?.('VAYRO') || ['Ubuntu', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      emitOwnEvents: true,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 30_000,
      defaultQueryTimeoutMs: 60_000,
      getMessage: async (key: any) => this.findCachedMessage(tenantId, key?.id)?.message,
    });

    this.sockets.set(tenantId, socket);
    this.registerSocketEvents(tenantId, socket, saveCreds, baileys);
  }

  private registerSocketEvents(
    tenantId: string,
    socket: SocketLike,
    saveCreds: () => Promise<void>,
    baileys: BaileysModule,
  ) {
    socket.ev.on('creds.update', () => {
      void saveCreds().catch((error) =>
        this.logger.error(
          `Failed to persist Baileys credentials for ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
        ),
      );
    });
    socket.ev.on('connection.update', (update: any) => {
      void this.handleConnectionUpdate(tenantId, socket, update, baileys);
    });
    socket.ev.on('messages.upsert', (payload: any) => {
      void this.handleMessagesUpsert(tenantId, socket, payload, baileys);
    });
    socket.ev.on('messages.update', (updates: any[]) => {
      void this.handleMessagesUpdate(tenantId, updates || []);
    });
  }

  private async handleConnectionUpdate(
    tenantId: string,
    socket: SocketLike,
    update: any,
    baileys: BaileysModule,
  ) {
    if (update.qr) {
      const qrDataUrl = await QRCode.toDataURL(update.qr, { margin: 1, width: 320 });
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.QR_READY,
        qrDataUrl,
        lastActivityAt: new Date(),
      });
    }

    if (update.connection === 'open') {
      this.reconnectAttempts.delete(tenantId);
      const rawId = String(socket.user?.id || '');
      const phoneNumber = rawId.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') || null;
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.READY,
        qrDataUrl: null,
        sessionId: rawId || null,
        phoneNumber,
        displayName: socket.user?.name || null,
        lastReadyAt: new Date(),
        lastActivityAt: new Date(),
        lastDisconnectReason: null,
      });
      this.logger.log(`Baileys connected for tenant ${tenantId}`);
      return;
    }

    if (update.connection !== 'close') return;
    this.sockets.delete(tenantId);
    const statusCode = this.extractDisconnectStatus(update.lastDisconnect?.error);
    const loggedOut = statusCode === baileys.DisconnectReason?.loggedOut;
    const reason = loggedOut ? 'LOGOUT' : `BAILEYS_${statusCode ?? 'DISCONNECTED'}`;

    await this.upsertSessionAndNotify(tenantId, {
      status: loggedOut
        ? WhatsappSessionStatus.AUTH_FAILURE
        : WhatsappSessionStatus.DISCONNECTED,
      qrDataUrl: null,
      lastDisconnectReason: reason,
      lastActivityAt: new Date(),
    });

    if (loggedOut) {
      await this.deleteAuthState(tenantId);
      this.logger.warn(`WhatsApp logged out tenant ${tenantId}; a fresh QR scan is required`);
      return;
    }
    if (!this.manualStops.has(tenantId) && !this.shuttingDown) {
      this.scheduleReconnect(tenantId, reason);
    }
  }

  private async handleMessagesUpsert(
    tenantId: string,
    socket: SocketLike,
    payload: any,
    baileys: BaileysModule,
  ) {
    const messages: any[] = Array.isArray(payload?.messages) ? payload.messages : [];
    for (const message of messages) {
      if (!message?.key?.id || !message?.message) continue;
      this.cacheMessage(tenantId, message);
      if (await this.tryHandleEditMessage(tenantId, message)) continue;

      const remoteJid = this.normalizeJid(String(message.key.remoteJid || ''));
      if (!remoteJid || this.isIgnoredJid(remoteJid)) continue;
      const altJid = this.normalizeJid(
        String(message.key.remoteJidAlt || message.key.participantAlt || ''),
      );
      let customerPhone = this.phoneFromJid(remoteJid) || this.phoneFromJid(altJid) || '';
      if (customerPhone) {
        this.rememberJidPhone(tenantId, remoteJid, customerPhone);
        if (altJid) this.rememberJidPhone(tenantId, altJid, customerPhone);
      } else {
        customerPhone = (await this.resolveContactPhone(tenantId, remoteJid)) || '';
      }

      const normalizedMessage = this.unwrapMessage(message.message);
      const body = this.extractBody(normalizedMessage);
      const mediaMeta = this.extractMediaMeta(normalizedMessage);
      const contextInfo = this.extractContextInfo(normalizedMessage);
      let mediaUrl: string | null = null;
      if (mediaMeta.hasMedia) {
        mediaUrl = await this.downloadAndStoreMedia(
          tenantId,
          socket,
          message,
          mediaMeta,
          baileys,
        );
      }

      const event: IncomingWhatsappMessageEvent = {
        tenantId,
        whatsappMessageId: String(message.key.id),
        whatsappChatId: remoteJid,
        customerPhone,
        customerName: message.pushName || null,
        profilePicture: null,
        direction: message.key.fromMe ? 'outgoing' : 'incoming',
        messageType: mediaMeta.messageType,
        body,
        mediaMimeType: mediaMeta.mimetype,
        mediaFileName: mediaMeta.fileName,
        mediaUrl,
        quotedWhatsappMessageId: contextInfo?.stanzaId || null,
        quotedBody: contextInfo?.quotedMessage
          ? this.extractBody(this.unwrapMessage(contextInfo.quotedMessage))
          : null,
        createdAt: this.messageDate(message),
      };

      this.recordHistory(event);
      await this.notifyListeners(this.incomingMessageListeners, event, 'incoming message');
    }
  }

  private async handleMessagesUpdate(tenantId: string, updates: any[]) {
    for (const item of updates) {
      const id = item?.key?.id;
      const status = item?.update?.status;
      if (!id || typeof status !== 'number') continue;
      await this.notifyListeners(
        this.ackListeners,
        {
          tenantId,
          whatsappMessageId: String(id),
          ack: this.mapBaileysAck(status),
        },
        'message ack',
      );
    }
  }

  private async tryHandleEditMessage(tenantId: string, message: any) {
    const protocol = message?.message?.protocolMessage;
    if (!protocol?.editedMessage || !protocol?.key?.id) return false;
    const edited = this.unwrapMessage(protocol.editedMessage);
    await this.notifyListeners(
      this.editListeners,
      {
        tenantId,
        whatsappMessageId: String(protocol.key.id),
        whatsappChatId:
          this.normalizeJid(String(protocol.key.remoteJid || message.key.remoteJid || '')) || null,
        newBody: this.extractBody(edited),
        prevBody: '',
        editedAt: new Date(),
      },
      'message edit',
    );
    return true;
  }

  private async sendMessageToTarget(
    tenantId: string,
    chatIdOrPhone: string,
    content: Record<string, unknown>,
    options?: { quotedMessageId?: string },
  ) {
    const socket = await this.ensureSocketReady(tenantId);
    const targetId = await this.resolveTargetJid(tenantId, socket, chatIdOrPhone);
    const quoted = options?.quotedMessageId
      ? this.findCachedMessage(tenantId, options.quotedMessageId)
      : undefined;
    const result = await socket.sendMessage(
      targetId,
      content,
      quoted ? { quoted } : undefined,
    );
    const providerMessageId = String(result?.key?.id || '');
    if (!providerMessageId) {
      throw new ServiceUnavailableException('WhatsApp accepted no message id; retry the send');
    }
    this.cacheMessage(tenantId, result);
    await this.upsertSessionAndNotify(tenantId, { lastActivityAt: new Date() });
    return { providerMessageId };
  }

  private async resolveTargetJid(tenantId: string, socket: SocketLike, value: string) {
    if (value.includes('@')) return this.normalizeJid(value);
    const cleanPhone = value.replace(/\D/g, '');
    if (!cleanPhone) throw new Error('Invalid WhatsApp recipient');
    if (typeof socket.onWhatsApp === 'function') {
      const matches = await socket.onWhatsApp(cleanPhone);
      const match = Array.isArray(matches)
        ? matches.find((item: any) => item?.exists !== false)
        : null;
      if (!match?.jid) {
        throw new Error(`Phone number ${cleanPhone} is not registered on WhatsApp`);
      }
      const jid = this.normalizeJid(match.jid);
      this.rememberJidPhone(tenantId, jid, cleanPhone);
      return jid;
    }
    return `${cleanPhone}@s.whatsapp.net`;
  }

  private async ensureSocketReady(tenantId: string, timeoutMs = 45_000) {
    if (!this.sockets.has(tenantId)) await this.startSession(tenantId);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const socket = this.sockets.get(tenantId);
      const session = await this.getSession(tenantId);
      if (socket && session.status === WhatsappSessionStatus.READY) return socket;
      if (
        session.status === WhatsappSessionStatus.QR_READY ||
        session.status === WhatsappSessionStatus.AUTH_FAILURE
      ) {
        throw new InternalServerErrorException(
          'WhatsApp session requires a fresh QR scan. Open the connection page and scan it.',
        );
      }
      await this.delay(750);
    }
    throw new InternalServerErrorException(
      'WhatsApp session is not ready yet. Wait a few seconds, then try again.',
    );
  }

  private async restorePreviousSessions() {
    try {
      const sessions = await this.sessionModel
        .find({ sessionId: { $ne: null }, lastDisconnectReason: { $ne: 'LOGOUT' } })
        .lean();
      if (!sessions.length) return;
      this.logger.log(`Restoring ${sessions.length} Baileys session(s)`);
      for (const session of sessions) {
        if (this.shuttingDown) return;
        const tenantId = String(session.tenantId);
        const hasAuth = await this.authModel.exists({
          tenantId: new Types.ObjectId(tenantId),
          key: 'creds',
        });
        if (!hasAuth) continue;
        try {
          await this.startSession(tenantId);
        } catch (error) {
          this.logger.warn(
            `Could not restore Baileys session ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
          );
        }
        await this.delay(250);
      }
    } catch (error) {
      this.logger.error(
        `Failed to restore Baileys sessions: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private scheduleReconnect(tenantId: string, reason: string) {
    if (this.reconnectTimers.has(tenantId) || this.manualStops.has(tenantId)) return;
    const attempt = this.reconnectAttempts.get(tenantId) || 0;
    const wait = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempts.set(tenantId, attempt + 1);
    this.logger.warn(
      `Scheduling Baileys reconnect for ${tenantId} in ${Math.round(wait / 1000)}s (${reason})`,
    );
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(tenantId);
      void this.startSession(tenantId).catch((error) => {
        this.logger.warn(
          `Reconnect failed for ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
        this.scheduleReconnect(tenantId, 'retry failed');
      });
    }, wait);
    timer.unref?.();
    this.reconnectTimers.set(tenantId, timer);
  }

  private async loadAuthState(tenantId: string, baileys: BaileysModule) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const read = async (key: string) => {
      const row = await this.authModel.findOne({ tenantId: tenantObjectId, key }).lean();
      if (!row?.value) return null;
      return JSON.parse(row.value, baileys.BufferJSON.reviver);
    };
    const write = async (key: string, value: unknown) => {
      if (value === null || value === undefined) {
        await this.authModel.deleteOne({ tenantId: tenantObjectId, key });
        return;
      }
      const serialized = JSON.stringify(value, baileys.BufferJSON.replacer);
      await this.authModel.updateOne(
        { tenantId: tenantObjectId, key },
        { $set: { tenantId: tenantObjectId, key, value: serialized } },
        { upsert: true },
      );
    };

    const creds = (await read('creds')) || baileys.initAuthCreds();
    const keys = {
      get: async (type: string, ids: string[]) => {
        const result: Record<string, unknown> = {};
        if (!ids.length) return result;
        const storageKeys = ids.map((id) => `${type}:${id}`);
        const rows = await this.authModel
          .find({ tenantId: tenantObjectId, key: { $in: storageKeys } })
          .lean();
        for (const row of rows) {
          const id = row.key.slice(type.length + 1);
          let value = JSON.parse(row.value, baileys.BufferJSON.reviver);
          if (
            type === 'app-state-sync-key' &&
            value &&
            baileys.proto?.Message?.AppStateSyncKeyData?.fromObject
          ) {
            value = baileys.proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          result[id] = value;
        }
        return result;
      },
      set: async (data: Record<string, Record<string, unknown>>) => {
        const operations: any[] = [];
        for (const [type, entries] of Object.entries(data || {})) {
          for (const [id, value] of Object.entries(entries || {})) {
            const key = `${type}:${id}`;
            if (value === null || value === undefined) {
              operations.push({ deleteOne: { filter: { tenantId: tenantObjectId, key } } });
            } else {
              operations.push({
                updateOne: {
                  filter: { tenantId: tenantObjectId, key },
                  update: {
                    $set: {
                      tenantId: tenantObjectId,
                      key,
                      value: JSON.stringify(value, baileys.BufferJSON.replacer),
                    },
                  },
                  upsert: true,
                },
              });
            }
          }
        }
        if (operations.length) {
          await this.authModel.bulkWrite(operations, { ordered: false });
        }
      },
      clear: async () => {
        await this.authModel.deleteMany({
          tenantId: tenantObjectId,
          key: { $ne: 'creds' },
        });
      },
    };

    return {
      state: { creds, keys },
      saveCreds: () => write('creds', creds),
    };
  }

  private async deleteAuthState(tenantId: string) {
    await this.authModel.deleteMany({ tenantId: new Types.ObjectId(tenantId) });
  }

  private async upsertSessionAndNotify(
    tenantId: string,
    patch: Partial<WhatsappSession>,
  ) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const session = await this.sessionModel
      .findOneAndUpdate(
        { tenantId: tenantObjectId },
        { $set: { tenantId: tenantObjectId, ...patch } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    await this.notifyListeners(
      this.sessionUpdateListeners,
      { tenantId, session } as WhatsappSessionUpdateEvent,
      'session update',
    );
    return session;
  }

  private async notifyListeners<T>(
    listeners: Set<AsyncListener<T>>,
    event: T,
    label: string,
  ) {
    await Promise.all(
      [...listeners].map(async (listener) => {
        try {
          await listener(event);
        } catch (error) {
          this.logger.warn(
            `${label} listener failed: ${error instanceof Error ? error.message : 'unknown'}`,
          );
        }
      }),
    );
  }

  private normalizeJid(value: string) {
    const jid = String(value || '').trim();
    if (!jid) return '';
    if (jid.endsWith('@c.us')) return `${jid.split('@')[0]}@s.whatsapp.net`;
    if (!jid.includes('@')) {
      const digits = jid.replace(/\D/g, '');
      return digits ? `${digits}@s.whatsapp.net` : '';
    }
    return jid;
  }

  private phoneFromJid(value: string) {
    if (!value.endsWith('@s.whatsapp.net') && !value.endsWith('@c.us')) return null;
    const user = value.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') || '';
    return user.length >= 7 ? user : null;
  }

  private rememberJidPhone(tenantId: string, jid: string, phone: string) {
    if (!jid || !phone) return;
    let map = this.jidPhoneMap.get(tenantId);
    if (!map) {
      map = new Map();
      this.jidPhoneMap.set(tenantId, map);
    }
    map.set(this.normalizeJid(jid), phone.replace(/\D/g, ''));
  }

  private isIgnoredJid(jid: string) {
    return (
      jid.endsWith('@g.us') ||
      jid.endsWith('@broadcast') ||
      jid.endsWith('@newsletter') ||
      jid === 'status@broadcast'
    );
  }

  private unwrapMessage(message: any): any {
    if (!message || typeof message !== 'object') return message || {};
    return (
      message.ephemeralMessage?.message ||
      message.viewOnceMessage?.message ||
      message.viewOnceMessageV2?.message ||
      message.viewOnceMessageV2Extension?.message ||
      message.documentWithCaptionMessage?.message ||
      message
    );
  }

  private extractBody(message: any): string {
    if (!message) return '';
    return String(
      message.conversation ??
        message.extendedTextMessage?.text ??
        message.imageMessage?.caption ??
        message.videoMessage?.caption ??
        message.documentMessage?.caption ??
        message.buttonsResponseMessage?.selectedDisplayText ??
        message.listResponseMessage?.title ??
        message.templateButtonReplyMessage?.selectedDisplayText ??
        message.pollCreationMessage?.name ??
        message.contactMessage?.displayName ??
        message.locationMessage?.name ??
        '',
    );
  }

  private extractContextInfo(message: any) {
    const values = Object.values(message || {}) as any[];
    for (const value of values) {
      if (value?.contextInfo) return value.contextInfo;
    }
    return null;
  }

  private extractMediaMeta(message: any) {
    const candidates = [
      ['image', message?.imageMessage],
      ['video', message?.videoMessage],
      ['audio', message?.audioMessage],
      ['document', message?.documentMessage],
      ['sticker', message?.stickerMessage],
    ] as const;
    for (const [messageType, media] of candidates) {
      if (!media) continue;
      return {
        hasMedia: true,
        messageType,
        mimetype: media.mimetype || null,
        fileName: media.fileName || null,
      };
    }
    return {
      hasMedia: false,
      messageType: 'chat',
      mimetype: null,
      fileName: null,
    };
  }

  private async downloadAndStoreMedia(
    tenantId: string,
    socket: SocketLike,
    message: any,
    mediaMeta: { mimetype: string | null; fileName: string | null },
    baileys: BaileysModule,
  ) {
    try {
      const buffer = await baileys.downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: this.baileysLogger,
          reuploadRequest: socket.updateMediaMessage?.bind(socket),
        },
      );
      if (!Buffer.isBuffer(buffer)) return null;
      const mimeExt = mediaMeta.mimetype
        ?.split('/')[1]
        ?.split(';')[0]
        ?.replace(/[^a-z0-9]/gi, '');
      const fileExt = path.extname(mediaMeta.fileName || '').replace('.', '');
      const ext = fileExt || mimeExt || 'bin';
      const filename = `${crypto.randomUUID()}.${ext}`;
      const uploadsDir = path.join(process.cwd(), 'uploads', 'media');
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(path.join(uploadsDir, filename), buffer);
      await this.upsertSessionAndNotify(tenantId, { lastActivityAt: new Date() });
      return `/uploads/media/${filename}`;
    } catch (error) {
      this.logger.warn(
        `Baileys media download failed for ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  private messageDate(message: any) {
    const raw = message?.messageTimestamp;
    const seconds = typeof raw === 'number' ? raw : Number(raw?.low ?? raw ?? 0);
    return new Date(
      (Number.isFinite(seconds) && seconds > 0 ? seconds : Date.now() / 1000) * 1000,
    );
  }

  private cacheMessage(tenantId: string, message: any) {
    const id = message?.key?.id;
    if (!id) return;
    let cache = this.messageCache.get(tenantId);
    if (!cache) {
      cache = new Map();
      this.messageCache.set(tenantId, cache);
    }
    cache.set(String(id), message);
    while (cache.size > MAX_CACHED_MESSAGES_PER_TENANT) {
      const first = cache.keys().next().value;
      if (!first) break;
      cache.delete(first);
    }
  }

  private findCachedMessage(tenantId: string, id: string) {
    return this.messageCache.get(tenantId)?.get(String(id));
  }

  private recordHistory(event: IncomingWhatsappMessageEvent) {
    let tenantHistory = this.history.get(event.tenantId);
    if (!tenantHistory) {
      tenantHistory = new Map();
      this.history.set(event.tenantId, tenantHistory);
    }

    const existing = tenantHistory.get(event.whatsappChatId);
    const historyMessage = {
      whatsappMessageId: event.whatsappMessageId,
      whatsappChatId: event.whatsappChatId,
      customerPhone: event.customerPhone,
      customerName: event.customerName,
      direction: event.direction,
      messageType: event.messageType,
      body: event.body,
      mediaMimeType: event.mediaMimeType,
      mediaFileName: event.mediaFileName,
      createdAt: event.createdAt,
    };
    const messages = [...(existing?.messages || [])];
    const duplicateIndex = messages.findIndex(
      (item) => item.whatsappMessageId === event.whatsappMessageId,
    );
    if (duplicateIndex >= 0) messages[duplicateIndex] = historyMessage;
    else messages.push(historyMessage);
    if (messages.length > MAX_HISTORY_MESSAGES_PER_CHAT) {
      messages.splice(0, messages.length - MAX_HISTORY_MESSAGES_PER_CHAT);
    }

    tenantHistory.set(event.whatsappChatId, {
      whatsappChatId: event.whatsappChatId,
      customerPhone: event.customerPhone || existing?.customerPhone || '',
      customerName: event.customerName || existing?.customerName || null,
      unreadCount:
        event.direction === 'incoming'
          ? (existing?.unreadCount || 0) + 1
          : existing?.unreadCount || 0,
      lastMessage: event.body,
      lastMessageAt: event.createdAt,
      messages,
    });

    if (tenantHistory.size > MAX_HISTORY_CHATS_PER_TENANT) {
      const oldest = [...tenantHistory.entries()].sort(
        (a, b) =>
          (a[1].lastMessageAt?.getTime() || 0) -
          (b[1].lastMessageAt?.getTime() || 0),
      )[0]?.[0];
      if (oldest) tenantHistory.delete(oldest);
    }
  }

  private mapBaileysAck(status: number) {
    switch (status) {
      case 0:
        return -1;
      case 1:
        return 0;
      case 2:
        return 1;
      case 3:
        return 2;
      case 4:
        return 3;
      case 5:
        return 4;
      default:
        return status;
    }
  }

  private extractDisconnectStatus(error: any): number | null {
    const candidates = [
      error?.output?.statusCode,
      error?.data?.statusCode,
      error?.statusCode,
      error?.status,
    ];
    for (const value of candidates) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
