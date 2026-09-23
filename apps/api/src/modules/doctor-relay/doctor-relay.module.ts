import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { WhatsappSessionsModule } from '../whatsapp-sessions/whatsapp-sessions.module';
import { DoctorRelayController } from './doctor-relay.controller';
import { DoctorRelayGateway } from './doctor-relay.gateway';
import { DoctorRelayService } from './doctor-relay.service';
import { DoctorRelayLink, DoctorRelayLinkSchema } from './schemas/doctor-relay-link.schema';
import {
  DoctorRelayMessage,
  DoctorRelayMessageSchema,
} from './schemas/doctor-relay-message.schema';
import { DoctorRelayDoctor, DoctorRelayDoctorSchema } from './schemas/doctor-relay-doctor.schema';
import {
  DoctorRelayPatient,
  DoctorRelayPatientSchema,
} from './schemas/doctor-relay-patient.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DoctorRelayLink.name, schema: DoctorRelayLinkSchema },
      { name: DoctorRelayMessage.name, schema: DoctorRelayMessageSchema },
      { name: DoctorRelayDoctor.name, schema: DoctorRelayDoctorSchema },
      { name: DoctorRelayPatient.name, schema: DoctorRelayPatientSchema },
    ]),
    AuthModule,
    TenantsModule,
    UsersModule,
    WhatsappSessionsModule,
  ],
  controllers: [DoctorRelayController],
  providers: [DoctorRelayService, DoctorRelayGateway],
  exports: [DoctorRelayService],
})
export class DoctorRelayModule {}
