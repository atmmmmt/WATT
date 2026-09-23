# مثال على استخدام WhatsApp OTP Module

## 1. تفعيل الـ Module في AppModule

افتح `backend/src/app.module.ts` وأزل التعليق:

```typescript
import { WhatsAppOtpModule } from './whatsapp-otp/whatsapp-otp.module';

@Module({
  imports: [
    // ... other modules
    WhatsAppOtpModule, // أزل التعليق هنا
  ],
})
```

## 2. إضافة Entity إلى TypeORM

تأكد من إضافة `OtpCode` إلى entities في `data-source.ts`:

```typescript
import { OtpCode } from './src/whatsapp-otp/otp.entity';

export const dataSourceOptions: DataSourceOptions = {
  // ... other options
  entities: [
    // ... other entities
    OtpCode,
  ],
};
```

## 3. استخدام Service في Auth Service

مثال على استخدام OTP في عملية تسجيل الدخول:

```typescript
import { WhatsAppOtpService } from '../whatsapp-otp/whatsapp-otp.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: WhatsAppOtpService,
    // ... other services
  ) {}

  // إرسال OTP للهاتف
  async sendLoginOtp(phoneNumber: string) {
    return this.otpService.sendOtp({
      phoneNumber,
      purpose: 'login',
    });
  }

  // التحقق من OTP وتسجيل الدخول
  async verifyOtpAndLogin(phoneNumber: string, code: string) {
    // التحقق من OTP
    const verification = await this.otpService.verifyOtp({
      phoneNumber,
      code,
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // البحث عن المستخدم أو إنشاء مستخدم جديد
    let user = await this.userService.findByPhone(phoneNumber);
    
    if (!user) {
      // إنشاء مستخدم جديد
      user = await this.userService.create({
        phoneNumber,
        // ... other fields
      });
    }

    // إنشاء JWT token
    const payload = { id: user.id, phoneNumber: user.phoneNumber };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user,
    };
  }
}
```

## 4. استخدام في Controller

```typescript
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('send-otp')
  async sendOtp(@Body('phoneNumber') phoneNumber: string) {
    return this.authService.sendLoginOtp(phoneNumber);
  }

  @Post('verify-otp-login')
  async verifyOtpLogin(
    @Body('phoneNumber') phoneNumber: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyOtpAndLogin(phoneNumber, code);
  }
}
```

## 5. التكامل مع WhatsApp API

افتح `whatsapp-otp.service.ts` وعدّل دالة `sendWhatsAppMessage`:

### مثال مع Twilio:

```bash
npm install twilio
```

```typescript
import * as twilio from 'twilio';

private async sendWhatsAppMessage(
  phoneNumber: string,
  code: string,
): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    from: `whatsapp:${fromNumber}`,
    to: `whatsapp:${phoneNumber}`,
    body: `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة 5 دقائق`,
  });
}
```

### مثال مع WhatsApp Cloud API (Meta):

```typescript
private async sendWhatsAppMessage(
  phoneNumber: string,
  code: string,
): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة 5 دقائق`,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error('Failed to send WhatsApp message');
  }
}
```

## 6. إضافة متغيرات البيئة

أضف إلى `.env`:

```env
# Twilio (إذا كنت تستخدم Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886

# أو WhatsApp Cloud API (Meta)
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

## 7. استخدامه في مشروع آخر

1. انسخ مجلد `whatsapp-otp` بالكامل
2. انسخ `OtpCode` entity
3. أضف `WhatsAppOtpModule` إلى `imports` في `AppModule`
4. أضف `OtpCode` إلى TypeORM entities
5. قم بتكامل WhatsApp API
6. استخدم `WhatsAppOtpService` في أي مكان

## 8. تنظيف الأكواد المنتهية (اختياري)

يمكن إضافة cron job لتنظيف الأكواد المنتهية:

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OtpCleanupService {
  constructor(private readonly otpService: WhatsAppOtpService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    const deleted = await this.otpService.cleanupExpiredOtps();
    console.log(`Cleaned up ${deleted} expired OTP codes`);
  }
}
```

