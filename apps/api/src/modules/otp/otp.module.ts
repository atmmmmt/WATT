import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ProvidersModule } from '../providers/providers.module';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { TwilioWhatsappProvider } from './providers/twilio-whatsapp.provider';
import { WhatsappWebProvider } from './providers/whatsapp-web.provider';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { OtpRequest, OtpRequestSchema } from './schemas/otp-request.schema';
import { WhatsappSessionsModule } from '../whatsapp-sessions/whatsapp-sessions.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ProductGuard } from '../../common/guards/product.guard';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OtpRequest.name, schema: OtpRequestSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    ApiKeysModule,
    ProvidersModule,
    WhatsappSessionsModule,
    TenantsModule,
  ],
  controllers: [OtpController],
  providers: [
    OtpService,
    MockWhatsappProvider,
    TwilioWhatsappProvider,
    WhatsappWebProvider,
    ProductGuard,
  ],
  exports: [OtpService, MongooseModule],
})
export class OtpModule {}
