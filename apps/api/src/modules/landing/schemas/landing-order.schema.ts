import { HydratedDocument, SchemaTypes } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LandingOrderDocument = HydratedDocument<LandingOrder>;

export enum LandingOrderStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  WON = 'won',
  LOST = 'lost',
}

@Schema({
  timestamps: true,
  collection: 'landing_orders',
})
export class LandingOrder {
  @Prop({ required: true, trim: true })
  planId: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  planSnapshot: Record<string, unknown>;

  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ required: true, trim: true })
  companyName: string;

  @Prop({ required: true, trim: true })
  phoneNumber: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, default: '', trim: true })
  website: string;

  @Prop({ type: String, default: '', trim: true })
  useCase: string;

  @Prop({ type: String, default: '', trim: true })
  notes: string;

  @Prop({
    enum: Object.values(LandingOrderStatus),
    default: LandingOrderStatus.NEW,
  })
  status: LandingOrderStatus;

  @Prop({ type: String, default: 'landing', trim: true })
  source: string;

  @Prop({ type: String, default: 'ar', trim: true })
  language: string;

  @Prop({ required: true })
  whatsappMessage: string;

  @Prop({ required: true })
  whatsappUrl: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;
}

export const LandingOrderSchema = SchemaFactory.createForClass(LandingOrder);

LandingOrderSchema.index({ createdAt: -1 });
LandingOrderSchema.index({ status: 1, createdAt: -1 });
LandingOrderSchema.index({ phoneNumber: 1, planId: 1, createdAt: -1 });
