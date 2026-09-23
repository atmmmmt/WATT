import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ProviderType } from '../../providers/schemas/provider-account.schema';

export type OtpRequestDocument = HydratedDocument<OtpRequest>;

export enum OtpRequestStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  VERIFIED = 'verified',
  EXPIRED = 'expired',
  LOCKED = 'locked',
  SUPERSEDED = 'superseded',
}

@Schema({
  timestamps: true,
  collection: 'otp_requests',
})
export class OtpRequest {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ default: 'login' })
  purpose: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true, min: 4, max: 10 })
  codeLength: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true, default: 0 })
  attempts: number;

  @Prop({ required: true, default: 3 })
  maxAttempts: number;

  @Prop({ required: true, enum: Object.values(OtpRequestStatus) })
  status: OtpRequestStatus;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ enum: Object.values(ProviderType), default: ProviderType.MOCK })
  providerType: ProviderType;

  @Prop({ type: String, default: null })
  providerMessageId: string | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  verifiedAt: Date | null;
}

export const OtpRequestSchema = SchemaFactory.createForClass(OtpRequest);

// Verify looks up the newest active code for a phone; send supersedes the previous ones.
// Without this index both scan the whole collection, which gets slow fast at volume.
OtpRequestSchema.index(
  { tenantId: 1, phoneNumber: 1, status: 1, createdAt: -1 },
  { name: 'otp_tenant_phone_status_recent' },
);

// Monthly quota counting and the usage reports.
OtpRequestSchema.index({ tenantId: 1, createdAt: -1 }, { name: 'otp_tenant_created' });

/**
 * Optional retention: set OTP_RETENTION_DAYS (e.g. 90) to have MongoDB delete old OTP
 * records automatically. Left off by default — enabling it deletes data permanently.
 */
const otpRetentionDays = Number(process.env.OTP_RETENTION_DAYS || 0);
if (otpRetentionDays > 0) {
  OtpRequestSchema.index(
    { createdAt: 1 },
    { name: 'otp_retention_ttl', expireAfterSeconds: otpRetentionDays * 86400 },
  );
}
