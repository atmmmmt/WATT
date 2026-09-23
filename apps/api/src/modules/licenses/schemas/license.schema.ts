import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LicenseDocument = HydratedDocument<License>;

@Schema({
  timestamps: true,
  collection: 'licenses',
})
export class License {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: 'active', enum: ['active', 'expired', 'revoked'] })
  status: 'active' | 'expired' | 'revoked';
}

export const LicenseSchema = SchemaFactory.createForClass(License);
