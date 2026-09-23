import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

export enum TenantProduct {
  OTP = 'otp',
  HR = 'hr',
  SUPPORT = 'support',
  DOCTOR_RELAY = 'doctor_relay',
}

@Schema({
  timestamps: true,
  collection: 'tenants',
})
export class Tenant {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  contactEmail: string;

  @Prop({ type: [String], default: [] })
  allowedOrigins: string[];

  @Prop({
    type: [String],
    enum: Object.values(TenantProduct),
    default: [TenantProduct.OTP],
  })
  enabledProducts: TenantProduct[];

  @Prop({ type: Object, default: {} })
  settings: Record<string, unknown>;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: 'active' | 'inactive';
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
