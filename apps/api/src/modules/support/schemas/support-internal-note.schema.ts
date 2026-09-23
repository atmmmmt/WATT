import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SupportInternalNoteDocument = HydratedDocument<SupportInternalNote>;

@Schema({
  timestamps: true,
  collection: 'support_internal_notes',
})
export class SupportInternalNote {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'SupportConversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  note: string;
}

export const SupportInternalNoteSchema =
  SchemaFactory.createForClass(SupportInternalNote);
