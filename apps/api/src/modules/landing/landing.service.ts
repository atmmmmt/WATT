import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateLandingOrderDto } from './dto/create-landing-order.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { UpdateLandingOrderStatusDto } from './dto/update-landing-order-status.dto';
import { DEFAULT_LANDING_PAGE } from './landing.defaults';
import {
  LandingOrder,
  LandingOrderDocument,
  LandingOrderStatus,
} from './schemas/landing-order.schema';
import { LandingPage, LandingPageDocument } from './schemas/landing-page.schema';

@Injectable()
export class LandingService {
  constructor(
    @InjectModel(LandingPage.name)
    private readonly landingPageModel: Model<LandingPageDocument>,
    @InjectModel(LandingOrder.name)
    private readonly landingOrderModel: Model<LandingOrderDocument>,
  ) {}

  async getPublicPage() {
    const page = await this.getOrCreatePage();
    return this.mergeWithDefaults(page as Record<string, unknown>);
  }

  async getAdminPage() {
    const page = await this.getOrCreatePage();
    return this.mergeWithDefaults(page as Record<string, unknown>);
  }

  async updatePage(dto: UpdateLandingPageDto) {
    const allowedPayload: UpdateLandingPageDto = {};
    const keys: Array<keyof UpdateLandingPageDto> = [
      'brand',
      'hero',
      'stats',
      'features',
      'plans',
      'testimonials',
      'faqs',
      'whatsapp',
      'finalCta',
      'isPublished',
    ];

    keys.forEach((key) => {
      if (dto[key] !== undefined) {
        (allowedPayload as Record<string, unknown>)[key] = dto[key];
      }
    });

    const page = await this.landingPageModel.findOneAndUpdate(
      { key: 'main' },
      {
        key: 'main',
        ...allowedPayload,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return this.mergeWithDefaults(page.toObject() as unknown as Record<string, unknown>);
  }

  async createOrder(dto: CreateLandingOrderDto) {
    const page = await this.getPublicPage();
    const plans = Array.isArray(page.plans)
      ? (page.plans as Array<Record<string, unknown>>)
      : [];
    const plan = plans.find((item) => String(item.id) === dto.planId);

    if (!plan) {
      throw new BadRequestException('Selected plan is not available');
    }

    const whatsappSettings = (page.whatsapp || {}) as Record<string, unknown>;
    const recipientPhone = String(whatsappSettings.phoneNumber || '').replace(
      /[^\d]/g,
      '',
    );

    if (!recipientPhone) {
      throw new BadRequestException('Order WhatsApp number is not configured');
    }

    const whatsappMessage = this.buildOrderWhatsappMessage(
      dto,
      plan,
      String(whatsappSettings.message || ''),
    );
    const whatsappUrl = `https://wa.me/${recipientPhone}?text=${encodeURIComponent(
      whatsappMessage,
    )}`;

    const order = await this.landingOrderModel.create({
      planId: dto.planId,
      planSnapshot: plan,
      customerName: dto.customerName.trim(),
      companyName: dto.companyName.trim(),
      phoneNumber: dto.phoneNumber.trim(),
      email: dto.email.trim().toLowerCase(),
      website: dto.website?.trim() || '',
      useCase: dto.useCase?.trim() || '',
      notes: dto.notes?.trim() || '',
      language: dto.language?.trim() || 'ar',
      status: LandingOrderStatus.NEW,
      source: 'landing',
      whatsappMessage,
      whatsappUrl,
      metadata: dto.metadata || {},
    });

    const saved = order.toObject() as unknown as Record<string, unknown>;
    return {
      order: {
        id: String(saved._id),
        status: saved.status,
        planId: saved.planId,
        customerName: saved.customerName,
        companyName: saved.companyName,
        createdAt: saved.createdAt,
      },
      whatsappUrl,
      whatsappMessage,
    };
  }

  async listOrders(status?: LandingOrderStatus) {
    const query = status ? { status } : {};
    const orders = await this.landingOrderModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    return orders.map((order) => ({
      ...order,
      id: String(order._id),
      _id: String(order._id),
    }));
  }

  async updateOrderStatus(orderId: string, dto: UpdateLandingOrderStatusDto) {
    const order = await this.landingOrderModel.findByIdAndUpdate(
      orderId,
      { status: dto.status },
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Landing order not found');
    }

    const saved = order.toObject() as unknown as Record<string, unknown>;
    return {
      ...saved,
      id: String(saved._id),
      _id: String(saved._id),
    };
  }

  private async getOrCreatePage() {
    const existing = await this.landingPageModel.findOne({ key: 'main' }).lean();
    if (existing) {
      return existing;
    }

    const created = await this.landingPageModel.create({
      key: 'main',
      ...DEFAULT_LANDING_PAGE,
    });

    return created.toObject();
  }

  private mergeWithDefaults(page: Record<string, unknown>) {
    return {
      ...DEFAULT_LANDING_PAGE,
      ...page,
      brand: {
        ...DEFAULT_LANDING_PAGE.brand,
        ...((page.brand as Record<string, unknown>) || {}),
      },
      hero: {
        ...DEFAULT_LANDING_PAGE.hero,
        ...((page.hero as Record<string, unknown>) || {}),
      },
      whatsapp: {
        ...DEFAULT_LANDING_PAGE.whatsapp,
        ...((page.whatsapp as Record<string, unknown>) || {}),
      },
      finalCta: {
        ...DEFAULT_LANDING_PAGE.finalCta,
        ...((page.finalCta as Record<string, unknown>) || {}),
      },
      stats: Array.isArray(page.stats) ? page.stats : DEFAULT_LANDING_PAGE.stats,
      features: Array.isArray(page.features)
        ? page.features
        : DEFAULT_LANDING_PAGE.features,
      plans: Array.isArray(page.plans) ? page.plans : DEFAULT_LANDING_PAGE.plans,
      testimonials: Array.isArray(page.testimonials)
        ? page.testimonials
        : DEFAULT_LANDING_PAGE.testimonials,
      faqs: Array.isArray(page.faqs) ? page.faqs : DEFAULT_LANDING_PAGE.faqs,
    };
  }

  private buildOrderWhatsappMessage(
    dto: CreateLandingOrderDto,
    plan: Record<string, unknown>,
    template: string,
  ) {
    const priceParts = [
      plan.currency ? String(plan.currency) : '',
      plan.price ? String(plan.price) : '',
      plan.period ? `/ ${String(plan.period)}` : '',
    ].filter(Boolean);
    const price = priceParts.join(' ') || 'غير محدد';
    const intro = template.trim()
      ? template
          .replaceAll('{{planName}}', String(plan.name || dto.planId))
          .replaceAll('{{price}}', String(plan.price || ''))
          .replaceAll('{{currency}}', String(plan.currency || ''))
          .replaceAll('{{period}}', String(plan.period || ''))
          .replaceAll('{{customerName}}', dto.customerName.trim())
          .replaceAll('{{companyName}}', dto.companyName.trim())
          .replaceAll('{{phoneNumber}}', dto.phoneNumber.trim())
          .replaceAll('{{email}}', dto.email.trim().toLowerCase())
      : '';

    const lines: Array<string | null> = [
      'طلب اشتراك جديد من صفحة VAYRO',
      intro ? '' : null,
      intro || null,
      '',
      `الخدمة: ${String(plan.name || dto.planId)}`,
      `السعر: ${price}`,
      '',
      `اسم العميل: ${dto.customerName.trim()}`,
      `الشركة: ${dto.companyName.trim()}`,
      `الهاتف: ${dto.phoneNumber.trim()}`,
      `البريد: ${dto.email.trim().toLowerCase()}`,
      dto.website?.trim() ? `الموقع: ${dto.website.trim()}` : null,
      dto.useCase?.trim() ? `الاستخدام المطلوب: ${dto.useCase.trim()}` : null,
      dto.notes?.trim() ? `ملاحظات: ${dto.notes.trim()}` : null,
      '',
      'تم حفظ الطلب داخل لوحة الإدارة.',
    ];

    return lines.filter((line) => line !== null).join('\n');
  }
}
