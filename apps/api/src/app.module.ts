import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import appConfig from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { OtpModule } from './modules/otp/otp.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { WhatsappSessionsModule } from './modules/whatsapp-sessions/whatsapp-sessions.module';
import { HrModule } from './modules/hr/hr.module';
import { SupportModule } from './modules/support/support.module';
import { DoctorRelayModule } from './modules/doctor-relay/doctor-relay.module';
import { LandingModule } from './modules/landing/landing.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { ProductGuard } from './common/guards/product.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CompanyAccessGuard } from './common/guards/company-access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodbUri'),
      }),
    }),
    MailerModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    SubscriptionsModule,
    LicensesModule,
    ApiKeysModule,
    ProvidersModule,
    WhatsappSessionsModule,
    OtpModule,
    DashboardModule,
    LandingModule,
    HrModule,
    SupportModule,
    DoctorRelayModule,
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    ApiKeyGuard,
    ProductGuard,
    PermissionsGuard,
    CompanyAccessGuard,
  ],
})
export class AppModule {}
