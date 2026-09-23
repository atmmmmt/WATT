import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type HrJobDocument = HydratedDocument<HrJob>;

export enum HrJobStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Schema({ timestamps: true, collection: 'hr_jobs' })
export class HrJob {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, lowercase: true, trim: true, unique: true })
  slug: string;

  @Prop({ default: '', trim: true })
  department: string;

  @Prop({ default: '', trim: true })
  city: string;

  @Prop({ default: '', trim: true })
  employmentType: string;

  @Prop({ default: '', trim: true })
  salaryRange: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ default: '', trim: true })
  requirements: string;

  @Prop({ default: HrJobStatus.OPEN, enum: Object.values(HrJobStatus) })
  status: HrJobStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  ownerUserId: Types.ObjectId | null;
}

export const HrJobSchema = SchemaFactory.createForClass(HrJob);
