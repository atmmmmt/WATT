import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type DoctorRelayMessageDocument = HydratedDocument<DoctorRelayMessage>;

export enum DoctorRelayMessageDirection {
  PATIENT_TO_DOCTOR = 'patient_to_doctor',
  DOCTOR_TO_PATIENT = 'doctor_to_patient',
}

export enum DoctorRelayMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  REJECTED_UNQUOTED = 'rejected_unquoted',
}

@Schema({
  timestamps: true,
  collection: 'doctor_relay_messages',
})
export class DoctorRelayMessage {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'DoctorRelayLink', required: true, index: true })
  linkId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(DoctorRelayMessageDirection) })
  direction: DoctorRelayMessageDirection;

  @Prop({ default: '' })
  body: string;

  // The id of the original message as received from the source side (patient or doctor).
  @Prop({ type: String, default: null, index: true })
  sourceWhatsappMessageId: string | null;

  // The id of the message this service sent to the destination side — used to
  // resolve a doctor's later quoted-reply back to this record.
  @Prop({ type: String, default: null, index: true })
  forwardedWhatsappMessageId: string | null;

  @Prop({
    required: true,
    enum: Object.values(DoctorRelayMessageStatus),
    default: DoctorRelayMessageStatus.PENDING,
  })
  status: DoctorRelayMessageStatus;

  @Prop({ type: String, default: null })
  errorMessage: string | null;
}

export const DoctorRelayMessageSchema = SchemaFactory.createForClass(DoctorRelayMessage);

DoctorRelayMessageSchema.index(
  { tenantId: 1, forwardedWhatsappMessageId: 1 },
  {
    name: 'doctor_relay_message_tenant_forwarded_id',
    partialFilterExpression: { forwardedWhatsappMessageId: { $type: 'string' } },
  },
);
