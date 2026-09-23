import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type HrApplicationDocument = HydratedDocument<HrApplication>;

export enum HrApplicationStage {
  NEW = 'new',
  CONTACTED = 'contacted',
  INTERVIEW = 'interview',
  OFFER = 'offer',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true, collection: 'hr_applications' })
export class HrApplication {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'HrJob', required: true, index: true })
  jobId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'HrCandidate', required: true, index: true })
  candidateId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null, index: true })
  assignedToUserId: Types.ObjectId | null;

  @Prop({ default: HrApplicationStage.NEW, enum: Object.values(HrApplicationStage) })
  stage: HrApplicationStage;

  @Prop({ default: 'public_form', trim: true })
  source: string;

  @Prop({ type: Date, default: null })
  firstResponseAt: Date | null;

  @Prop({ type: Date, default: null })
  lastActivityAt: Date | null;
}

export const HrApplicationSchema = SchemaFactory.createForClass(HrApplication);
