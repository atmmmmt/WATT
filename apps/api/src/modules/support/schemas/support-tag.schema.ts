import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SupportTagDocument = HydratedDocument<SupportTag>;

@Schema({
  timestamps: true,
  collection: 'support_tags',
})
export class SupportTag {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: '#14532d' })
  color: string;
}

export const SupportTagSchema = SchemaFactory.createForClass(SupportTag);

SupportTagSchema.index(
  { companyId: 1, name: 1 },
  { unique: true, name: 'support_tag_company_name_unique' },
);
