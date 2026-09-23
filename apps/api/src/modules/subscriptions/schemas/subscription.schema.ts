import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({
  timestamps: true,
  collection: 'subscriptions',
})
export class Subscription {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  planName: string;

  @Prop({ required: true, min: 1 })
  durationMonths: number;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;

  @Prop({ required: true, min: 1 })
  maxMonthlyOtp: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({ default: 'active', enum: ['active', 'expired', 'cancelled'] })
  status: 'active' | 'expired' | 'cancelled';

  @Prop({ default: '' })
  notes: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
