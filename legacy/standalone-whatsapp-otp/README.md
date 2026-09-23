# WhatsApp OTP Module

هذا المجلد يحتوي على آلية OTP معزولة يمكن استخدامها في أي تطبيق آخر.

## المميزات

- ✅ إرسال كود OTP عبر واتساب
- ✅ التحقق من كود OTP
- ✅ حماية من المحاولات المتكررة
- ✅ انتهاء صلاحية تلقائي للأكواد
- ✅ تنظيف تلقائي للأكواد المنتهية
- ✅ معزول تماماً - يمكن استخدامه في أي مشروع

## البنية

```
whatsapp-otp/
├── otp.entity.ts              # Entity لتخزين أكواد OTP
├── whatsapp-otp.service.ts    # Service للتعامل مع OTP
├── whatsapp-otp.controller.ts # Controller للـ endpoints
├── whatsapp-otp.module.ts      # Module للتكامل مع NestJS
├── dto/
│   ├── send-otp.dto.ts        # DTO لإرسال OTP
│   └── verify-otp.dto.ts      # DTO للتحقق من OTP
└── README.md                   # هذا الملف
```

## الاستخدام

### 1. إضافة Module إلى AppModule

```typescript
import { WhatsAppOtpModule } from './whatsapp-otp/whatsapp-otp.module';

@Module({
  imports: [
    // ... other modules
    WhatsAppOtpModule,
  ],
})
export class AppModule {}
```

### 2. استخدام Service في أي مكان

```typescript
import { WhatsAppOtpService } from './whatsapp-otp/whatsapp-otp.service';

@Injectable()
export class AuthService {
  constructor(private readonly otpService: WhatsAppOtpService) {}

  async sendOtp(phoneNumber: string) {
    return this.otpService.sendOtp({ phoneNumber, purpose: 'login' });
  }

  async verifyOtp(phoneNumber: string, code: string) {
    const result = await this.otpService.verifyOtp({ phoneNumber, code });
    if (result.verified) {
      // Proceed with authentication
    }
  }
}
```

## API Endpoints

### POST /whatsapp-otp/send
إرسال كود OTP عبر واتساب

**Request:**
```json
{
  "phoneNumber": "+966501234567",
  "purpose": "login" // optional
}
```

**Response:**
```json
{
  "message": "OTP sent successfully via WhatsApp",
  "expiresIn": 300
}
```

### POST /whatsapp-otp/verify
التحقق من كود OTP

**Request:**
```json
{
  "phoneNumber": "+966501234567",
  "code": "123456"
}
```

**Response:**
```json
{
  "verified": true,
  "message": "OTP verified successfully"
}
```

### GET /whatsapp-otp/check?phoneNumber=+966501234567
التحقق من وجود OTP نشط للرقم

## التكامل مع WhatsApp

حالياً، الـ Service يحتوي على placeholder لإرسال الرسائل. يجب التكامل مع:

### خيارات التكامل:

1. **Twilio WhatsApp API**
   ```typescript
   const client = require('twilio')(accountSid, authToken);
   await client.messages.create({
     from: 'whatsapp:+14155238886',
     to: `whatsapp:${phoneNumber}`,
     body: `Your verification code is: ${code}`
   });
   ```

2. **WhatsApp Cloud API (Meta)**
   ```typescript
   // استخدام WhatsApp Business API من Meta
   ```

3. **خدمات أخرى** مثل MessageBird، Vonage، إلخ

## الإعدادات

يمكن تعديل الإعدادات في `whatsapp-otp.service.ts`:

- `OTP_EXPIRY_MINUTES`: مدة صلاحية الكود (افتراضي: 5 دقائق)
- `MAX_ATTEMPTS`: عدد المحاولات المسموحة (افتراضي: 3)
- `OTP_LENGTH`: طول كود OTP (افتراضي: 6 أرقام)

## Migration

لإنشاء جدول OTP في قاعدة البيانات:

```bash
npm run migration:generate -- src/whatsapp-otp/migrations/CreateOtpTable
npm run migration:run
```

## استخدامه في مشروع آخر

1. انسخ مجلد `whatsapp-otp` بالكامل
2. أضف `WhatsAppOtpModule` إلى `imports` في `AppModule`
3. تأكد من إضافة `OtpCode` entity إلى TypeORM entities
4. قم بتكامل WhatsApp API في `sendWhatsAppMessage` method
5. استخدم `WhatsAppOtpService` في أي مكان في التطبيق

## ملاحظات

- الأكواد المنتهية يمكن تنظيفها تلقائياً باستخدام cron job
- يمكن إضافة rate limiting لمنع إساءة الاستخدام
- يمكن إضافة logging متقدم لتتبع محاولات التحقق

