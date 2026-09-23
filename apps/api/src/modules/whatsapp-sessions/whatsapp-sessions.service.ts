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
import * as QRCode from 'qrcode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
import { Client, LocalAuth, Message, MessageMedia } from 'whatsapp-web.js';
import { ProviderType } from '../providers/schemas/provider-account.schema';
import { ProvidersService } from '../providers/providers.service';
import {
  WhatsappSession,
  WhatsappSessionDocument,
  WhatsappSessionStatus,
} from './schemas/whatsapp-session.schema';

export interface IncomingWhatsappMessageEvent {
  tenantId: string;
  whatsappMessageId: string;
  whatsappChatId: string;
  customerPhone: string;
  customerName: string | null;
  profilePicture: string | null;
  direction: 'incoming' | 'outgoing';
  messageType: string;
  body: string;
  mediaMimeType: string | null;
  mediaFileName: string | null;
  mediaUrl: string | null;
  quotedWhatsappMessageId: string | null;
  /** Text of the quoted message — the reliable fallback when ids are unavailable. */
  quotedBody: string | null;
  createdAt: Date;
}

export interface WhatsappMessageAckEvent {
  tenantId: string;
  whatsappMessageId: string;
  ack: number;
}

export interface WhatsappMessageEditEvent {
  tenantId: string;
  whatsappMessageId: string;
  whatsappChatId: string | null;
  newBody: string;
  prevBody: string;
  editedAt: Date;
}

export interface WhatsappSessionUpdateEvent {
  tenantId: string;
  session: Awaited<ReturnType<WhatsappSessionsService['getSession']>>;
}

export interface WhatsappHistoryMessageSnapshot {
  whatsappMessageId: string | null;
  whatsappChatId: string;
  customerPhone: string;
  customerName: string | null;
  direction: 'incoming' | 'outgoing';
  messageType: string;
  body: string;
  mediaMimeType: string | null;
  mediaFileName: string | null;
  createdAt: Date;
}

export interface WhatsappChatHistorySnapshot {
  whatsappChatId: string;
  customerPhone: string;
  customerName: string | null;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: Date | null;
  messages: WhatsappHistoryMessageSnapshot[];
}

type AsyncListener<T> = (event: T) => Promise<void> | void;

/**
 * Kill switch for every WhatsApp connection (boot restore, watchdog, on-demand start).
 * Set WA_DISABLE_SESSIONS=true when running a copy of the API against the production
 * database — a second instance connecting would fight the live one for the linked device
 * and knock real tenants offline. Also useful for maintenance windows.
 */
const SESSIONS_DISABLED = (process.env.WA_DISABLE_SESSIONS || '').toLowerCase() === 'true';

/** Per-tenant Chrome JS heap cap (MB). Lower = more tenants per server. */
const CHROME_JS_HEAP_MB = Number(process.env.WA_CHROME_HEAP_MB || 256);

/**
 * WhatsApp Web downloads profile pictures, stickers, fonts and inline media into the
 * page — none of which we use: media is fetched and decrypted in Node instead. Blocking
 * them is the single biggest memory and bandwidth saving per session. Set
 * WA_BLOCK_PAGE_MEDIA=false to turn it off if anything looks wrong.
 */
const BLOCK_PAGE_MEDIA = (process.env.WA_BLOCK_PAGE_MEDIA || 'true').toLowerCase() !== 'false';
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);

/**
 * Reconnection backoff after a drop. WhatsApp disconnects happen for transient reasons
 * (network blip, WhatsApp restarting the socket, a Chrome crash); the saved credentials
 * stay valid, so retrying reconnects without any QR scan.
 */
const RECONNECT_DELAYS_MS = [10_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000];

/** How often to verify that everything that should be connected actually is. */
const WATCHDOG_INTERVAL_MS = Number(process.env.WA_WATCHDOG_INTERVAL_MS || 60_000);

/**
 * Reasons that genuinely need a human to scan a new QR. Everything else is retried
 * automatically, forever.
 */
const UNRECOVERABLE_REASONS = new Set(['LOGOUT', 'HIBERNATED']);

function needsFreshScan(reason: string | null | undefined) {
  const value = String(reason || '').toUpperCase();
  return value.includes('LOGOUT') || value.includes('UNPAIRED');
}

/**
 * Optional idle hibernation: tenants listed in WA_HIBERNATE_TENANTS release their Chrome
 * after WA_IDLE_HIBERNATE_MINUTES with no traffic, and start again automatically on the
 * next send. Only use it for OTP-only tenants — a support inbox must stay connected to
 * receive messages. Opt-in by tenant id precisely so no inbox is ever silently muted.
 */
