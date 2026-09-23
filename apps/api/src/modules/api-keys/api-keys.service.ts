import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { sha256, randomToken } from '../../common/utils/hash.util';
import { SubscriptionDocument } from '../subscriptions/schemas/subscription.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Tenant, TenantDocument, TenantProduct } from '../tenants/schemas/tenant.schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKey, ApiKeyDocument } from './schemas/api-key.schema';
import { TtlCache } from '../../common/utils/ttl-cache.util';

export interface TenantContext {
  tenantId: string;
  tenant: TenantDocument | null;
  subscription: SubscriptionDocument;
  apiKeyId: string;
  scopes: string[];
  enabledProducts: TenantProduct[];
}

const API_KEY_CACHE_TTL_MS = Number(process.env.API_KEY_CACHE_TTL_MS || 60000);
const LAST_USED_WRITE_INTERVAL_MS = 60000;

@Injectable()
export class ApiKeysService {
  private readonly contextCache = new TtlCache<{
    context: TenantContext | null;
    apiKeyId: string | null;
  }>(API_KEY_CACHE_TTL_MS);
  private readonly lastUsedWrites = new Map<string, number>();

  constructor(
    @InjectModel(ApiKey.name)
    private readonly apiKeyModel: Model<ApiKeyDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  async createKey(dto: CreateApiKeyDto) {
    const rawKey = `vayro_${randomToken(18)}`;
    const keyPrefix = rawKey.slice(0, 16);

    const apiKey = await this.apiKeyModel.create({
      tenantId: new Types.ObjectId(dto.tenantId),
      name: dto.name,
      keyPrefix,
      secretHash: sha256(rawKey),
      scopes: dto.scopes || ['otp:send', 'otp:verify', 'whatsapp:session'],
      status: 'active',
    });

    const publicUrl = this.configService.get<string>('appPublicUrl');

    return {
      apiKey: {
        id: apiKey.id,
        tenantId: dto.tenantId,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        status: apiKey.status,
      },
      rawKey,
      setupPackage: {
        apiBaseUrl: publicUrl,
        docsUrl: `${publicUrl}/docs`,
        headers: {
          'x-api-key': rawKey,
        },
        endpoints: {
          sendOtp: `${publicUrl}/v1/otp/send`,
          verifyOtp: `${publicUrl}/v1/otp/verify`,
          sessionStart: `${publicUrl}/v1/whatsapp/session/start`,
          sessionStatus: `${publicUrl}/v1/whatsapp/session/status`,
          sessionDisconnect: `${publicUrl}/v1/whatsapp/session/disconnect`,
        },
      },
    };
  }

  async listForTenant(tenantId: string) {
    return this.apiKeyModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async listAll() {
    return this.apiKeyModel.find().sort({ createdAt: -1 }).lean();
  }

  async countApiKeys() {
    return this.apiKeyModel.countDocuments();
  }

  /**
   * Called on every API request. Previously it ran four queries plus a write (`lastUsedAt`)
   * every single time; now the resolved context is cached briefly and the "last used"
   * timestamp is written at most once per minute per key.
   */
  async validateRawKey(rawKey: string): Promise<TenantContext | null> {
    const cacheKey = sha256(rawKey);
    const cached = this.contextCache.get(cacheKey);
    if (cached !== undefined) {
      this.touchKey(cached.apiKeyId);
      return cached.context;
    }

    const keyPrefix = rawKey.slice(0, 16);
    const apiKey = await this.apiKeyModel.findOne({
      keyPrefix,
      status: 'active',
    });

    if (!apiKey || apiKey.secretHash !== cacheKey) {
      // Negative results are cached too, so a flood of bad keys can't hammer the database.
      this.contextCache.set(cacheKey, { context: null, apiKeyId: null });
      return null;
    }

    const tenant = await this.tenantModel.findById(apiKey.tenantId);
    if (!tenant || tenant.status !== 'active') {
      this.contextCache.set(cacheKey, { context: null, apiKeyId: null });
      return null;
    }

    const subscription = await this.subscriptionsService.findActiveByTenant(
      tenant.id,
    );

    if (!subscription) {
      this.contextCache.set(cacheKey, { context: null, apiKeyId: null });
      return null;
    }

    const context: TenantContext = {
      tenantId: tenant.id,
      tenant,
      subscription,
      apiKeyId: apiKey.id,
      scopes: apiKey.scopes,
      enabledProducts: tenant.enabledProducts || [TenantProduct.OTP],
    };

    this.contextCache.set(cacheKey, { context, apiKeyId: apiKey.id });
    this.touchKey(apiKey.id);
    return context;
  }

  /** Records key usage at most once per minute instead of on every request. */
  private touchKey(apiKeyId: string | null) {
    if (!apiKeyId) return;
    const now = Date.now();
    const last = this.lastUsedWrites.get(apiKeyId) || 0;
    if (now - last < LAST_USED_WRITE_INTERVAL_MS) return;
    this.lastUsedWrites.set(apiKeyId, now);
    this.apiKeyModel
      .updateOne({ _id: apiKeyId }, { $set: { lastUsedAt: new Date() } })
      .catch(() => {
        // Usage tracking must never fail a request.
      });
  }

  async buildDashboardTenantContext(tenantId: string): Promise<TenantContext> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new Error('Tenant is not active');
    }

    const subscription = await this.subscriptionsService.findActiveByTenant(tenantId);
    if (!subscription) {
      throw new Error('Tenant has no active subscription');
    }

    return {
      tenantId,
      tenant,
      subscription,
      apiKeyId: 'dashboard',
      scopes: ['otp:send', 'otp:verify'],
      enabledProducts: tenant.enabledProducts || [TenantProduct.OTP],
    };
  }
}
