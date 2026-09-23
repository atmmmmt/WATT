import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SupportActivityLogDocument = HydratedDocument<SupportActivityLog>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'support_activity_logs',
})
export class SupportActivityLog {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId | null;

  @Prop({ required: true })
  action: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'SupportConversation', default: null })
  conversationId: Types.ObjectId | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const SupportActivityLogSchema =
  SchemaFactory.createForClass(SupportActivityLog);
