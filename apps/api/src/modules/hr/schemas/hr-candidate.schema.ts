import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type HrCandidateDocument = HydratedDocument<HrCandidate>;

@Schema({ timestamps: true, collection: 'hr_candidates' })
export class HrCandidate {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, trim: true })
  phoneNumber: string;

  @Prop({ default: '', lowercase: true, trim: true })
  email: string;

  @Prop({ default: '', trim: true })
  city: string;

  @Prop({ default: '', trim: true })
  experience: string;

  @Prop({ default: '', trim: true })
  expectedSalary: string;

  @Prop({ default: '', trim: true })
  cvUrl: string;

  @Prop({ default: '', trim: true })
  notes: string;

  @Prop({ default: 'public_form', trim: true })
  source: string;
}

export const HrCandidateSchema = SchemaFactory.createForClass(HrCandidate);
