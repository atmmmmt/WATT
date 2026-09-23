export class UpdateLandingPageDto {
  brand?: Record<string, unknown>;
  hero?: Record<string, unknown>;
  stats?: Array<Record<string, unknown>>;
  features?: Array<Record<string, unknown>>;
  plans?: Array<Record<string, unknown>>;
  testimonials?: Array<Record<string, unknown>>;
  faqs?: Array<Record<string, unknown>>;
  whatsapp?: Record<string, unknown>;
  finalCta?: Record<string, unknown>;
  isPublished?: boolean;
}
