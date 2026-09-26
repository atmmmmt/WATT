import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ProvidersModule } from '../providers/providers.module';
import { ClientWhatsappSessionsController } from './client-whatsapp-sessions.controller';
import { ClientWhatsappSendController } from './client-whatsapp-send.controller';
import { BaileysWhatsappCompatService } from './baileys-whatsapp-compat.service';
import { BaileysWhatsappSessionsService } from './baileys-whatsapp-sessions.service';
import {
  WhatsappBaileysAuth,
  WhatsappBaileysAuthSchema,
} from './schemas/whatsapp-baileys-auth.schema';
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
      { name: WhatsappBaileysAuth.name, schema: WhatsappBaileysAuthSchema },
    ]),
    ApiKeysModule,
    ProvidersModule,
  ],
  controllers: [
    WhatsappSessionsController,
    ClientWhatsappSessionsController,
    ClientWhatsappSendController,
  ],
  providers: [
    BaileysWhatsappSessionsService,
    BaileysWhatsappCompatService,
    {
      provide: WhatsappSessionsService,
      useExisting: BaileysWhatsappCompatService,
    },
  ],
  exports: [WhatsappSessionsService, MongooseModule],
})
export class WhatsappSessionsModule {}
