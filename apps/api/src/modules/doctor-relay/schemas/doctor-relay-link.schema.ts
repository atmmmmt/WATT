import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type DoctorRelayLinkDocument = HydratedDocument<DoctorRelayLink>;

export enum DoctorRelayLinkStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Schema({
  timestamps: true,
  collection: 'doctor_relay_links',
})
export class DoctorRelayLink {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  doctorPhone: string;

  @Prop({ default: '', trim: true })
  doctorName: string;

  @Prop({ required: true })
  doctorChatId: string;

  @Prop({ required: true, trim: true })
  patientPhone: string;

  @Prop({ default: '', trim: true })
  patientName: string;

  @Prop({ required: true })
  patientChatId: string;

  @Prop({ required: true, trim: true })
  patientLabel: string;

  @Prop({
    required: true,
    enum: Object.values(DoctorRelayLinkStatus),
    default: DoctorRelayLinkStatus.ACTIVE,
  })
  status: DoctorRelayLinkStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdByUserId: Types.ObjectId;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ default: '' })
  lastMessage: string;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;
}

export const DoctorRelayLinkSchema = SchemaFactory.createForClass(DoctorRelayLink);

DoctorRelayLinkSchema.index(
  { tenantId: 1, patientChatId: 1, status: 1 },
  { name: 'doctor_relay_link_tenant_patient_status' },
);

DoctorRelayLinkSchema.index(
  { tenantId: 1, doctorChatId: 1, status: 1 },
  { name: 'doctor_relay_link_tenant_doctor_status' },
);
