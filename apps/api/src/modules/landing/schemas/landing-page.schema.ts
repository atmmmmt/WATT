import { HydratedDocument, SchemaTypes } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LandingPageDocument = HydratedDocument<LandingPage>;

@Schema({
  timestamps: true,
  collection: 'landing_pages',
})
export class LandingPage {
  @Prop({ required: true, unique: true, default: 'main' })
  key: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  brand: Record<string, unknown>;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  hero: Record<string, unknown>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  stats: Array<Record<string, unknown>>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  features: Array<Record<string, unknown>>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  plans: Array<Record<string, unknown>>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  testimonials: Array<Record<string, unknown>>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  faqs: Array<Record<string, unknown>>;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  whatsapp: Record<string, unknown>;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  finalCta: Record<string, unknown>;

  @Prop({ type: Boolean, default: true })
  isPublished: boolean;
}

export const LandingPageSchema = SchemaFactory.createForClass(LandingPage);
