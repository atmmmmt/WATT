import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SupportConversationDocument = HydratedDocument<SupportConversation>;

export enum SupportConversationStatus {
  OPEN = 'open',
  PENDING = 'pending',
  CLOSED = 'closed',
}

export enum SupportAiStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  PROCESSING = 'processing',
  FAILED = 'failed',
  HUMAN_TAKEOVER = 'human_takeover',
}

export enum SupportConversationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

@Schema({
  timestamps: true,
  collection: 'support_conversations',
})
export class SupportConversation {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'WhatsappSession', default: null })
  whatsappSessionId: Types.ObjectId | null;

  @Prop({ required: true })
  whatsappChatId: string;

  /** Name as reported by WhatsApp — refreshed on sync, never edited by staff. */
  @Prop({ default: '' })
  customerName: string;

  /** Internal name set by staff. When present it is the name shown everywhere. */
  @Prop({ type: String, default: null })
  customName: string | null;

  @Prop({ required: true })
  customerPhone: string;

  @Prop({ type: String, default: null })
  profilePicture: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  assignedToUserId: Types.ObjectId | null;

  @Prop({
    required: true,
    enum: Object.values(SupportConversationStatus),
    default: SupportConversationStatus.OPEN,
  })
  status: SupportConversationStatus;

  @Prop({
    required: true,
    enum: Object.values(SupportConversationPriority),
    default: SupportConversationPriority.NORMAL,
  })
  priority: SupportConversationPriority;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'SupportTag', default: [] })
  tagIds: Types.ObjectId[];

  @Prop({ default: '' })
  lastMessage: string;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  @Prop({ type: Number, default: 0 })
  unreadCount: number;

  @Prop({ type: Date, default: null })
  firstResponseAt: Date | null;

  @Prop({ type: Date, default: null })
  lastIncomingMessageAt: Date | null;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  closedByUserId: Types.ObjectId | null;

  /**
   * AI auto-reply state for this conversation. null = follow the company setting.
   * "paused" is a manual per-conversation stop; "human_takeover" is set when staff
   * reply or take the conversation (if the company setting pauses AI then).
   */
  @Prop({
    type: String,
    enum: Object.values(SupportAiStatus),
    default: null,
  })
  aiStatus: SupportAiStatus | null;

  @Prop({ type: String, default: null })
  aiLastError: string | null;

  @Prop({ type: Date, default: null })
  aiUpdatedAt: Date | null;
}

export const SupportConversationSchema =
  SchemaFactory.createForClass(SupportConversation);

SupportConversationSchema.index(
  { companyId: 1, whatsappChatId: 1 },
  { unique: true, name: 'support_conversation_company_chat_unique' },
);

SupportConversationSchema.index(
  { companyId: 1, assignedToUserId: 1, lastMessageAt: -1 },
  { name: 'support_conversation_company_assignee_recent' },
);
