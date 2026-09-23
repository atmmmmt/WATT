import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { sha256 } from '../../common/utils/hash.util';
import { generateNumericCode } from '../../common/utils/random.util';
import { TenantContext } from '../api-keys/api-keys.service';
import { ProvidersService } from '../providers/providers.service';
import { ProviderType } from '../providers/schemas/provider-account.schema';
import { Tenant, TenantDocument } from '../tenants/schemas/tenant.schema';
import { SendOtpDto } from './dto/send-otp.dto';
import { UpdateOtpSettingsDto } from './dto/update-otp-settings.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { TwilioWhatsappProvider } from './providers/twilio-whatsapp.provider';
import { WhatsappWebProvider } from './providers/whatsapp-web.provider';
import {
  OtpRequest,
  OtpRequestDocument,
  OtpRequestStatus,
} from './schemas/otp-request.schema';
import {
  getEffectiveOtpTemplate,
  getOtpTemplatesFromSettings,
  OTP_REQUIRED_PLACEHOLDER,
  OTP_TEMPLATE_LABELS,
  OTP_OPTIONAL_PLACEHOLDERS,
  OtpTemplateKey,
  renderOtpTemplate,
  resolveOtpTemplateKey,
} from './otp-template.util';

@Injectable()
export class OtpService {
  private readonly otpExpiryMinutes = 5;
  private readonly maxAttempts = 3;
  private readonly otpLength = 6;

  constructor(
    @InjectModel(OtpRequest.name)
    private readonly otpRequestModel: Model<OtpRequestDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    private readonly providersService: ProvidersService,
    private readonly mockProvider: MockWhatsappProvider,
    private readonly twilioProvider: TwilioWhatsappProvider,
    private readonly whatsappWebProvider: WhatsappWebProvider,
  ) {}

  async sendOtp(tenantContext: TenantContext, dto: SendOtpDto) {
    await this.ensureQuota(tenantContext);

    await this.otpRequestModel.updateMany(
      {
        tenantId: new Types.ObjectId(tenantContext.tenantId),
        phoneNumber: dto.phoneNumber,
        purpose: dto.purpose || 'login',
        isVerified: false,
        status: OtpRequestStatus.SENT,
      },
      {
        status: OtpRequestStatus.SUPERSEDED,
      },
    );

    const code = generateNumericCode(this.otpLength);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.otpExpiryMinutes);

    const providerAccount = await this.providersService.getActiveProviderForTenant(
      tenantContext.tenantId,
    );

    const templateKey = resolveOtpTemplateKey(dto.purpose);
    const messageBody = this.buildOtpMessageBody(
      tenantContext,
      templateKey,
      dto,
      code,
    );

    const request = await this.otpRequestModel.create({
      tenantId: new Types.ObjectId(tenantContext.tenantId),
      phoneNumber: dto.phoneNumber,
      purpose: dto.purpose || 'login',
      codeHash: sha256(code),
      codeLength: this.otpLength,
      expiresAt,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      status: OtpRequestStatus.PENDING,
      isVerified: false,
      providerType: providerAccount.providerType,
      providerMessageId: null,
      metadata: dto.metadata || {},
      verifiedAt: null,
    });

    let sendResult: {
      providerType: ProviderType;
      providerMessageId?: string;
      debugCode?: string;
    };

    try {
      const provider = this.resolveProvider(providerAccount.providerType);
      sendResult = await provider.sendOtp({
        tenantId: tenantContext.tenantId,
        phoneNumber: dto.phoneNumber,
        code,
        expiresInMinutes: this.otpExpiryMinutes,
        purpose: dto.purpose || 'login',
        messageBody,
        config: providerAccount.config || {},
      });

      request.status = OtpRequestStatus.SENT;
      request.providerType = sendResult.providerType;
      request.providerMessageId = sendResult.providerMessageId || null;
      await request.save();
    } catch (error) {
      request.status = OtpRequestStatus.FAILED;
      await request.save();
      throw error;
    }

