import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SupportQuickReplyDocument = HydratedDocument<SupportQuickReply>;

@Schema({
  timestamps: true,
  collection: 'support_quick_replies',
})
export class SupportQuickReply {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: 'general' })
  category: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdByUserId: Types.ObjectId | null;
}

export const SupportQuickReplySchema =
  SchemaFactory.createForClass(SupportQuickReply);
