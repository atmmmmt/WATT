import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupportService } from '../modules/support/support.service';
import { SubscriptionsService } from '../modules/subscriptions/subscriptions.service';
import { TenantsService } from '../modules/tenants/tenants.service';
import { TenantProduct } from '../modules/tenants/schemas/tenant.schema';
import { UsersService } from '../modules/users/users.service';

async function bootstrap() {
  loadEnv({ path: '.env' });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const usersService = app.get(UsersService);
    const tenantsService = app.get(TenantsService);
    const subscriptionsService = app.get(SubscriptionsService);
    const supportService = app.get(SupportService);

    const platformAdmin = await usersService.ensureSuperAdmin(
      process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
      process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
      'Platform Admin',
    );

    const demoSlug = (process.env.SUPPORT_DEMO_SLUG || 'support-demo').toLowerCase();
    let tenant = await tenantsService.findBySlug(demoSlug);

    if (!tenant) {
      const created = await tenantsService.create({
        name: process.env.SUPPORT_DEMO_NAME || 'Support Demo Company',
        slug: demoSlug,
        contactEmail:
          process.env.SUPPORT_DEMO_CONTACT_EMAIL || 'owner@support-demo.local',
        allowedOrigins: ['http://localhost:5173', 'http://localhost:5174'],
        enabledProducts: [TenantProduct.OTP, TenantProduct.SUPPORT],
      });
      tenant = created.tenant.toObject();
      console.log(`Created support demo tenant: ${tenant.name}`);
    }

    const activeSubscription = await subscriptionsService.findActiveByTenant(
      String(tenant._id),
    );
    if (!activeSubscription) {
      await subscriptionsService.create({
        tenantId: String(tenant._id),
        planName: 'Support Annual',
        durationMonths: 12,
        maxMonthlyOtp: 5000,
        price: 499,
        currency: 'USD',
        notes: 'Seeded support demo subscription',
      });
    }

    const supportAdminContext = {
      ...platformAdmin,
      role: 'super_admin' as const,
      name: platformAdmin.name,
      email: platformAdmin.email,
      permissions: platformAdmin.permissions || [],
    };

    const employeeSeeds = [
      {
        name: 'Support Admin',
        email: process.env.SUPPORT_ADMIN_EMAIL || 'support-admin@example.com',
        phone: '+10000000001',
        password: process.env.SUPPORT_ADMIN_PASSWORD || 'SupportAdmin123!',
        role: 'admin' as const,
      },
      {
        name: 'Support Supervisor',
        email: process.env.SUPPORT_SUPERVISOR_EMAIL || 'support-supervisor@example.com',
        phone: '+10000000002',
        password:
          process.env.SUPPORT_SUPERVISOR_PASSWORD || 'SupportSupervisor123!',
        role: 'supervisor' as const,
      },
      {
        name: 'Support Agent',
        email: process.env.SUPPORT_AGENT_EMAIL || 'support-agent@example.com',
        phone: '+10000000003',
        password: process.env.SUPPORT_AGENT_PASSWORD || 'SupportAgent123!',
        role: 'agent' as const,
      },
    ];

    for (const employee of employeeSeeds) {
      const existing = await usersService.findByEmail(employee.email);
      if (!existing) {
        await supportService.createEmployee(supportAdminContext, {
          companyId: String(tenant._id),
          ...employee,
        });
      }
    }

    const existingQuickReplies = await supportService.listQuickReplies(
      supportAdminContext,
      String(tenant._id),
    );
    if (!existingQuickReplies.length) {
      await supportService.createQuickReply(supportAdminContext, {
        companyId: String(tenant._id),
        title: 'Welcome reply',
        category: 'general',
        message:
          'Hello {{customerName}}, thank you for contacting us. A team member will assist you shortly.',
      });
      await supportService.createQuickReply(supportAdminContext, {
        companyId: String(tenant._id),
        title: 'Request details',
        category: 'triage',
        message:
          'Please share your order number or the main issue so we can help faster.',
      });
    }

    console.log(`Support demo ready for tenant ${tenant.name}`);
  } finally {
    await app.close();
  }
}

bootstrap();