    return {
      message: 'OTP sent successfully',
      expiresInSeconds: this.otpExpiryMinutes * 60,
      requestId: request.id,
      provider: request.providerType,
      debugCode: sendResult.debugCode,
    };
  }

  async verifyOtp(tenantContext: TenantContext, dto: VerifyOtpDto) {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantContext.tenantId),
      phoneNumber: dto.phoneNumber,
      isVerified: false,
      status: OtpRequestStatus.SENT,
    };

    if (dto.purpose) {
      query.purpose = dto.purpose;
    }

    const request = await this.otpRequestModel
      .findOne(query)
      .sort({ createdAt: -1 });

    if (!request) {
      throw new NotFoundException('No active OTP found for this phone number');
    }

    if (new Date() > request.expiresAt) {
      request.status = OtpRequestStatus.EXPIRED;
      await request.save();
      throw new BadRequestException('OTP has expired');
    }

    if (request.attempts >= request.maxAttempts) {
      request.status = OtpRequestStatus.LOCKED;
      await request.save();
      throw new BadRequestException(
        'Maximum verification attempts exceeded for this code',
      );
    }

    if (request.codeHash !== sha256(dto.code)) {
      request.attempts += 1;
      if (request.attempts >= request.maxAttempts) {
        request.status = OtpRequestStatus.LOCKED;
      }

      await request.save();

      throw new BadRequestException(
        `Invalid OTP code. ${Math.max(request.maxAttempts - request.attempts, 0)} attempt(s) remaining.`,
      );
    }

    request.isVerified = true;
    request.status = OtpRequestStatus.VERIFIED;
    request.verifiedAt = new Date();
    await request.save();

    return {
      verified: true,
      message: 'OTP verified successfully',
    };
  }

  async listRequests(tenantId?: string) {
    const filter = tenantId
      ? { tenantId: new Types.ObjectId(tenantId) }
      : {};

    return this.otpRequestModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  }

  async countThisMonth(tenantId?: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const filter: Record<string, unknown> = {
      createdAt: { $gte: startOfMonth },
    };

    if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    return this.otpRequestModel.countDocuments(filter);
  }

  async monthlyUsageSeries(tenantId?: string) {
    const filter: Record<string, unknown> = {};
    if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    const rows = await this.otpRequestModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          sent: {
            $sum: {
              $cond: [{ $in: ['$status', ['sent', 'verified', 'expired', 'locked']] }, 1, 0],
            },
          },
          verified: {
            $sum: {
              $cond: [{ $eq: ['$status', 'verified'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return rows.map((row) => ({
      label: `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
      sent: row.sent,
      verified: row.verified,
    }));
  }

  async statusBreakdown(tenantId?: string) {
    const filter: Record<string, unknown> = {};
    if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    const rows = await this.otpRequestModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return rows.map((row) => ({
      status: row._id,
      count: row.count,
    }));
  }

  private async ensureQuota(tenantContext: TenantContext) {
    const used = await this.countThisMonth(tenantContext.tenantId);
    if (used >= tenantContext.subscription.maxMonthlyOtp) {
      throw new BadRequestException('Monthly OTP quota has been reached');
    }
  }

  private resolveProvider(providerType: ProviderType) {
    switch (providerType) {
      case ProviderType.TWILIO:
        return this.twilioProvider;
      case ProviderType.WHATSAPP_WEB:
        return this.whatsappWebProvider;
      case ProviderType.MOCK:
      default:
        return this.mockProvider;
    }
  }

  async getSettings(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const templates = getOtpTemplatesFromSettings(tenant.settings || {});

    return {
      templates: {
        login: templates.login || '',
        register: templates.register || '',
        forgotPassword: templates.forgotPassword || '',
      },
      effectiveTemplates: {
        login: getEffectiveOtpTemplate(tenant.settings || {}, 'login'),
        register: getEffectiveOtpTemplate(tenant.settings || {}, 'register'),
        forgotPassword: getEffectiveOtpTemplate(
          tenant.settings || {},
          'forgotPassword',
        ),
      },
      placeholders: {
        required: [OTP_REQUIRED_PLACEHOLDER],
        optional: OTP_OPTIONAL_PLACEHOLDERS,
      },
      labels: OTP_TEMPLATE_LABELS,
    };
  }

  async updateSettings(tenantId: string, dto: UpdateOtpSettingsDto) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const currentSettings =
      tenant.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
    const currentTemplates = getOtpTemplatesFromSettings(currentSettings);
    const nextTemplates = { ...currentTemplates };

    const templates = dto.templates || {};
    (['login', 'register', 'forgotPassword'] as OtpTemplateKey[]).forEach((key) => {
      if (!(key in templates)) {
        return;
      }

      const rawValue = String((templates as Record<string, string | undefined>)[key] || '');
      const normalized = rawValue.trim();

      if (!normalized) {
        delete nextTemplates[key];
        return;
      }

      if (!normalized.includes(OTP_REQUIRED_PLACEHOLDER)) {
        throw new BadRequestException(
          `قالب "${OTP_TEMPLATE_LABELS[key]}" يجب أن يحتوي على ${OTP_REQUIRED_PLACEHOLDER}`,
        );
      }

      nextTemplates[key] = normalized;
    });

    tenant.settings = {
      ...currentSettings,
      otpTemplates: nextTemplates,
    };

    await tenant.save();
    return this.getSettings(tenantId);
  }

  private buildOtpMessageBody(
    tenantContext: TenantContext,
    templateKey: OtpTemplateKey,
    dto: SendOtpDto,
    code: string,
  ) {
    const template = getEffectiveOtpTemplate(
      tenantContext.tenant?.settings || {},
      templateKey,
    );

    return renderOtpTemplate(template, {
      code,
      expiresInMinutes: this.otpExpiryMinutes,
      phoneNumber: dto.phoneNumber,
      purpose: dto.purpose || 'login',
    }).trim();
  }
}
