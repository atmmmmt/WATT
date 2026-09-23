import { Injectable } from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { OtpService } from '../otp/otp.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ProvidersService } from '../providers/providers.service';
import { WhatsappSessionsService } from '../whatsapp-sessions/whatsapp-sessions.service';
import { DashboardTestSendDto } from './dto/dashboard-test-send.dto';
import { DashboardTestVerifyDto } from './dto/dashboard-test-verify.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly apiKeysService: ApiKeysService,
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly providersService: ProvidersService,
    private readonly whatsappSessionsService: WhatsappSessionsService,
  ) {}

  async summary(user: { role: UserRole; tenantId: string | null }) {
    const tenantId =
      user.role === UserRole.TENANT_ADMIN ? (user.tenantId as string) : undefined;

    if (tenantId) {
      return {
        scope: 'tenant',
        tenantId,
        stats: {
          otpThisMonth: await this.otpService.countThisMonth(tenantId),
          apiKeys: (await this.apiKeysService.listForTenant(tenantId)).length,
          subscriptions: (await this.subscriptionsService.listForUser(user)).length,
          users: 1,
        },
      };
    }

    return {
      scope: 'platform',
      stats: {
        tenants: await this.tenantsService.countTenants(),
        activeSubscriptions: await this.subscriptionsService.countActiveSubscriptions(),
        apiKeys: await this.apiKeysService.countApiKeys(),
        otpThisMonth: await this.otpService.countThisMonth(),
        users: await this.usersService.countUsers(),
      },
    };
  }

  async workspace(
    user: { role: UserRole; tenantId: string | null },
    requestedTenantId?: string,
  ) {
    const tenantId =
      user.role === UserRole.TENANT_ADMIN
        ? (user.tenantId as string)
        : requestedTenantId || undefined;

    const tenants = await this.tenantsService.listForUser(user);
    const subscriptions = await this.subscriptionsService.listForUser(user);
    const apiKeys =
      tenantId && user.role === UserRole.SUPER_ADMIN
        ? await this.apiKeysService.listForTenant(tenantId)
        : user.role === UserRole.TENANT_ADMIN
          ? await this.apiKeysService.listForTenant(tenantId as string)
          : await this.apiKeysService.listAll();
    const providers =
      tenantId && user.role === UserRole.SUPER_ADMIN
        ? await this.providersService.listForTenant(tenantId)
        : user.role === UserRole.TENANT_ADMIN
          ? await this.providersService.listForTenant(tenantId as string)
          : await this.providersService.listAll();
    const selectedTenantId = tenantId || '';
    const selectedTenant = selectedTenantId
      ? await this.tenantsService.findById(selectedTenantId)
      : null;

    const effectiveTenantId = selectedTenantId || undefined;
    const filteredSubscriptions = effectiveTenantId
      ? subscriptions.filter(
          (item) => String(item.tenantId) === effectiveTenantId,
        )
      : subscriptions;
    const latestSetupPackage = effectiveTenantId
      ? await this.tenantsService.buildSetupPackage(effectiveTenantId)
      : null;
    const whatsappSession = effectiveTenantId
      ? await this.whatsappSessionsService.getSession(effectiveTenantId)
      : null;

    const totalRevenue = await this.subscriptionsService.totalRevenue(
      effectiveTenantId || undefined,
    );
    const otpThisMonth = await this.otpService.countThisMonth(
      effectiveTenantId || undefined,
    );

    return {
      summary: {
        totalRevenue,
        salesCount: filteredSubscriptions.length,
        activeSubscriptions:
          effectiveTenantId
            ? filteredSubscriptions.filter((item) => item.status === 'active').length
            : user.role === UserRole.SUPER_ADMIN
            ? await this.subscriptionsService.countActiveSubscriptions()
            : filteredSubscriptions.filter((item) => item.status === 'active').length,
        tenants: tenants.length,
        otpThisMonth,
        apiKeys: apiKeys.length,
      },
      charts: {
        revenue: await this.subscriptionsService.revenueSeries(
          effectiveTenantId || undefined,
        ),
        plans: await this.subscriptionsService.planBreakdown(
          effectiveTenantId || undefined,
        ),
        otp: await this.otpService.monthlyUsageSeries(
          effectiveTenantId || undefined,
        ),
        otpStatuses: await this.otpService.statusBreakdown(
          effectiveTenantId || undefined,
        ),
      },
      workflow: {
        tenants,
        subscriptions: filteredSubscriptions,
        apiKeys,
        providers,
        selectedTenant,
        latestSetupPackage,
        whatsappSession,
        recentOtpLogs: await this.otpService.listRequests(
          effectiveTenantId || undefined,
        ),
      },
    };
  }

  async sendTestOtp(
    user: { role: UserRole; tenantId: string | null },
    dto: DashboardTestSendDto,
  ) {
    const tenantId =
      user.role === UserRole.TENANT_ADMIN ? (user.tenantId as string) : dto.tenantId;
    const tenantContext = await this.apiKeysService.buildDashboardTenantContext(
      tenantId,
    );

    return this.otpService.sendOtp(tenantContext, {
      phoneNumber: dto.phoneNumber,
      purpose: dto.purpose,
      metadata: dto.metadata,
    });
  }

  async verifyTestOtp(
    user: { role: UserRole; tenantId: string | null },
    dto: DashboardTestVerifyDto,
  ) {
    const tenantId =
      user.role === UserRole.TENANT_ADMIN ? (user.tenantId as string) : dto.tenantId;
    const tenantContext = await this.apiKeysService.buildDashboardTenantContext(
      tenantId,
    );

    return this.otpService.verifyOtp(tenantContext, {
      phoneNumber: dto.phoneNumber,
      code: dto.code,
      purpose: dto.purpose,
    });
  }
}
