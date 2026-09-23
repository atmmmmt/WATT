import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type HrTimelineEventDocument = HydratedDocument<HrTimelineEvent>;

export enum HrTimelineEventType {
  APPLIED = 'applied',
  ASSIGNED = 'assigned',
  STAGE_CHANGED = 'stage_changed',
  MESSAGE_SENT = 'message_sent',
  NOTE = 'note',
}

@Schema({ timestamps: true, collection: 'hr_timeline_events' })
export class HrTimelineEvent {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'HrApplication', required: true, index: true })
  applicationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'HrCandidate', required: true, index: true })
  candidateId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdByUserId: Types.ObjectId | null;

  @Prop({ required: true, enum: Object.values(HrTimelineEventType) })
  type: HrTimelineEventType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '', trim: true })
  body: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const HrTimelineEventSchema = SchemaFactory.createForClass(HrTimelineEvent);
