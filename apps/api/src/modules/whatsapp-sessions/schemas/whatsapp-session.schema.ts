import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type WhatsappSessionDocument = HydratedDocument<WhatsappSession>;

export enum WhatsappSessionStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  QR_READY = 'qr_ready',
  AUTHENTICATED = 'authenticated',
  READY = 'ready',
  DISCONNECTED = 'disconnected',
  AUTH_FAILURE = 'auth_failure',
}

@Schema({
  timestamps: true,
  collection: 'whatsapp_sessions',
})
export class WhatsappSession {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, unique: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(WhatsappSessionStatus) })
  status: WhatsappSessionStatus;

  @Prop({ type: String, default: null })
  qrDataUrl: string | null;

  @Prop({ type: String, default: null })
  sessionId: string | null;

  @Prop({ type: String, default: null })
  phoneNumber: string | null;

  @Prop({ type: String, default: null })
  displayName: string | null;

  @Prop({ type: String, default: null })
  lastDisconnectReason: string | null;

  @Prop({ type: Date, default: null })
  lastReadyAt: Date | null;

  @Prop({ type: Date, default: null })
  lastActivityAt: Date | null;
}

export const WhatsappSessionSchema =
  SchemaFactory.createForClass(WhatsappSession);
