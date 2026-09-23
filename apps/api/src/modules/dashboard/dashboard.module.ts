import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { OtpModule } from '../otp/otp.module';
import { ProvidersModule } from '../providers/providers.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { WhatsappSessionsModule } from '../whatsapp-sessions/whatsapp-sessions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TenantsModule,
    SubscriptionsModule,
    ApiKeysModule,
    OtpModule,
    UsersModule,
    ProvidersModule,
    WhatsappSessionsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
