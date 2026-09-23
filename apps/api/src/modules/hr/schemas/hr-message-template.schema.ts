import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type HrMessageTemplateDocument = HydratedDocument<HrMessageTemplate>;

@Schema({ timestamps: true, collection: 'hr_message_templates' })
export class HrMessageTemplate {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: 'general', trim: true })
  stage: string;

  @Prop({ required: true, trim: true })
  body: string;

  @Prop({ default: 'active', enum: ['active', 'archived'] })
  status: 'active' | 'archived';
}

export const HrMessageTemplateSchema = SchemaFactory.createForClass(HrMessageTemplate);
