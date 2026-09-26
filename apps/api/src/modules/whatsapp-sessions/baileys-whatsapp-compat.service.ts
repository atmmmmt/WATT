import { Injectable } from '@nestjs/common';
import { BaileysWhatsappSessionsService } from './baileys-whatsapp-sessions.service';
import type {
  IncomingWhatsappMessageEvent,
  WhatsappChatHistorySnapshot,
  WhatsappMessageAckEvent,
  WhatsappMessageEditEvent,
  WhatsappSessionUpdateEvent,
} from './whatsapp-sessions.service';

type AsyncListener<T> = (event: T) => Promise<void> | void;

/**
 * Keeps the rest of WATT on its historic @c.us chat-id contract while Baileys uses
 * @s.whatsapp.net internally. This avoids splitting existing Support/Doctor Relay
 * conversations when the transport engine is changed.
 */
@Injectable()
export class BaileysWhatsappCompatService {
  constructor(private readonly baileys: BaileysWhatsappSessionsService) {}

  onIncomingMessage(listener: AsyncListener<IncomingWhatsappMessageEvent>) {
    return this.baileys.onIncomingMessage((event) =>
      listener({ ...event, whatsappChatId: this.toLegacyChatId(event.whatsappChatId) }),
    );
  }

  onMessageAck(listener: AsyncListener<WhatsappMessageAckEvent>) {
    return this.baileys.onMessageAck(listener);
  }

  onMessageEdit(listener: AsyncListener<WhatsappMessageEditEvent>) {
    return this.baileys.onMessageEdit((event) =>
      listener({
        ...event,
        whatsappChatId: event.whatsappChatId
          ? this.toLegacyChatId(event.whatsappChatId)
          : null,
      }),
    );
  }

  onSessionUpdate(listener: AsyncListener<WhatsappSessionUpdateEvent>) {
    return this.baileys.onSessionUpdate(listener);
  }

  getSession(tenantId: string) {
    return this.baileys.getSession(tenantId);
  }

  getClientSessionStatus(tenantId: string) {
    return this.baileys.getClientSessionStatus(tenantId);
  }

  startSession(tenantId: string) {
    return this.baileys.startSession(tenantId);
  }

  disconnectSession(tenantId: string) {
    return this.baileys.disconnectSession(tenantId);
  }

  purgeTenantSession(tenantId: string) {
    return this.baileys.purgeTenantSession(tenantId);
  }

  sendOtpMessage(tenantId: string, phoneNumber: string, code: string, minutes: number) {
    return this.baileys.sendOtpMessage(tenantId, phoneNumber, code, minutes);
  }

  sendTextMessage(
    tenantId: string,
    chatIdOrPhone: string,
    message: string,
    options?: { quotedMessageId?: string },
  ) {
    return this.baileys.sendTextMessage(tenantId, chatIdOrPhone, message, options);
  }

  sendMediaMessage(
    tenantId: string,
    chatIdOrPhone: string,
    base64Data: string,
    mimetype: string,
    filename: string,
    caption?: string,
  ) {
    return this.baileys.sendMediaMessage(
      tenantId,
      chatIdOrPhone,
      base64Data,
      mimetype,
      filename,
      caption,
    );
  }

  async resolveChatId(tenantId: string, phoneNumber: string) {
    const jid = await this.baileys.resolveChatId(tenantId, phoneNumber);
    return this.toLegacyChatId(jid);
  }

  resolveContactPhone(tenantId: string, whatsappChatId: string) {
    return this.baileys.resolveContactPhone(tenantId, whatsappChatId);
  }

  async listRecentChats(
    tenantId: string,
    options?: { chatLimit?: number; messageLimit?: number; skipScroll?: boolean },
  ): Promise<WhatsappChatHistorySnapshot[]> {
    const chats = await this.baileys.listRecentChats(tenantId, options);
    return chats.map((chat) => ({
      ...chat,
      whatsappChatId: this.toLegacyChatId(chat.whatsappChatId),
      messages: chat.messages.map((message) => ({
        ...message,
        whatsappChatId: this.toLegacyChatId(message.whatsappChatId),
      })),
    }));
  }

  private toLegacyChatId(jid: string) {
    if (jid.endsWith('@s.whatsapp.net')) {
      return `${jid.slice(0, -'@s.whatsapp.net'.length)}@c.us`;
    }
    return jid;
  }
}
