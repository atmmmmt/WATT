/**
 * WhatsApp OTP Module - Standalone Module
 * 
 * يمكن استخدام هذا الـ Module في أي مشروع NestJS آخر
 * فقط انسخ مجلد whatsapp-otp بالكامل وأضفه إلى مشروعك
 */

export { WhatsAppOtpModule } from './whatsapp-otp.module';
export { WhatsAppOtpService } from './whatsapp-otp.service';
export { WhatsAppOtpController } from './whatsapp-otp.controller';
export { OtpCode } from './otp.entity';
export { SendOtpDto } from './dto/send-otp.dto';
export { VerifyOtpDto } from './dto/verify-otp.dto';

