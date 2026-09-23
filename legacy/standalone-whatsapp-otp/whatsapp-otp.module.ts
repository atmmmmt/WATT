import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppOtpController } from './whatsapp-otp.controller';
import { WhatsAppOtpService } from './whatsapp-otp.service';
import { OtpCode } from './otp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode])],
  controllers: [WhatsAppOtpController],
  providers: [WhatsAppOtpService],
  exports: [WhatsAppOtpService], // Export to use in other modules
})
export class WhatsAppOtpModule {}

