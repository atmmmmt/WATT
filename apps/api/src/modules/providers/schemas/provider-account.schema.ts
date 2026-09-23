import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ProviderAccountDocument = HydratedDocument<ProviderAccount>;

export enum ProviderType {
  MOCK = 'mock',
  TWILIO = 'twilio',
  WHATSAPP_WEB = 'whatsapp_web',
}

@Schema({
  timestamps: true,
  collection: 'provider_accounts',
})
export class ProviderAccount {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(ProviderType) })
  providerType: ProviderType;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: 'active' | 'inactive';

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  config: Record<string, unknown>;
}

export const ProviderAccountSchema =
  SchemaFactory.createForClass(ProviderAccount);
