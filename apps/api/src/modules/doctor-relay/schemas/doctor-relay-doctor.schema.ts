import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type DoctorRelayDoctorDocument = HydratedDocument<DoctorRelayDoctor>;

export enum DoctorRelayPersonStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Schema({
  timestamps: true,
  collection: 'doctor_relay_doctors',
})
export class DoctorRelayDoctor {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ default: '', trim: true })
  specialty: string;

  @Prop({
    required: true,
    enum: Object.values(DoctorRelayPersonStatus),
    default: DoctorRelayPersonStatus.ACTIVE,
  })
  status: DoctorRelayPersonStatus;
}

export const DoctorRelayDoctorSchema = SchemaFactory.createForClass(DoctorRelayDoctor);

DoctorRelayDoctorSchema.index(
  { tenantId: 1, phone: 1 },
  { unique: true, name: 'doctor_relay_doctor_tenant_phone_unique' },
);
