import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

@Schema({
  timestamps: true,
  collection: 'api_keys',
})
export class ApiKey {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  keyPrefix: string;

  @Prop({ required: true })
  secretHash: string;

  @Prop({
    type: [String],
    default: ['otp:send', 'otp:verify', 'whatsapp:session'],
  })
  scopes: string[];

  @Prop({ default: 'active', enum: ['active', 'revoked'] })
  status: 'active' | 'revoked';

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
