import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type WhatsappBaileysAuthDocument = HydratedDocument<WhatsappBaileysAuth>;

@Schema({
  timestamps: true,
  collection: 'whatsapp_baileys_auth',
})
export class WhatsappBaileysAuth {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: String, required: true })
  key: string;

  // JSON serialized with Baileys BufferJSON. Keeping the payload as a string prevents
  // Mongoose from mutating Uint8Array/Buffer shaped values used by Signal sessions.
  @Prop({ type: String, required: true })
  value: string;
}

export const WhatsappBaileysAuthSchema =
  SchemaFactory.createForClass(WhatsappBaileysAuth);

WhatsappBaileysAuthSchema.index({ tenantId: 1, key: 1 }, { unique: true });
