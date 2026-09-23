import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { WhatsappSessionsModule } from '../whatsapp-sessions/whatsapp-sessions.module';
import { SupportController } from './support.controller';
import { SupportGateway } from './support.gateway';
import { SupportReportsController } from './support-reports.controller';
import { SupportService } from './support.service';
import { SupportAiService } from './support-ai.service';
import {
  SupportActivityLog,
  SupportActivityLogSchema,
} from './schemas/support-activity-log.schema';
import {
  SupportConversation,
  SupportConversationSchema,
} from './schemas/support-conversation.schema';
import {
  SupportInternalNote,
  SupportInternalNoteSchema,
} from './schemas/support-internal-note.schema';
import { SupportMessage, SupportMessageSchema } from './schemas/support-message.schema';
import {
  SupportQuickReply,
  SupportQuickReplySchema,
} from './schemas/support-quick-reply.schema';
import { SupportTag, SupportTagSchema } from './schemas/support-tag.schema';
import { AgentOnlineSession, AgentOnlineSessionSchema } from './schemas/agent-online-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportConversation.name, schema: SupportConversationSchema },
      { name: SupportMessage.name, schema: SupportMessageSchema },
      { name: SupportInternalNote.name, schema: SupportInternalNoteSchema },
      { name: SupportActivityLog.name, schema: SupportActivityLogSchema },
      { name: SupportQuickReply.name, schema: SupportQuickReplySchema },
      { name: SupportTag.name, schema: SupportTagSchema },
      { name: AgentOnlineSession.name, schema: AgentOnlineSessionSchema },
    ]),
    AuthModule,
    TenantsModule,
    UsersModule,
    WhatsappSessionsModule,
  ],
  controllers: [SupportController, SupportReportsController],
  providers: [SupportService, SupportGateway, SupportAiService],
  exports: [SupportService],
})
export class SupportModule {}
