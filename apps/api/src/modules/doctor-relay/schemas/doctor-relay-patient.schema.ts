import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DoctorRelayPersonStatus } from './doctor-relay-doctor.schema';

export type DoctorRelayPatientDocument = HydratedDocument<DoctorRelayPatient>;

@Schema({
  timestamps: true,
  collection: 'doctor_relay_patients',
})
export class DoctorRelayPatient {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ default: '', trim: true })
  notes: string;

  @Prop({
    required: true,
    enum: Object.values(DoctorRelayPersonStatus),
    default: DoctorRelayPersonStatus.ACTIVE,
  })
  status: DoctorRelayPersonStatus;
}

export const DoctorRelayPatientSchema = SchemaFactory.createForClass(DoctorRelayPatient);

DoctorRelayPatientSchema.index(
  { tenantId: 1, phone: 1 },
  { unique: true, name: 'doctor_relay_patient_tenant_phone_unique' },
);
