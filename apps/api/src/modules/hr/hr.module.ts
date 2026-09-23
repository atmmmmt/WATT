import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { WhatsappSessionsModule } from '../whatsapp-sessions/whatsapp-sessions.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { PublicApplyController } from './public-apply.controller';
import { HrApplication, HrApplicationSchema } from './schemas/hr-application.schema';
import { HrCandidate, HrCandidateSchema } from './schemas/hr-candidate.schema';
import { HrJob, HrJobSchema } from './schemas/hr-job.schema';
import {
  HrMessageTemplate,
  HrMessageTemplateSchema,
} from './schemas/hr-message-template.schema';
import {
  HrTimelineEvent,
  HrTimelineEventSchema,
} from './schemas/hr-timeline-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HrJob.name, schema: HrJobSchema },
      { name: HrCandidate.name, schema: HrCandidateSchema },
      { name: HrApplication.name, schema: HrApplicationSchema },
      { name: HrTimelineEvent.name, schema: HrTimelineEventSchema },
      { name: HrMessageTemplate.name, schema: HrMessageTemplateSchema },
    ]),
    TenantsModule,
    UsersModule,
    WhatsappSessionsModule,
  ],
  controllers: [HrController, PublicApplyController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
