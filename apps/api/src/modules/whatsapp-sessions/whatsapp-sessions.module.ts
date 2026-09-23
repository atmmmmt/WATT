import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ProvidersModule } from '../providers/providers.module';
import { ClientWhatsappSessionsController } from './client-whatsapp-sessions.controller';
import { ClientWhatsappSendController } from './client-whatsapp-send.controller';
import {
  WhatsappSession,
  WhatsappSessionSchema,
} from './schemas/whatsapp-session.schema';
import { WhatsappSessionsController } from './whatsapp-sessions.controller';
import { WhatsappSessionsService } from './whatsapp-sessions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsappSession.name, schema: WhatsappSessionSchema },
    ]),
    ApiKeysModule,
    ProvidersModule,
  ],
  controllers: [
    WhatsappSessionsController,
    ClientWhatsappSessionsController,
    ClientWhatsappSendController,
  ],
  providers: [WhatsappSessionsService],
  exports: [WhatsappSessionsService, MongooseModule],
})
export class WhatsappSessionsModule {}
