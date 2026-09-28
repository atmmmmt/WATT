import { Injectable } from '@nestjs/common';
import { ProviderType } from '../providers/schemas/provider-account.schema';
import { WhatsappSessionStatus } from './schemas/whatsapp-session.schema';

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

export interface WhatsappSessionSnapshot {
  tenantId: unknown;
  status: WhatsappSessionStatus;
  qrDataUrl: string | null;
  sessionId: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  lastDisconnectReason: string | null;
  lastReadyAt: Date | null;
  lastActivityAt: Date | null;
  [key: string]: unknown;
}

export interface WhatsappSessionUpdateEvent {
  tenantId: string;
  session: WhatsappSessionSnapshot;
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

type ProviderSendResult = {
  providerType: ProviderType;
  providerMessageId: string;
};

/**
 * Stable application contract for WhatsApp sessions.
 *
 * The active implementation is provided by WhatsappSessionsModule. Keeping this token
 * transport-agnostic lets OTP, HR, Support Inbox and Doctor Relay remain unchanged while
 * the underlying engine can be Baileys today and another worker transport later.
 */
@Injectable()
export abstract class WhatsappSessionsService {
  abstract onIncomingMessage(
    listener: AsyncListener<IncomingWhatsappMessageEvent>,
  ): () => boolean;

  abstract onMessageAck(
    listener: AsyncListener<WhatsappMessageAckEvent>,
  ): () => boolean;

  abstract onMessageEdit(
    listener: AsyncListener<WhatsappMessageEditEvent>,
  ): () => boolean;

  abstract onSessionUpdate(
    listener: AsyncListener<WhatsappSessionUpdateEvent>,
  ): () => boolean;

  abstract getSession(tenantId: string): Promise<WhatsappSessionSnapshot>;
  abstract getClientSessionStatus(tenantId: string): Promise<Record<string, unknown>>;
  abstract startSession(tenantId: string): Promise<WhatsappSessionSnapshot>;
  abstract disconnectSession(tenantId: string): Promise<WhatsappSessionSnapshot>;
  abstract purgeTenantSession(tenantId: string): Promise<void>;

  abstract sendOtpMessage(
    tenantId: string,
    phoneNumber: string,
    code: string,
    minutes: number,
  ): Promise<ProviderSendResult>;

  abstract sendTextMessage(
    tenantId: string,
    chatIdOrPhone: string,
    message: string,
    options?: { quotedMessageId?: string },
  ): Promise<ProviderSendResult>;

  abstract sendMediaMessage(
    tenantId: string,
    chatIdOrPhone: string,
    base64Data: string,
    mimetype: string,
    filename: string,
    caption?: string,
  ): Promise<ProviderSendResult>;

  abstract resolveChatId(tenantId: string, phoneNumber: string): Promise<string>;
  abstract resolveContactPhone(
    tenantId: string,
    whatsappChatId: string,
  ): Promise<string | null>;

  abstract listRecentChats(
    tenantId: string,
    options?: { chatLimit?: number; messageLimit?: number; skipScroll?: boolean },
  ): Promise<WhatsappChatHistorySnapshot[]>;
}