const HIBERNATE_TENANTS = new Set(
  (process.env.WA_HIBERNATE_TENANTS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);
const IDLE_HIBERNATE_MS = Number(process.env.WA_IDLE_HIBERNATE_MINUTES || 60) * 60_000;

@Injectable()
export class WhatsappSessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappSessionsService.name);
  private readonly clients = new Map<string, Client>();
  private readonly incomingMessageListeners = new Set<
    AsyncListener<IncomingWhatsappMessageEvent>
  >();
  private readonly ackListeners = new Set<AsyncListener<WhatsappMessageAckEvent>>();
  private readonly editListeners = new Set<AsyncListener<WhatsappMessageEditEvent>>();
  private readonly sessionUpdateListeners = new Set<
    AsyncListener<WhatsappSessionUpdateEvent>
  >();
  // Guards for automatic recovery of a dead Puppeteer page (see recoverDeadSession).
  private readonly recovering = new Set<string>();
  private readonly lastRecoveryAt = new Map<string, number>();
  // Automatic reconnection after a drop: pending timer + attempt count per tenant.
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly reconnectAttempts = new Map<string, number>();
  private watchdogTimer?: NodeJS.Timeout;
  /** Last time each tenant sent or received anything — used for idle hibernation. */
  private readonly lastUsedAt = new Map<string, number>();

  constructor(
    @InjectModel(WhatsappSession.name)
    private readonly sessionModel: Model<WhatsappSessionDocument>,
    private readonly providersService: ProvidersService,
  ) {}

  /**
   * Sessions used to die on every process restart: nothing re-initialized the
   * WhatsApp client, so messages silently stopped arriving until someone opened the
   * dashboard and started a session by hand. Restore previously-connected sessions
   * automatically on boot (LocalAuth reuses the saved credentials, so no QR needed).
   */
  async onModuleInit() {
    if (SESSIONS_DISABLED) {
      this.logger.warn(
        'WA_DISABLE_SESSIONS=true — no WhatsApp session will be started, restored or watched',
      );
      return;
    }

    setTimeout(() => {
      this.restorePreviousSessions().catch((error) =>
        this.logger.error(
          `Failed to restore WhatsApp sessions on boot: ${error instanceof Error ? error.message : 'unknown'}`,
        ),
      );
    }, 5000);

    // Safety net above the per-event handlers: whatever the reason a session is not
    // running (missed event, crashed Chrome, failed retry), this notices within a minute.
    this.watchdogTimer = setInterval(() => {
      this.runWatchdog().catch((error) =>
        this.logger.warn(
          `Session watchdog failed: ${error instanceof Error ? error.message : 'unknown'}`,
        ),
      );
    }, WATCHDOG_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.reconnectTimers.clear();
  }

  /**
   * Re-opens a session that dropped, with an increasing delay between attempts and no
   * limit on how long it keeps trying. Skipped only when WhatsApp actually logged the
   * device out — that is the one case a person must scan a QR again.
   */
  private scheduleReconnect(tenantId: string, reason: string) {
    if (this.reconnectTimers.has(tenantId)) return;

    if (needsFreshScan(reason)) {
      this.logger.warn(
        `Tenant ${tenantId} was logged out of WhatsApp (${reason}) — a new QR scan is required`,
      );
      return;
    }
    if (HIBERNATE_TENANTS.has(tenantId) && reason === 'HIBERNATED') return;

    const attempt = this.reconnectAttempts.get(tenantId) || 0;
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempts.set(tenantId, attempt + 1);

    this.logger.log(
      `Scheduling WhatsApp reconnect for tenant ${tenantId} in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}, reason: ${reason})`,
    );

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(tenantId);
      try {
        if (this.clients.has(tenantId)) return;
        const session = await this.getSession(tenantId);
        if (needsFreshScan(session.lastDisconnectReason)) return;
        await this.startSession(tenantId);
        this.logger.log(`Reconnect attempt started for tenant ${tenantId}`);
      } catch (error) {
        this.logger.warn(
          `Reconnect attempt failed for tenant ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
        this.scheduleReconnect(tenantId, 'retry failed');
      }
    }, delay);

    // Don't hold the event loop open just for a pending retry.
    timer.unref?.();
    this.reconnectTimers.set(tenantId, timer);
  }

  /**
   * Once a minute: hibernate idle opt-in tenants, restart anything that should be
   * connected but has no live client, and probe the live ones for a dead page.
   */
  private async runWatchdog() {
    const sessions = await this.sessionModel
      .find({ sessionId: { $ne: null } }, { tenantId: 1, status: 1, lastDisconnectReason: 1 })
      .lean();

    for (const session of sessions) {
      const tenantId = String(session.tenantId);
      const client = this.clients.get(tenantId);

      if (client) {
        if (await this.hibernateIfIdle(tenantId)) continue;
        // "ready" in the database is not proof the browser is alive.
        if (session.status === WhatsappSessionStatus.READY) {
          try {
            const page = (client as any).pupPage;
            if (page?.evaluate) await page.evaluate('1');
          } catch (error) {
            if (this.isDeadPageError(error)) {
              this.logger.warn(`Watchdog found a dead page for tenant ${tenantId}`);
              void this.recoverDeadSession(tenantId, 'watchdog liveness probe');
            }
          }
        }
        continue;
      }

      // No live client. Anything except a real logout/hibernation should be running.
      if (
        needsFreshScan(session.lastDisconnectReason) ||
        UNRECOVERABLE_REASONS.has(String(session.lastDisconnectReason)) ||
        session.status === WhatsappSessionStatus.QR_READY ||
        session.status === WhatsappSessionStatus.INITIALIZING ||
        this.reconnectTimers.has(tenantId) ||
        this.recovering.has(tenantId)
      ) {
        continue;
      }

      this.logger.warn(
        `Watchdog: tenant ${tenantId} should be connected but has no client (status ${session.status})`,
      );
      this.scheduleReconnect(tenantId, `watchdog: ${session.status}`);
    }
  }

  /** Releases Chrome for an opt-in tenant that has been idle; it restarts on next use. */
  private async hibernateIfIdle(tenantId: string) {
    if (!HIBERNATE_TENANTS.has(tenantId) || IDLE_HIBERNATE_MS <= 0) return false;
    const lastUsed = this.lastUsedAt.get(tenantId) || 0;
    if (Date.now() - lastUsed < IDLE_HIBERNATE_MS) return false;

    const client = this.clients.get(tenantId);
    if (!client) return false;

    this.logger.log(`Hibernating idle WhatsApp session for tenant ${tenantId}`);
    try {
      await client.destroy();
    } catch {
      // already gone
    }
    this.clients.delete(tenantId);
    await this.upsertSessionAndNotify(tenantId, {
      status: WhatsappSessionStatus.DISCONNECTED,
      lastDisconnectReason: 'HIBERNATED',
    });
    return true;
  }

  private async restorePreviousSessions() {
    const sessions = await this.sessionModel
      .find({
        sessionId: { $ne: null },
        lastDisconnectReason: { $ne: 'LOGOUT' },
      })
      .lean();

    if (!sessions.length) {
      this.logger.log('No previous WhatsApp sessions to restore');
      return;
    }

    this.logger.log(`Restoring ${sessions.length} WhatsApp session(s) after boot...`);
    for (const session of sessions) {
      const tenantId = String(session.tenantId);
      try {
        await this.startSession(tenantId);
        this.logger.log(`Restore triggered for tenant ${tenantId}`);
      } catch (error) {
        this.logger.warn(
          `Could not restore session for tenant ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
      // Stagger so several tenants don't launch Chrome simultaneously (each one is a
      // full headless browser — starting them at once spikes memory).
      await this.delay(12000);
    }
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

  /**
   * Best-effort real phone number for a chat. @lid chats carry an internal id rather than
   * a number, so the number has to be looked up from the contact. Returns null when the
   * session is not connected or WhatsApp does not expose the number.
   */
  async resolveContactPhone(tenantId: string, whatsappChatId: string): Promise<string | null> {
    const client = this.clients.get(tenantId);
    if (!client || !whatsappChatId) return null;
    try {
      const contact = await Promise.race([
        client.getContactById(whatsappChatId),
        this.delay(5000).then(() => null),
      ]);
      const number = String((contact as any)?.number || '').replace(/\D/g, '');
      if (number.length >= 7 && number.length <= 15) return number;
      const serialized = (contact as any)?.id?._serialized;
      if (typeof serialized === 'string' && serialized.endsWith('@c.us')) {
        return String((contact as any).id.user || '').replace(/\D/g, '') || null;
      }
    } catch (error) {
      this.logger.warn(
        `Could not resolve phone for ${whatsappChatId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    return null;
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
    };
  }

  async startSession(tenantId: string) {
    if (SESSIONS_DISABLED) {
      throw new ServiceUnavailableException(
        'WhatsApp sessions are disabled on this instance (WA_DISABLE_SESSIONS=true)',
      );
    }
    this.lastUsedAt.set(tenantId, Date.now());
    // A manual/explicit start cancels any pending retry so the two don't race.
    const pending = this.reconnectTimers.get(tenantId);
    if (pending) {
      clearTimeout(pending);
      this.reconnectTimers.delete(tenantId);
    }

    if (this.clients.has(tenantId)) {
      return this.getSession(tenantId);
    }

    // If previous session was logged out, clear stale auth data so Chrome shows a fresh QR
    const existingSession = await this.getSession(tenantId);
    if (existingSession?.lastDisconnectReason === 'LOGOUT') {
      this.logger.log(`Clearing stale session data for tenant ${tenantId} (was LOGOUT)`);
      await this.removeLocalSessionArtifacts(tenantId);
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
      config: {},
    });

    await this.cleanupStaleChrome(tenantId);

    this.logger.log(`Initializing WhatsApp client for tenant ${tenantId}...`);
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: tenantId,
        dataPath: '.wwebjs_auth',
      }),
      webVersionCache: {
        type: 'remote',
        // The previously pinned build (2.3000.1014559837) had drifted far behind the
        // live WhatsApp Web client. Its in-page store was degraded: getChats() threw a
        // minified `r`, sendMessage() resolved to undefined, and no incoming-message
        // events fired at all — messages simply never arrived. Keep this pin current.
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1046618780-alpha.html',
      },
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          // Each tenant runs its own Chrome, so per-process memory is what limits how many
          // tenants fit on the server. These cap and trim what one page may hold.
          `--js-flags=--max-old-space-size=${CHROME_JS_HEAP_MB}`,
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-sync',
          '--no-default-browser-check',
          '--mute-audio',
          '--metrics-recording-only',
          '--renderer-process-limit=1',
          '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--no-pings',
        ],
      },
    });

    this.registerClientEvents(tenantId, client);
    this.clients.set(tenantId, client);

    client.initialize().catch(async (error: unknown) => {
      const reason =
        error instanceof Error ? error.message : 'Failed to initialize client';
      this.logger.error(`WhatsApp init failed for tenant ${tenantId}: ${reason}`);
      // cleanup so next attempt starts clean
      await this.cleanupStaleChrome(tenantId);
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.DISCONNECTED,
        lastDisconnectReason: reason,
      });
      this.clients.delete(tenantId);
      this.scheduleReconnect(tenantId, reason);
    });

    return this.getSession(tenantId);
  }

  async disconnectSession(tenantId: string) {
    const client = this.clients.get(tenantId);

    if (client) {
      try {
        await client.logout();
      } catch {
        // Ignore logout failures and force destroy below.
      }

      try {
        await client.destroy();
      } catch {
        // Ignore destroy failures.
      }

      this.clients.delete(tenantId);
    }

    // Always clear local auth artifacts so next startSession shows a fresh QR
    await this.cleanupStaleChrome(tenantId);
    await this.removeLocalSessionArtifacts(tenantId);

    await this.upsertSessionAndNotify(tenantId, {
      status: WhatsappSessionStatus.DISCONNECTED,
      qrDataUrl: null,
      lastDisconnectReason: 'LOGOUT',
      lastActivityAt: new Date(),
    });

    return this.getSession(tenantId);
  }

  async purgeTenantSession(tenantId: string) {
    const client = this.clients.get(tenantId);

    if (client) {
      try {
        await client.logout();
      } catch {
        // Ignore logout failures during tenant deletion.
      }

      try {
        await client.destroy();
      } catch {
        // Ignore destroy failures during tenant deletion.
      }

      this.clients.delete(tenantId);
    }

    await this.sessionModel.deleteOne({
      tenantId: new Types.ObjectId(tenantId),
    });

    await this.removeLocalSessionArtifacts(tenantId);
  }

  async sendOtpMessage(
    tenantId: string,
    phoneNumber: string,
    code: string,
    minutes: number,
  ) {
    const message = `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة ${minutes} دقيقة`;
    const result = await this.sendMessageToPhone(tenantId, phoneNumber, message);

    return {
      providerType: ProviderType.WHATSAPP_WEB,
      providerMessageId: result.providerMessageId,
    };
  }

  async sendTextMessage(
    tenantId: string,
    phoneNumber: string,
    message: string,
    options?: { quotedMessageId?: string },
  ) {
    const result = await this.sendMessageToPhone(tenantId, phoneNumber, message, options);
    return {
      providerType: ProviderType.WHATSAPP_WEB,
      providerMessageId: result.providerMessageId,
    };
  }

  /**
   * A whatsapp-web.js client can keep reporting "ready" long after its underlying
   * Chrome page has died ("detached Frame" / "Target closed"). In that state every
   * poll fails forever and no message is ever stored — which looked like "messages
   * stop arriving until someone restarts the server". Detect it and self-heal.
   */
  /**
   * WhatsApp Web no longer reliably exposes `id._serialized`; it can hand back the raw
   * id object instead. Always turn whatever we get into a plain string (or null).
   */
  private normalizeWhatsappId(rawId: unknown): string | null {
    if (typeof rawId === 'string') return rawId || null;
    if (rawId && typeof rawId === 'object') {
      const obj = rawId as Record<string, unknown>;
      if (typeof obj._serialized === 'string') return obj._serialized;
      if (typeof obj.$1 === 'string') return obj.$1;
      if (obj.id) return `${!!obj.fromMe}_${String(obj.remote)}_${String(obj.id)}`;
    }
    return null;
  }

  /**
   * Downloads and decrypts WhatsApp media ourselves.
   *
   * `message.downloadMedia()` relies on an in-page helper that current WhatsApp Web
   * builds break (it throws a minified `r`). But the message still carries everything
   * needed — the encrypted blob's URL plus its `mediaKey` — so we can fetch the file
   * straight from WhatsApp's CDN and decrypt it in Node, bypassing the page entirely.
   *
   * Scheme: HKDF-SHA256(mediaKey, salt=32 zero bytes, info=<per-type string>) → 112
   * bytes = iv(16) ‖ cipherKey(32) ‖ macKey(32). The blob is ciphertext ‖ mac(10),
   * validated with HMAC-SHA256(macKey, iv ‖ ciphertext) and decrypted AES-256-CBC.
   */
  private async downloadMediaDirect(
    rawData: any,
  ): Promise<{ buffer: Buffer; mimetype: string } | null> {
    try {
      const mediaKeyRaw = rawData?.mediaKey;
      const directPath = rawData?.directPath;
      const url: string | null =
        rawData?.deprecatedMms3Url ||
        (directPath ? `https://mmg.whatsapp.net${directPath}` : null);
      if (!mediaKeyRaw || !url) return null;

      const INFO_BY_TYPE: Record<string, string> = {
        image: 'WhatsApp Image Keys',
        sticker: 'WhatsApp Image Keys',
        video: 'WhatsApp Video Keys',
        audio: 'WhatsApp Audio Keys',
        ptt: 'WhatsApp Audio Keys',
        document: 'WhatsApp Document Keys',
      };
      const info = INFO_BY_TYPE[String(rawData?.type)] || 'WhatsApp Image Keys';

      const mediaKey = Buffer.isBuffer(mediaKeyRaw)
        ? mediaKeyRaw
        : typeof mediaKeyRaw === 'string'
          ? Buffer.from(mediaKeyRaw, 'base64')
          : Buffer.from(Object.values(mediaKeyRaw as Record<string, number>));

      const expanded = Buffer.from(
        crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(info, 'utf8'), 112),
      );
      const iv = expanded.subarray(0, 16);
      const cipherKey = expanded.subarray(16, 48);
      const macKey = expanded.subarray(48, 80);

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Media CDN fetch failed (${response.status})`);
        return null;
      }
      const encrypted = Buffer.from(await response.arrayBuffer());
      if (encrypted.length <= 10) return null;

      const ciphertext = encrypted.subarray(0, encrypted.length - 10);
      const mac = encrypted.subarray(encrypted.length - 10);
      const expectedMac = crypto
        .createHmac('sha256', macKey)
        .update(Buffer.concat([iv, ciphertext]))
        .digest()
        .subarray(0, 10);
      if (!crypto.timingSafeEqual(mac, expectedMac)) {
        this.logger.warn('Media MAC mismatch — refusing to use the decrypted file');
        return null;
      }

      const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
      const buffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return { buffer, mimetype: String(rawData?.mimetype || 'application/octet-stream') };
    } catch (error) {
      this.logger.warn(
        `Direct media download failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  private isDeadPageError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /detached Frame|Session closed|Target closed|Protocol error|Execution context was destroyed|page has been closed/i.test(
      message,
    );
  }

  private async recoverDeadSession(tenantId: string, reason: string) {
    if (this.recovering.has(tenantId)) return;

    // Cool-down so a persistently broken session can't spin in a restart loop.
    const last = this.lastRecoveryAt.get(tenantId) || 0;
    if (Date.now() - last < 120000) return;

    this.recovering.add(tenantId);
    this.lastRecoveryAt.set(tenantId, Date.now());
    this.logger.warn(`Recovering dead WhatsApp session for tenant ${tenantId}: ${reason}`);

    try {
      const client = this.clients.get(tenantId);
      if (client) {
        try {
          await client.destroy();
        } catch {
          // the page is already gone — nothing to clean up
        }
      }
      this.clients.delete(tenantId);

      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.DISCONNECTED,
        lastDisconnectReason: `auto-recovery: ${reason}`,
        lastActivityAt: new Date(),
      });

      // LocalAuth restores the saved credentials, so this normally reconnects
      // without needing a new QR scan.
      await this.startSession(tenantId);
      this.logger.log(`Re-initialized WhatsApp session for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(
        `Session recovery failed for tenant ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    } finally {
      this.recovering.delete(tenantId);
    }
  }

  async resolveChatId(tenantId: string, phoneNumber: string) {
    const client = await this.ensureClientReady(tenantId);
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    const numberId = await client.getNumberId(cleanPhone);
    if (!numberId) {
      throw new Error(`Phone number ${cleanPhone} is not registered on WhatsApp`);
    }
    return numberId._serialized;
  }

  async sendMediaMessage(
    tenantId: string,
    chatIdOrPhone: string,
    base64Data: string,
    mimetype: string,
    filename: string,
    caption?: string,
  ) {
    const client = await this.ensureClientReady(tenantId);

    let targetId = chatIdOrPhone;
    if (!targetId.includes('@')) {
      const cleanPhone = targetId.replace(/[^\d]/g, '');
      const numberId = await client.getNumberId(cleanPhone);
      if (!numberId) throw new Error(`Phone ${cleanPhone} not on WhatsApp`);
      targetId = numberId._serialized;
    }

    const media = new MessageMedia(mimetype, base64Data, filename);
    const result = await client.sendMessage(targetId, media, { caption });

    await this.upsertSessionAndNotify(tenantId, { lastActivityAt: new Date() });

    // Same trap the text path already guards against: when WhatsApp Web's in-page
    // store is degraded, sendMessage() resolves to `undefined` even though the media
    // was delivered. Reading `result.id` there threw and surfaced as a failed send.
    const providerMessageId = this.normalizeWhatsappId((result as any)?.id);
    if (!providerMessageId) {
      this.logger.warn(
        `Media send to ${targetId} returned no message model; treating as delivered`,
      );
    }
    return { providerMessageId: providerMessageId ?? 'sent-unmodelled' };
  }

  async listRecentChats(
    tenantId: string,
    options?: { chatLimit?: number; messageLimit?: number; skipScroll?: boolean },
  ): Promise<WhatsappChatHistorySnapshot[]> {
    const client = await this.ensureClientReady(tenantId);

    const chatLimit = options?.chatLimit ?? 50;
    const messageLimit = options?.messageLimit ?? 25;

    this.logger.log(`Fetching chats via getChats() for tenant ${tenantId}`);

    let allChats: any[] = [];
    try {
      // Scrolling the whole chat list is expensive (Puppeteer, up to ~90s). Only do it
      // for the full history import — for lightweight periodic polling the recent chats
      // are already loaded at the top of the pane, so skip the scroll.
      if (!options?.skipScroll) {
        await this.scrollChatListToLoadAll(client, tenantId);
      }
      allChats = await client.getChats();
      this.logger.log(`getChats() for tenant ${tenantId}: ${allChats.length} total chats`);
    } catch (err) {
      // A dead page will never recover on its own — rebuild the session instead of
      // failing on every poll forever.
      if (this.isDeadPageError(err)) {
        void this.recoverDeadSession(tenantId, 'getChats failed (dead page)');
        return [];
      }
      this.logger.warn(`getChats() failed for tenant ${tenantId}, falling back to page extract: ${err}`);
      return this.extractChatHistoryFromPage(client, chatLimit, messageLimit);
    }

    const directChats = allChats
      .filter((chat: any) => {
        if (chat.isGroup) return false;
        const id: string = chat.id?._serialized || '';
        // Accept both legacy @c.us and newer @lid format (WhatsApp Linked Devices)
        return id.endsWith('@c.us') || id.endsWith('@lid');
      })
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, chatLimit);

    this.logger.log(`Found ${directChats.length} direct chats for tenant ${tenantId}`);

    const page = (client as any).pupPage;
    const snapshots: WhatsappChatHistorySnapshot[] = [];

    for (const chat of directChats) {
      try {
        const whatsappChatId: string = chat.id._serialized;
        // @lid chats carry an internal id, not a phone number. Resolve the real number
        // (same as the realtime path) so conversations don't get stored with a LID —
        // which showed up as bogus "phone numbers" across the UI.
        let customerPhone = whatsappChatId.replace(/[^\d]/g, '');
        if (whatsappChatId.endsWith('@lid') || customerPhone.length > 13) {
          try {
            const contact = await client.getContactById(whatsappChatId);
            const resolved = (contact?.number || '').replace(/\D/g, '');
            if (resolved.length >= 7) {
              customerPhone = resolved;
            } else if (contact?.id?._serialized?.endsWith('@c.us')) {
              customerPhone = contact.id.user;
            }
          } catch {
            // keep the LID-derived value if resolution fails
          }
        }
        const customerName: string | null = chat.name || chat.pushname || null;

        // Strategy 1: Read from the chat's own msgs collection in WhatsApp Web memory.
        // Each chat model has a .msgs BackboneCollection that holds loaded messages.
        // This works for both @c.us and @lid format chats without needing to "open" the chat.
        let rawMessages: any[] = [];
        try {
          rawMessages = await page.evaluate(async (chatId: string, limit: number) => {
            try {
              const Store = (window as any).Store;
              if (!Store) return [];

              // Find the chat model in Store.Chat
              const chatModel = Store.Chat?.get(chatId);
              if (!chatModel) return [];

              // Read from chat's own msgs BackboneCollection
              const chatMsgs: any[] = chatModel.msgs?.getModelsArray?.() || chatModel.msgs?.models || [];
              if (chatMsgs.length > 0) {
                return chatMsgs.slice(-limit).map((m: any) => ({
                  id: m.id?._serialized || null,
                  chatId,
                  body: m.body || m.caption || '',
                  fromMe: !!(m.id?.fromMe),
                  t: m.t || 0,
                  type: m.type || 'chat',
                  mimetype: m.mimetype || null,
                  filename: m._data?.filename || null,
                  notifyName: m.notifyName || m._data?.notifyName || null,
                }));
              }

              // Strategy 2: Try loadEarlierMessages for this specific chat (forces a server fetch)
              try {
                const loaded = await (window as any).WWebJS?.loadEarlierMessages?.(chatId, limit, false);
                if (loaded?.length > 0) {
                  return loaded.map((m: any) => ({
                    id: m.id?._serialized || null,
                    chatId,
                    body: m.body || m.caption || '',
                    fromMe: !!(m.id?.fromMe),
                    t: m.t || 0,
                    type: m.type || 'chat',
                    mimetype: m.mimetype || null,
                    filename: m._data?.filename || null,
                    notifyName: m.notifyName || m._data?.notifyName || null,
                  }));
                }
              } catch { /* ignore */ }

              // Strategy 3: For @lid chats, also try using the contact's @c.us ID
              if (chatId.endsWith('@lid')) {
                const phoneNum = chatModel.contact?.phoneNumber || chatModel.contact?.number || '';
                if (phoneNum) {
                  const cUsId = `${phoneNum.replace(/[^\d]/g, '')}@c.us`;
                  try {
                    const loaded2 = await (window as any).WWebJS?.loadEarlierMessages?.(cUsId, limit, false);
                    if (loaded2?.length > 0) {
                      return loaded2.map((m: any) => ({
                        id: m.id?._serialized || null,
                        chatId,
                        body: m.body || m.caption || '',
                        fromMe: !!(m.id?.fromMe),
                        t: m.t || 0,
                        type: m.type || 'chat',
                        mimetype: m.mimetype || null,
                        filename: m._data?.filename || null,
                        notifyName: m.notifyName || m._data?.notifyName || null,
                      }));
                    }
                  } catch { /* ignore */ }
                }
              }

              return [];
            } catch { return []; }
          }, whatsappChatId, messageLimit);
          this.logger.log(`Chat ${whatsappChatId}: page.evaluate returned ${rawMessages.length} messages`);
        } catch (evalErr) {
          this.logger.warn(`page.evaluate failed for chat ${whatsappChatId}: ${evalErr}`);
        }

        // Strategy 4: Fallback to whatsapp-web.js fetchMessages (works for @c.us chats)
        if (rawMessages.length === 0) {
          try {
            const fetched = await chat.fetchMessages({ limit: messageLimit });
            if (fetched.length > 0) {
              rawMessages = fetched.map((msg: any) => ({
                id: msg.id?._serialized || null,
                chatId: whatsappChatId,
                body: msg.body || '',
                fromMe: !!(msg.fromMe),
                t: msg.timestamp || 0,
                type: msg.type || 'chat',
                mimetype: msg.mimetype || null,
                filename: msg._data?.filename || null,
                notifyName: msg.notifyName || msg._data?.notifyName || null,
              }));
              this.logger.log(`Chat ${whatsappChatId}: fetchMessages returned ${rawMessages.length} messages`);
            }
          } catch { /* ignore */ }
        }

        // Strategy 5: At minimum, include the last message from chat metadata
        if (rawMessages.length === 0 && chat.lastMessage) {
          try {
            const lm = chat.lastMessage;
            const lmBody = lm.body || lm.caption || '';
            if (lmBody || lm.type !== 'chat') {
              rawMessages = [{
                id: lm.id?._serialized || null,
                chatId: whatsappChatId,
                body: lmBody,
                fromMe: !!(lm.fromMe),
                t: lm.timestamp || chat.timestamp || 0,
                type: lm.type || 'chat',
                mimetype: lm.mimetype || null,
                filename: lm._data?.filename || null,
                notifyName: lm.notifyName || null,
              }];
              this.logger.log(`Chat ${whatsappChatId}: using lastMessage fallback`);
            }
          } catch { /* ignore */ }
        }

        // A missing/zero timestamp must NOT drop the message: previously those were
        // filtered out while the chat's lastMessage text still landed on the
        // conversation — so the list showed a message that had no stored document and
        // the thread looked empty. Fall back to the chat timestamp (then "now").
        const chatFallbackTs: number = chat.timestamp || Math.floor(Date.now() / 1000);
        const messages: WhatsappChatHistorySnapshot['messages'] = rawMessages
          .map((msg: any) => ({ ...msg, t: msg.t > 0 ? msg.t : chatFallbackTs }))
          .sort((a: any, b: any) => a.t - b.t)
          .slice(-messageLimit)
          .map((msg: any) => ({
            whatsappMessageId: msg.id || null,
            whatsappChatId,
            customerPhone,
            customerName: msg.notifyName || customerName,
            direction: (msg.fromMe ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
            messageType: this.resolveMessageType(msg.type),
            body: msg.body || '',
            mediaMimeType: msg.mimetype || null,
            mediaFileName: msg.filename || null,
            createdAt: new Date(msg.t * 1000),
          }));

        const lastMsg = messages[messages.length - 1];
        snapshots.push({
          whatsappChatId,
          customerPhone,
          customerName,
          unreadCount: chat.unreadCount || 0,
          // Only report a preview backed by a message we are actually returning, so the
          // conversation list can never advertise a message the thread doesn't have.
          lastMessage: lastMsg?.body || '',
          lastMessageAt: lastMsg?.createdAt || (chat.timestamp ? new Date(chat.timestamp * 1000) : null),
          messages,
        });
        this.logger.log(`Chat ${whatsappChatId}: ${messages.length} messages`);
      } catch (chatErr) {
        this.logger.warn(`Failed to process chat ${chat.id?._serialized}: ${chatErr}`);
      }
    }

    return snapshots;
  }

  /**
   * Resolves with the id of our own outgoing message once WhatsApp echoes it back
   * through message_create, or null if it never shows up. Used to confirm a send
   * that the in-page store could not model.
   */
  private waitForOutgoingMessage(
    client: Client,
    targetId: string,
    body: string,
    timeoutMs = 10000,
  ): { promise: Promise<string | null>; cancel: () => void } {
    let settle: (id: string | null) => void = () => undefined;
    let handler: (msg: Message) => void = () => undefined;
    let timer: NodeJS.Timeout;

    const finish = (id: string | null) => {
      clearTimeout(timer);
      client.removeListener('message_create', handler);
      settle(id);
    };

    const promise = new Promise<string | null>((resolve) => {
      settle = resolve;
      handler = (msg: Message) => {
        try {
          if (!msg?.fromMe) return;

          const rawTo = (msg as any)?.to ?? msg?.id?.remote;
          const to = typeof rawTo === 'string' ? rawTo : (rawTo?._serialized ?? '');
          if (to !== targetId) return;

          // When the in-page store is degraded the echoed Message often carries no
          // usable body, so body equality can only ever be an extra confirmation —
          // never a requirement. The recipient plus the fact that we started
          // listening immediately before our own send is what identifies it.
          if (msg.body && msg.body !== body) return;

          finish(msg.id?._serialized ?? 'sent-unmodelled');
        } catch {
          // a malformed echo must never break the send path
        }
      };
      client.on('message_create', handler);
      timer = setTimeout(() => finish(null), timeoutMs);
    });

    return { promise, cancel: () => finish(null) };
  }

  private async sendOnce(
    client: Client,
    targetId: string,
    message: string,
    options?: { quotedMessageId?: string },
  ) {
    return client.sendMessage(targetId, message, {
      quotedMessageId: options?.quotedMessageId,
    });
  }

  private async sendMessageToPhone(
    tenantId: string,
    chatIdOrPhone: string,
    message: string,
    options?: { quotedMessageId?: string },
  ) {
    const client = await this.ensureClientReady(tenantId);

    try {
      let targetId = chatIdOrPhone;

      if (!targetId.includes('@')) {
        const cleanPhone = targetId.replace(/[^\d]/g, '');
        this.logger.log(`Resolving WhatsApp ID for ${cleanPhone} for tenant ${tenantId}`);
        const numberId = await client.getNumberId(cleanPhone);
        if (!numberId) {
          throw new Error(`Phone number ${cleanPhone} is not registered on WhatsApp`);
        }
        targetId = numberId._serialized;
      }

      this.logger.log(`Sending WhatsApp message to ${targetId} for tenant ${tenantId}`);

      // whatsapp-web.js resolves to undefined (it never throws) when its in-page
      // store cannot build the sent-message model: WWebJS.getChat() returns null and
      // sendMessage() ends with `return sentMsg ? new Message(...) : undefined`.
      // Reading result.id on that is what surfaced as a bare HTTP 500
      // "Internal server error" on every login/register OTP.
      //
      // The message itself is still delivered in that state, so we must NOT resend
      // (that would send the user two OTPs). Listen for the message_create event
      // instead and treat it as the acknowledgement.
      const delivery = this.waitForOutgoingMessage(client, targetId, message);
      let providerMessageId: string | null = null;

      try {
        const result = await this.sendOnce(client, targetId, message, options);
        providerMessageId = result?.id?._serialized ?? null;
      } catch (sendError) {
        delivery.cancel();
        throw sendError;
      }

      if (providerMessageId) {
        delivery.cancel();
      } else {
        this.logger.warn(
          `Send to ${targetId} returned no message model; waiting for message_create to confirm delivery`,
        );
        providerMessageId = await delivery.promise;

        if (!providerMessageId) {
          throw new ServiceUnavailableException(
            'WhatsApp Web session cannot send messages right now. Reconnect the session and try again.',
          );
        }

        this.logger.log(`Delivery of ${targetId} confirmed via message_create (${providerMessageId})`);
      }

      await this.upsertSessionAndNotify(tenantId, {
        lastActivityAt: new Date(),
      });

      return {
        providerMessageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${chatIdOrPhone}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }


  private async ensureClientReady(tenantId: string, timeoutMs = 45000) {
    this.lastUsedAt.set(tenantId, Date.now());
    let client = this.clients.get(tenantId);
    let session = await this.getSession(tenantId);

    if (!client) {
      await this.startSession(tenantId);
    }

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      client = this.clients.get(tenantId);
      session = await this.getSession(tenantId);

      if (client && session.status === WhatsappSessionStatus.READY) {
        // "ready" in the DB is not proof the Chrome page is still alive — probe it.
        try {
          const page = (client as any).pupPage;
          if (page?.evaluate) await page.evaluate('1');
          return client;
        } catch (error) {
          if (this.isDeadPageError(error)) {
            await this.recoverDeadSession(tenantId, 'liveness probe failed');
            await this.delay(1500);
            continue;
          }
          return client;
        }
      }

      if (
        session.status === WhatsappSessionStatus.QR_READY ||
        session.status === WhatsappSessionStatus.AUTH_FAILURE
      ) {
        throw new InternalServerErrorException(
          'WhatsApp Web session requires a fresh QR scan. Open the connection page and scan the code again.',
        );
      }

      await this.delay(1500);
    }

    throw new InternalServerErrorException(
      'WhatsApp Web session is not ready yet. Wait a few seconds, then try again.',
    );
  }

  private async scrollChatListToLoadAll(client: Client, tenantId: string) {
    const page = (client as any).pupPage;
    if (!page?.evaluate) {
      this.logger.warn(`No puppeteer page for tenant ${tenantId}, skipping scroll`);
      return;
    }

    this.logger.log(`Scrolling chat list to load all chats for tenant ${tenantId}`);

    // Wait for the chat pane to appear
    try {
      await page.waitForSelector('#pane-side', { timeout: 15000 });
    } catch {
      this.logger.warn(`Chat pane not found for tenant ${tenantId}`);
      return;
    }

    // Scroll down repeatedly until no new chats appear
    let previousCount = 0;
    let stableRounds = 0;
    const deadline = Date.now() + 90000; // max 90s scrolling

    while (Date.now() < deadline) {
      const currentCount: number = await page.evaluate(() => {
        const pane = document.querySelector('#pane-side');
        if (!pane) return 0;
        // Scroll to bottom to trigger lazy loading
        pane.scrollTop = pane.scrollHeight;
        return document.querySelectorAll('#pane-side [data-testid="cell-frame-container"]').length;
      });

      this.logger.log(`Scroll progress for tenant ${tenantId}: ${currentCount} chats visible`);

      if (currentCount === previousCount) {
        stableRounds++;
        if (stableRounds >= 3) break; // stable for 3 rounds = all loaded
      } else {
        stableRounds = 0;
      }
      previousCount = currentCount;
      await this.delay(2000);
    }

    this.logger.log(`Scroll complete for tenant ${tenantId}: ${previousCount} chats loaded`);
  }

  private async waitForChatHydration(client: Client, tenantId: string, timeoutMs = 120000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const counts = await this.readChatCountsFromPage(client);
      if (counts.directChatCount > 0) {
        this.logger.log(
          `WhatsApp chat hydration completed for tenant ${tenantId}. Direct chats: ${counts.directChatCount}.`,
        );
        return;
      }

      await this.delay(2500);
    }
  }

  private async readChatCountsFromPage(client: Client) {
    const page = (client as any).pupPage;
    if (!page?.evaluate) {
      return {
        totalChatCount: 0,
        directChatCount: 0,
      };
    }

    return page.evaluate(() => {
      const models = (window as any).Store?.Chat?.getModelsArray?.() || [];
      const directChats = models.filter((chat: any) => {
        const serialized = chat?.id?._serialized || '';
        return !chat?.isGroup && (serialized.endsWith('@c.us') || serialized.endsWith('@lid'));
      });

      return {
        totalChatCount: models.length,
        directChatCount: directChats.length,
      };
    });
  }

  private async primeChatHistory(client: Client, chatIds: string[]) {
    for (const chatId of chatIds) {
      try {
        await (client as any).syncHistory?.(chatId);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Unknown history sync failure';
        this.logger.warn(`History sync request failed for chat ${chatId}: ${reason}`);
      }
    }

    await this.delay(3500);
  }

  private async extractChatHistoryFromPage(
    client: Client,
    chatLimit: number,
    messageLimit: number,
  ): Promise<WhatsappChatHistorySnapshot[]> {
    const page = (client as any).pupPage;
    if (!page?.evaluate) {
      return [];
    }

    const rawSnapshots = (await page.evaluate(
      async (limit: number, perChatLimit: number) => {
        const models = (window as any).Store?.Chat?.getModelsArray?.() || [];

        const directChats = models
          .filter((chat: any) => {
            const serialized = chat?.id?._serialized || '';
            return !chat?.isGroup && (serialized.endsWith('@c.us') || serialized.endsWith('@lid'));
          })
          .sort((left: any, right: any) => {
            const leftTimestamp =
              left?.timestamp ||
              left?.lastMessage?.t ||
              left?.lastReceivedKey?.timestamp ||
              0;
            const rightTimestamp =
              right?.timestamp ||
              right?.lastMessage?.t ||
              right?.lastReceivedKey?.timestamp ||
              0;
            return rightTimestamp - leftTimestamp;
          })
          .slice(0, limit);

        const snapshots = [];

        for (const chat of directChats) {
          const whatsappChatId = chat?.id?._serialized || '';
          if (!whatsappChatId) {
            continue;
          }

          const loadedMessages = chat?.msgs?.getModelsArray?.() || [];
          const normalizedMessages = loadedMessages
            .filter((message: any) => {
              const fromSerialized =
                message?.from?._serialized || message?.from || '';
              const toSerialized = message?.to?._serialized || message?.to || '';
              return (
                !String(fromSerialized).endsWith('@status') &&
                !String(toSerialized).endsWith('@status')
              );
            })
            .sort((left: any, right: any) => (left?.t || 0) - (right?.t || 0))
            .slice(-perChatLimit)
            .map((message: any) => {
              const serialized = (window as any).WWebJS.getMessageModel(message);
              // Newer WhatsApp Web builds no longer always expose `id._serialized`.
              // Falling back to `id` handed us the raw id OBJECT, which then blew up
              // the Mongo query with a CastError and aborted the whole sync — so no
              // message was ever stored. Always produce a plain string here.
              const rawId = serialized?.id;
              let messageId: string | null = null;
              if (typeof rawId === 'string') {
                messageId = rawId;
              } else if (rawId && typeof rawId === 'object') {
                messageId =
                  rawId._serialized ||
                  rawId.$1 ||
                  (rawId.id ? `${!!rawId.fromMe}_${rawId.remote}_${rawId.id}` : null);
              }
              return {
                whatsappMessageId: messageId,
                direction: serialized?.fromMe ? 'outgoing' : 'incoming',
                messageType: serialized?.type || 'chat',
                body: serialized?.body || serialized?.caption || '',
                mediaMimeType: serialized?.mimetype || null,
                mediaFileName: serialized?.filename || null,
                customerName:
                  serialized?.notifyName ||
                  serialized?.sender?.pushname ||
                  serialized?.sender?.formattedName ||
                  chat?.name ||
                  chat?.formattedTitle ||
                  null,
                createdAtMs: Number(serialized?.timestamp || serialized?.t || 0) * 1000,
              };
            });

          const lastMessage = normalizedMessages[normalizedMessages.length - 1];
          snapshots.push({
            whatsappChatId,
            customerPhone: whatsappChatId.replace(/[^\d]/g, ''),
            customerName: chat?.name || chat?.formattedTitle || null,
            unreadCount: Number(chat?.unreadCount || 0),
            lastMessage: lastMessage?.body || '',
            lastMessageAtMs: lastMessage?.createdAtMs || null,
            messages: normalizedMessages,
          });
        }

        return snapshots;
      },
      chatLimit,
      messageLimit,
    )) as Array<{
      whatsappChatId: string;
      customerPhone: string;
      customerName: string | null;
      unreadCount: number;
      lastMessage: string;
      lastMessageAtMs: number | null;
      messages: Array<{
        whatsappMessageId: string | null;
        direction: 'incoming' | 'outgoing';
        messageType: string;
        body: string;
        mediaMimeType: string | null;
        mediaFileName: string | null;
        customerName: string | null;
        createdAtMs: number;
      }>;
    }>;

    return rawSnapshots.map((chat) => {
      const messages = chat.messages
        .filter((message) => Number.isFinite(message.createdAtMs) && message.createdAtMs > 0)
        .map((message) => ({
          whatsappMessageId: message.whatsappMessageId,
          whatsappChatId: chat.whatsappChatId,
          customerPhone: chat.customerPhone,
          customerName: message.customerName || chat.customerName,
          direction: message.direction,
          messageType: this.resolveMessageType(message.messageType),
          body: message.body || '',
          mediaMimeType: message.mediaMimeType,
          mediaFileName: message.mediaFileName,
          createdAt: new Date(message.createdAtMs),
        }))
        .sort(
          (
            left: WhatsappHistoryMessageSnapshot,
            right: WhatsappHistoryMessageSnapshot,
          ) => left.createdAt.getTime() - right.createdAt.getTime(),
        );

      const lastMessage = messages[messages.length - 1];

      return {
        whatsappChatId: chat.whatsappChatId,
        customerPhone: chat.customerPhone,
        customerName: chat.customerName,
        unreadCount: chat.unreadCount,
        lastMessage: lastMessage?.body || chat.lastMessage || '',
        lastMessageAt:
          lastMessage?.createdAt ||
          (chat.lastMessageAtMs ? new Date(chat.lastMessageAtMs) : null),
        messages,
      };
    });
  }

  private registerClientEvents(tenantId: string, client: Client) {
    client.on('qr', async (qr: string) => {
      this.logger.log(`QR generated for tenant ${tenantId}`);
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.QR_READY,
        qrDataUrl,
        lastActivityAt: new Date(),
      });
    });

    client.on('authenticated', async () => {
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.AUTHENTICATED,
        qrDataUrl: null,
        lastActivityAt: new Date(),
      });
    });

    client.on('ready', async () => {
      const info = client.info;
      this.logger.log(`WhatsApp connected for tenant ${tenantId}`);
      // A successful connection resets the backoff, so the next drop retries quickly.
      this.reconnectAttempts.delete(tenantId);
      this.lastUsedAt.set(tenantId, Date.now());
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.READY,
        qrDataUrl: null,
        sessionId: info?.wid?._serialized || null,
        phoneNumber: info?.wid?.user || null,
        displayName: info?.pushname || null,
        lastReadyAt: new Date(),
        lastActivityAt: new Date(),
        lastDisconnectReason: null,
      });

      await this.applyPageResourceSavings(tenantId, client);

      // Inject real-time watcher for messages sent from the phone
      this.injectOutgoingMessageWatcher(tenantId, client).catch(e =>
        this.logger.warn(`Failed to inject outgoing watcher for ${tenantId}: ${e}`)
      );
    });

    client.on('auth_failure', async (message: string) => {
      this.logger.warn(`WhatsApp auth failure for tenant ${tenantId}: ${message}`);
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.AUTH_FAILURE,
        qrDataUrl: null,
        lastDisconnectReason: message,
        lastActivityAt: new Date(),
      });
    });

    client.on('disconnected', async (reason: string) => {
      this.logger.warn(`WhatsApp disconnected for tenant ${tenantId}: ${reason}`);
      await this.upsertSessionAndNotify(tenantId, {
        status: WhatsappSessionStatus.DISCONNECTED,
        qrDataUrl: null,
        lastDisconnectReason: reason,
        lastActivityAt: new Date(),
      });

      try {
        await client.destroy();
      } catch {
        // Ignore cleanup failures.
      }

      this.clients.delete(tenantId);

      // Previously the session simply stayed dead here until someone sent a message or
      // the server was restarted — which is why a drop looked permanent. Retry instead.
      this.scheduleReconnect(tenantId, reason);
    });

    client.on('message', async (message: Message) => {
      await this.handleIncomingMessage(tenantId, message);
    });

    client.on('message_create', async (message: Message) => {
      this.logger.log(`message_create fired for tenant ${tenantId}, fromMe=${message.fromMe}, to=${(message as any).to}, type=${message.type}`);
      if (!message.fromMe) return;
      await this.handlePhoneOutgoingMessage(tenantId, message);
    });

    // Fired when a message (ours or the customer's) is edited in WhatsApp.
    client.on('message_edit', async (message: Message, newBody: unknown, prevBody: unknown) => {
      const whatsappMessageId = this.normalizeWhatsappId(message?.id);
      if (!whatsappMessageId) {
        this.logger.warn(`message_edit for tenant ${tenantId} had no usable message id; skipped`);
        return;
      }
      const rawChat = message.fromMe ? (message as any).to : message.from;
      await Promise.all(
        [...this.editListeners].map(async (listener) => {
          try {
            await listener({
              tenantId,
              whatsappMessageId,
              whatsappChatId: typeof rawChat === 'string' ? rawChat : null,
              newBody: String(newBody ?? message.body ?? ''),
              prevBody: String(prevBody ?? ''),
              editedAt: new Date(),
            });
          } catch (error) {
            this.logger.warn(
              `Edit listener failed: ${error instanceof Error ? error.message : 'unknown error'}`,
            );
          }
        }),
      );
    });

    client.on('message_ack', async (message: Message, ack: number) => {
      const whatsappMessageId = message?.id?._serialized;
      if (!whatsappMessageId) {
        return;
      }

      await this.notifyAckListeners({
        tenantId,
        whatsappMessageId,
        ack,
      });
    });
  }

  /**
   * Stops the page from downloading images/media/fonts. Media we actually need is fetched
   * from WhatsApp's CDN and decrypted in Node (downloadMediaDirect), so nothing is lost —
   * only the copy the browser would have held in memory.
   */
  private async applyPageResourceSavings(tenantId: string, client: Client) {
    if (!BLOCK_PAGE_MEDIA) return;
    const page = (client as any).pupPage;
    if (!page?.setRequestInterception || page.__waSavingsApplied) return;

    try {
      await page.setRequestInterception(true);
      page.on('request', (request: any) => {
        try {
          if (request.isInterceptResolutionHandled?.()) return;
          if (BLOCKED_RESOURCE_TYPES.has(request.resourceType())) {
            request.abort().catch(() => undefined);
          } else {
            request.continue().catch(() => undefined);
          }
        } catch {
          // A request that races page teardown must never crash the process.
        }
      });
      page.__waSavingsApplied = true;
      this.logger.log(`Page resource savings enabled for tenant ${tenantId}`);
    } catch (error) {
      this.logger.warn(
        `Could not enable page resource savings for tenant ${tenantId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async injectOutgoingMessageWatcher(tenantId: string, client: Client) {
    const page = (client as any).pupPage;
    if (!page) {
      this.logger.warn(`injectOutgoingMessageWatcher: no pupPage for tenant ${tenantId}`);
      return;
    }

    const fnName = `__waPhoneMsg_${tenantId.replace(/[^a-z0-9]/gi, '_')}`;
    this.logger.log(`injectOutgoingMessageWatcher: starting for tenant ${tenantId}, fnName=${fnName}`);

    // exposeFunction throws "already exists" when page survives a PM2 restart — that's fine
    try {
      await page.exposeFunction(fnName, async (raw: any) => {
        this.logger.log(`Phone outgoing msg detected for tenant ${tenantId}: to=${raw.to} body=${String(raw.body).substring(0, 30)}`);
        await this.notifyIncomingMessageListeners({
          tenantId,
          whatsappMessageId: raw.id,
          whatsappChatId: raw.to,
          customerPhone: raw.to.replace(/[^\d]/g, ''),
          customerName: null,
          profilePicture: null,
          direction: 'outgoing',
          messageType: raw.type || 'chat',
          body: raw.body || '',
          mediaMimeType: null,
          mediaFileName: null,
          mediaUrl: null,
          quotedWhatsappMessageId: null,
          quotedBody: null,
          createdAt: new Date(raw.t ? raw.t * 1000 : Date.now()),
        });
      });
      this.logger.log(`exposeFunction registered for tenant ${tenantId}`);
    } catch (err: any) {
      // "already registered" is expected on PM2 restart with a surviving Chrome page
      this.logger.warn(`exposeFunction skipped for tenant ${tenantId}: ${err?.message}`);
    }

    // Inject Backbone event listener into WhatsApp Web Store
    await page.evaluate((cb: string) => {
      const tryInject = () => {
        const Store = (window as any).Store;
        if (!Store?.Chat) return false;

        Store.Chat.on('add change:lastMessage', (chat: any) => {
          try {
            const msg = chat.lastMessage;
            if (!msg || !msg.id?.fromMe) return;
            const chatId: string = chat.id?._serialized || '';
            if (!chatId || chatId.endsWith('@g.us') || chatId.endsWith('@status')) return;
            const msgId: string = msg.id?._serialized || '';
            const seen = (window as any).__waSeen || ((window as any).__waSeen = new Set());
            if (seen.has(msgId)) return;
            seen.add(msgId);
            if (seen.size > 500) {
              // Prevent unbounded growth
              const iter = seen.values();
              for (let i = 0; i < 100; i++) seen.delete(iter.next().value);
            }
            (window as any)[cb]({
              id: msgId,
              to: chatId,
              body: msg.body || msg.caption || '',
              type: msg.type || 'chat',
              t: msg.t || Math.floor(Date.now() / 1000),
            });
          } catch (_) {}
        });
        return true;
      };

      if (!tryInject()) {
        // Retry until Store is ready
        const iv = setInterval(() => { if (tryInject()) clearInterval(iv); }, 500);
        setTimeout(() => clearInterval(iv), 30000);
      }
    }, fnName);

    this.logger.log(`Outgoing message watcher injected for tenant ${tenantId}`);
  }

  private async handlePhoneOutgoingMessage(tenantId: string, message: Message) {
    const whatsappChatId = (message as any).to || (message as any).id?.remote;
    this.logger.log(`handlePhoneOutgoingMessage: tenant=${tenantId}, chatId=${whatsappChatId}, body=${message.body?.substring(0, 30)}`);
    if (!whatsappChatId || whatsappChatId.endsWith('@status') || whatsappChatId.endsWith('@g.us')) {
      return;
    }

    let customerPhone = whatsappChatId.replace(/[^\d]/g, '');
    const isLid = whatsappChatId.endsWith('@lid') || customerPhone.length > 13;
    if (isLid) {
      try {
        const client = this.clients.get(tenantId);
        if (client) {
          const contact = await client.getContactById(whatsappChatId);
          if (contact?.number && contact.number.length >= 7) {
            customerPhone = contact.number.replace(/\D/g, '');
          } else if (contact?.id?._serialized?.endsWith('@c.us')) {
            customerPhone = contact.id.user;
          }
        }
      } catch (e) {
        this.logger.warn(`Could not resolve real phone for LID ${whatsappChatId}: ${e}`);
      }
    }

    await this.notifyIncomingMessageListeners({
      tenantId,
      whatsappMessageId: this.normalizeWhatsappId(message.id) ?? '',
      whatsappChatId,
      customerPhone,
      customerName: null,
      profilePicture: null,
      direction: 'outgoing',
      messageType: this.resolveMessageType(message.type),
      body: message.body || '',
      mediaMimeType: null,
      mediaFileName: null,
      mediaUrl: null,
      quotedWhatsappMessageId: null,
      quotedBody: null,
      createdAt: new Date((message.timestamp || Date.now() / 1000) * 1000),
    });
  }

  private async handleIncomingMessage(tenantId: string, message: Message) {
    if (message.fromMe) {
      return;
    }

    const whatsappChatId = message.from;
    if (!whatsappChatId || whatsappChatId.endsWith('@status')) {
      return;
    }

    const rawData = (message as any)._data as Record<string, unknown> | undefined;
    const rawMessage = rawData as any;

    // Resolve real phone number — WhatsApp LID contacts (@lid) send an internal ID instead of a phone
    let customerPhone = whatsappChatId.replace(/[^\d]/g, '');
    const isLid = whatsappChatId.endsWith('@lid') || customerPhone.length > 13;
    if (isLid) {
      try {
        const client = this.clients.get(tenantId);
        if (client) {
          const contact = await client.getContactById(whatsappChatId);
          // contact.number is the real phone without country code prefix symbols
          if (contact?.number && contact.number.length >= 7) {
            customerPhone = contact.number.replace(/\D/g, '');
          } else if (contact?.id?._serialized?.endsWith('@c.us')) {
            customerPhone = contact.id.user;
          }
        }
      } catch (e) {
        this.logger.warn(`Could not resolve real phone for LID ${whatsappChatId}: ${e}`);
      }
    }

    const customerName = this.pickString(
      rawData?.notifyName,
      rawData?.pushname,
      rawMessage?.sender?.pushname,
      rawMessage?.sender?.formattedName,
    );

    this.logger.log(
      `Incoming WhatsApp message received for tenant ${tenantId} from ${whatsappChatId}`,
    );

    let quotedWhatsappMessageId: string | null = null;
    let quotedBody: string | null = null;
    if (message.hasQuotedMsg) {
      try {
        const quotedMsg = await message.getQuotedMessage();
        quotedWhatsappMessageId = this.normalizeWhatsappId(quotedMsg?.id);
        // Current WhatsApp Web builds often can't produce a usable message id, so the
        // quoted TEXT is the only reliable way to tell which message was replied to.
        quotedBody = (quotedMsg as any)?.body || (quotedMsg as any)?.caption || null;
      } catch (e) {
        this.logger.warn(`Failed to resolve quoted message: ${e}`);
      }
    }

    // Download media (images, docs) and save to disk so frontend can display them
    let mediaUrl: string | null = null;
    if (message.hasMedia) {
      try {
        const media = await message.downloadMedia();
        if (media?.data) {
          const ext = media.mimetype?.split('/')[1]?.split(';')[0] || 'bin';
          const filename = `${crypto.randomUUID()}.${ext}`;
          const uploadsDir = path.join(process.cwd(), 'uploads', 'media');
          await fs.mkdir(uploadsDir, { recursive: true });
          await fs.writeFile(path.join(uploadsDir, filename), Buffer.from(media.data, 'base64'));
          mediaUrl = `/uploads/media/${filename}`;
        }
      } catch (e) {
        // Expected on current WhatsApp Web builds — fall back to fetching and
        // decrypting the file ourselves from the metadata on the message.
        this.logger.warn(`In-page media download failed (${e}); trying direct download`);
      }

      if (!mediaUrl) {
        const direct = await this.downloadMediaDirect((message as any)._data || {});
        if (direct) {
          try {
            const ext = direct.mimetype.split('/')[1]?.split(';')[0] || 'bin';
            const filename = `${crypto.randomUUID()}.${ext}`;
            const uploadsDir = path.join(process.cwd(), 'uploads', 'media');
            await fs.mkdir(uploadsDir, { recursive: true });
            await fs.writeFile(path.join(uploadsDir, filename), direct.buffer);
            mediaUrl = `/uploads/media/${filename}`;
            this.logger.log(`Media recovered via direct download (${direct.buffer.length} bytes)`);
          } catch (writeError) {
            this.logger.warn(`Failed to store directly-downloaded media: ${writeError}`);
          }
        }
      }
    }

    await this.notifyIncomingMessageListeners({
      tenantId,
      whatsappMessageId: this.normalizeWhatsappId(message.id) ?? '',
      whatsappChatId,
      customerPhone,
      customerName,
      profilePicture: null,
      direction: 'incoming',
      messageType: this.resolveMessageType(message.type),
      body: message.body || '',
      mediaMimeType: this.pickString(rawData?.mimetype),
      mediaFileName: this.pickString(rawData?.filename),
      mediaUrl,
      quotedWhatsappMessageId,
      quotedBody,
      createdAt: new Date((message.timestamp || Date.now() / 1000) * 1000),
    });

    await this.upsertSessionAndNotify(tenantId, {
      lastActivityAt: new Date(),
    });
  }

  private resolveMessageType(messageType?: string) {
    switch (messageType) {
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
      case 'sticker':
      case 'location':
        return messageType;
      default:
        return 'text';
    }
  }

  private pickString(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async cleanupStaleChrome(tenantId: string) {
    // NOTE: this kills EVERY wwebjs Chrome process on the host, so it is only safe
    // when no other tenant session is running. Starting a second tenant used to wipe
    // out the first tenant's freshly connected session.
    if (this.clients.size > 0) {
      this.logger.log(
        `Skipping global Chrome cleanup for tenant ${tenantId}: ${this.clients.size} live session(s)`,
      );
      return;
    }

    // Kill all Chrome processes + clean lock files via dedicated script
    // (avoids pkill -f self-kill race condition)
    try {
      await execAsync(`sudo /usr/local/bin/kill-wwebjs-chrome`);
      await this.delay(1000);
    } catch { /* ignore */ }
    this.logger.log(`Cleaned stale Chrome for tenant ${tenantId}`);
  }

  private async removeLocalSessionArtifacts(tenantId: string) {
    const targets = [
      path.join(process.cwd(), '.wwebjs_auth', `session-${tenantId}`),
      path.join(process.cwd(), '.wwebjs_auth', tenantId),
      path.join(process.cwd(), '.wwebjs_cache', `session-${tenantId}`),
      path.join(process.cwd(), '.wwebjs_cache', tenantId),
    ];

    await Promise.all(
      targets.map(async (targetPath) => {
        try {
          await fs.rm(targetPath, { recursive: true, force: true });
        } catch {
          // Ignore filesystem cleanup failures.
        }
      }),
    );
  }

  private async notifyIncomingMessageListeners(event: IncomingWhatsappMessageEvent) {
    // Run each listener in isolation: a throw in one (e.g. doctor-relay) must not
    // block the others (e.g. support inbox realtime).
    await Promise.all(
      [...this.incomingMessageListeners].map(async (listener) => {
        try {
          await listener(event);
        } catch (error) {
          this.logger.warn(
            `Incoming message listener failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }),
    );
  }

  private async notifyAckListeners(event: WhatsappMessageAckEvent) {
    await Promise.all(
      [...this.ackListeners].map(async (listener) => {
        try {
          await listener(event);
        } catch (error) {
          this.logger.warn(
            `Ack listener failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }),
    );
  }

  private async notifySessionUpdateListeners(tenantId: string) {
    const session = await this.getSession(tenantId);
    for (const listener of this.sessionUpdateListeners) {
      await listener({
        tenantId,
        session,
      });
    }
  }

  private async upsertSessionAndNotify(
    tenantId: string,
    payload: Partial<WhatsappSession>,
  ) {
    // Any traffic counts as "in use" for idle hibernation.
    if (payload.lastActivityAt) {
      this.lastUsedAt.set(tenantId, Date.now());
    }
    await this.sessionModel.findOneAndUpdate(
      { tenantId: new Types.ObjectId(tenantId) },
      {
        tenantId: new Types.ObjectId(tenantId),
        ...payload,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    await this.notifySessionUpdateListeners(tenantId);
  }
}
