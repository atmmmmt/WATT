import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TtlCache } from '../../common/utils/ttl-cache.util';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/schemas/user.schema';
import { ProvidersService } from '../providers/providers.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ProviderType } from '../providers/schemas/provider-account.schema';
import { WhatsappSessionsService } from '../whatsapp-sessions/whatsapp-sessions.service';
import { MailerService } from '../mailer/mailer.service';
import { Tenant, TenantDocument, TenantProduct } from './schemas/tenant.schema';
import { CreateTenantDto } from './dto/create-tenant.dto';
import {
  getEffectiveOtpTemplate,
  getOtpTemplatesFromSettings,
  OTP_REQUIRED_PLACEHOLDER,
  OTP_TEMPLATE_LABELS,
  OTP_OPTIONAL_PLACEHOLDERS,
  OtpTemplateKey,
  OtpTemplateOverrides,
} from '../otp/otp-template.util';

/**
 * Tenant documents are read on nearly every request (product checks, support settings,
 * OTP templates) and change rarely. Cached briefly; writes through this service
 * invalidate immediately, so the only staleness window is for writes made elsewhere.
 */
const TENANT_CACHE_TTL_MS = Number(process.env.TENANT_CACHE_TTL_MS || 30000);

@Injectable()
export class TenantsService {
  private readonly tenantCache = new TtlCache<Record<string, any>>(TENANT_CACHE_TTL_MS);

  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    private readonly usersService: UsersService,
    private readonly providersService: ProvidersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly whatsappSessionsService: WhatsappSessionsService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateTenantDto) {
    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.tenantModel.findOne({ slug }).lean();

    if (existing) {
      throw new ConflictException('A tenant with this slug already exists');
    }

    const otpTemplates = this.normalizeOtpTemplates(dto.otpTemplates);
    const tenant = await this.tenantModel.create({
      name: dto.name,
      slug,
      contactEmail: dto.contactEmail.toLowerCase(),
      allowedOrigins: dto.allowedOrigins || [],
      enabledProducts: dto.enabledProducts?.length
        ? dto.enabledProducts
        : [TenantProduct.OTP],
      settings: otpTemplates ? { otpTemplates } : {},
      status: 'active',
    });

    await this.providersService.upsertForTenant({
      tenantId: tenant.id,
      providerType: ProviderType.MOCK,
      status: 'active',
      config: {},
    });

    let tenantAdmin = null;
    if (dto.adminEmail) {
      const dashboardOrigin = this.configService.get<string>('dashboardOrigin') || '';
      if (dto.adminPassword) {
        // Admin provided password manually
        tenantAdmin = await this.usersService.createUser({
          email: dto.adminEmail,
          password: dto.adminPassword,
          name: dto.adminName || dto.name,
          role: UserRole.TENANT_ADMIN,
          tenantId: tenant.id,
        });
      } else {
        // Send invite email so tenant admin sets their own password
        const { user: newAdmin, inviteToken } = await this.usersService.createUserForInvite({
          email: dto.adminEmail,
          name: dto.adminName || dto.name,
          role: UserRole.TENANT_ADMIN,
          tenantId: tenant.id,
        });
        tenantAdmin = newAdmin;
        const setPasswordUrl = `${dashboardOrigin}/set-password?token=${inviteToken}`;
        await this.mailerService.sendWelcomeWithCredentials({
          to: newAdmin.email,
          name: newAdmin.name,
          companyName: tenant.name,
          email: newAdmin.email,
          setPasswordUrl,
        });
      }
    }

    return {
      tenant,
      tenantAdmin,
    };
  }

  async listForUser(user: { role: UserRole; tenantId: string | null }) {
    const tenants =
      user.role === UserRole.SUPER_ADMIN
        ? await this.tenantModel.find().sort({ createdAt: -1 }).lean()
        : await this.tenantModel
            .find({ _id: new Types.ObjectId(user.tenantId as string) })
            .lean();

    return Promise.all(
      tenants.map(async (tenant) => {
        const tenantId = String(tenant._id);
        const [subscription, provider, whatsappSession] = await Promise.all([
          this.subscriptionsService.findActiveByTenant(tenantId),
          this.providersService.getActiveProviderForTenant(tenantId),
          this.whatsappSessionsService.getSession(tenantId),
        ]);

        return {
          ...tenant,
          subscription: subscription
            ? {
                planName: subscription.planName,
                price: subscription.price,
                currency: subscription.currency,
                endsAt: subscription.endsAt,
                maxMonthlyOtp: subscription.maxMonthlyOtp,
              }
            : null,
          provider: provider
            ? {
                providerType: provider.providerType,
                status: provider.status,
              }
            : null,
          whatsappSession: whatsappSession
            ? {
                status: whatsappSession.status,
                phoneNumber: whatsappSession.phoneNumber,
                displayName: whatsappSession.displayName,
                lastReadyAt: whatsappSession.lastReadyAt,
              }
            : null,
        };
      }),
    );
  }

  async findById(tenantId: string) {
    const cached = this.tenantCache.get(tenantId);
    if (cached) {
      return cached as any;
    }

    const tenant = await this.tenantModel.findById(tenantId).lean();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    this.tenantCache.set(tenantId, tenant as Record<string, any>);
    return tenant;
  }

  /** Call after any write that changes a tenant document. */
  invalidateTenantCache(tenantId: string) {
    this.tenantCache.invalidate(String(tenantId));
  }

  async findBySlug(slug: string) {
    return this.tenantModel.findOne({ slug: slug.trim().toLowerCase() }).lean();
  }

  async updateProducts(tenantId: string, enabledProducts: TenantProduct[]) {
    const tenant = await this.tenantModel.findByIdAndUpdate(
      tenantId,
      { enabledProducts },
      { new: true },
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    this.invalidateTenantCache(tenantId);
    return tenant;
  }

  async updateSettings(tenantId: string, settings: Record<string, unknown>) {
    const tenant = await this.tenantModel.findByIdAndUpdate(
      tenantId,
      { settings },
      { new: true },
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    this.invalidateTenantCache(tenantId);
    return tenant;
  }

  async deleteTenant(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId).lean();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const db = this.tenantModel.db;

    this.invalidateTenantCache(tenantId);
    await this.whatsappSessionsService.purgeTenantSession(tenantId);

    const tenantBoundCollections = [
      'api_keys',
      'provider_accounts',
      'subscriptions',
      'licenses',
      'otp_requests',
      'users',
      'whatsapp_sessions',
      'hr_jobs',
      'hr_candidates',
      'hr_applications',
      'hr_timeline_events',
      'hr_message_templates',
    ];

    const companyBoundCollections = [
      'support_conversations',
      'support_messages',
      'support_internal_notes',
      'support_activity_logs',
      'support_quick_replies',
      'support_tags',
    ];

    await Promise.all(
      tenantBoundCollections.map((collectionName) =>
        db.collection(collectionName).deleteMany({ tenantId: tenantObjectId }),
      ),
    );

    await Promise.all(
      companyBoundCollections.map((collectionName) =>
        db.collection(collectionName).deleteMany({ companyId: tenantObjectId }),
      ),
    );

    await this.tenantModel.deleteOne({ _id: tenantObjectId });

    return {
      success: true,
      deletedTenantId: tenantId,
      deletedTenantName: tenant.name,
    };
  }

  async countTenants() {
    return this.tenantModel.countDocuments();
  }

  async buildSetupPackage(tenantId: string) {
    const tenant = await this.findById(tenantId);
    const provider = await this.providersService.getActiveProviderForTenant(tenantId);
    const tenantAdmin = await this.usersService.findPrimaryTenantAdmin(tenantId);
    const dashboardUrl =
      this.configService.get<string>('dashboardOrigin') || 'http://localhost:5173';

    return {
      tenant: {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        contactEmail: tenant.contactEmail,
        status: tenant.status,
        allowedOrigins: tenant.allowedOrigins,
        enabledProducts: tenant.enabledProducts || [TenantProduct.OTP],
        settings: tenant.settings || {},
      },
      provider: {
        providerType: provider.providerType,
        status: provider.status,
      },
      portal: {
        dashboardUrl,
        loginEmail: tenantAdmin?.email || tenant.contactEmail,
        loginName: tenantAdmin?.name || tenant.name,
        role: tenantAdmin?.role || UserRole.TENANT_ADMIN,
      },
      otpTemplates: {
        labels: OTP_TEMPLATE_LABELS,
        placeholders: {
          required: [OTP_REQUIRED_PLACEHOLDER],
          optional: OTP_OPTIONAL_PLACEHOLDERS,
        },
        configured: getOtpTemplatesFromSettings(tenant.settings || {}),
        effective: {
          login: getEffectiveOtpTemplate(tenant.settings || {}, 'login'),
          register: getEffectiveOtpTemplate(tenant.settings || {}, 'register'),
          forgotPassword: getEffectiveOtpTemplate(
            tenant.settings || {},
            'forgotPassword',
          ),
        },
      },
      integration: {
        sendOtpEndpoint: '/v1/otp/send',
        verifyOtpEndpoint: '/v1/otp/verify',
        authHeader: 'x-api-key',
      },
    };
  }

  private normalizeOtpTemplates(
    templates?: CreateTenantDto['otpTemplates'],
  ): OtpTemplateOverrides | undefined {
    if (!templates || typeof templates !== 'object') {
      return undefined;
    }

    const result: OtpTemplateOverrides = {};
    (['login', 'register', 'forgotPassword'] as OtpTemplateKey[]).forEach((key) => {
      const rawValue = String(templates[key] || '').trim();
      if (!rawValue) {
        return;
      }

      if (!rawValue.includes(OTP_REQUIRED_PLACEHOLDER)) {
        throw new BadRequestException(
          `قالب "${OTP_TEMPLATE_LABELS[key]}" يجب أن يحتوي على ${OTP_REQUIRED_PLACEHOLDER}`,
        );
      }

      result[key] = rawValue;
    });

    return Object.keys(result).length ? result : undefined;
  }
}
