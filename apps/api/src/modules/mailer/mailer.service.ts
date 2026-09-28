import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly resendApiKey: string;

  constructor(private readonly configService: ConfigService) {
    const resend = this.configService.get<any>('resend');
    this.resendApiKey = String(resend?.apiKey || '').trim();

    const smtp = this.configService.get<any>('smtp');
    if (!this.resendApiKey && smtp?.host && smtp?.user && smtp?.pass) {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });
    }

    if (this.resendApiKey) {
      this.logger.log('Transactional email provider: Resend API');
    } else if (this.transporter) {
      this.logger.log('Transactional email provider: SMTP');
    } else {
      this.logger.warn(
        'No email provider configured — set RESEND_API_KEY or SMTP credentials',
      );
    }
  }

  private get smtpFrom() {
    const smtp = this.configService.get<any>('smtp');
    return `"${smtp?.fromName || 'VAYRO'}" <${smtp?.from || smtp?.user || 'noreply@vayro-wa.com'}>`;
  }

  private get resendFrom() {
    const resend = this.configService.get<any>('resend');
    return `${resend?.fromName || 'VAYRO'} <${resend?.from || 'hello@vayro-wa.com'}>`;
  }

  private get dashboardOrigin() {
    return this.configService.get<string>('dashboardOrigin') || 'https://app.vayro-wa.com';
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (this.resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.resendFrom,
            to: [to],
            subject,
            html,
          }),
          signal: AbortSignal.timeout(15_000),
        });

        const bodyText = await response.text();
        if (!response.ok) {
          this.logger.error(
            `Resend failed for ${to}: HTTP ${response.status} ${bodyText.slice(0, 500)}`,
          );
          return false;
        }

        let messageId = '';
        try {
          messageId = String(JSON.parse(bodyText)?.id || '');
        } catch {
          // Resend accepted the message; the id is only useful for diagnostics.
        }
        this.logger.log(
          `Email sent via Resend to ${to}${messageId ? ` (${messageId})` : ''}: ${subject}`,
        );
        return true;
      } catch (err: any) {
        this.logger.error(`Resend request failed for ${to}: ${err?.message || err}`);
        return false;
      }
    }

    if (!this.transporter) {
      this.logger.warn(`[EMAIL NOT SENT - PROVIDER MISSING] To: ${to} | Subject: ${subject}`);
      return false;
    }

    try {
      await this.transporter.sendMail({ from: this.smtpFrom, to, subject, html });
      this.logger.log(`Email sent via SMTP to ${to}: ${subject}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send SMTP email to ${to}: ${err?.message}`);
      return false;
    }
  }

  async sendEmployeeInvite(opts: {
    to: string;
    name: string;
    companyName: string;
    setPasswordUrl: string;
  }) {
    const subject = `دعوة للانضمام إلى ${opts.companyName} عبر VAYRO`;
    const html = buildInviteEmail(opts, this.dashboardOrigin);
    return this.send(opts.to, subject, html);
  }

  async sendPasswordReset(opts: {
    to: string;
    name: string;
    resetUrl: string;
  }) {
    const subject = 'إعادة تعيين كلمة المرور | VAYRO';
    const html = buildResetEmail(opts, this.dashboardOrigin);
    return this.send(opts.to, subject, html);
  }

  async sendWelcomeWithCredentials(opts: {
    to: string;
    name: string;
    companyName: string;
    email: string;
    setPasswordUrl: string;
  }) {
    const subject = `أهلاً بك في VAYRO — حساب ${opts.companyName} جاهز`;
    const html = buildWelcomeEmail(opts, this.dashboardOrigin);
    return this.send(opts.to, subject, html);
  }
}

const brand = {
  green: '#075946',
  greenDark: '#06483a',
  mint: '#eaf5f1',
  text: '#10231e',
  muted: '#6b7f78',
};

function assets(origin: string) {
  return {
    logo: `${origin}/brand/vayro-logo-white.png`,
    // front.webp is the larger clean master asset; celebrate.webp was too small for email clients.
    mascot: `${origin}/mascot/front.webp`,
  };
}

function shell(content: string, origin: string, eyebrow: string) {
  const media = assets(origin);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f6f4;font-family:Tahoma,Arial,sans-serif;color:${brand.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6f4;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dfeae6;box-shadow:0 12px 34px rgba(7,89,70,.09);">
        <tr>
          <td align="center" style="background:${brand.green};padding:24px 24px 22px;">
            <img src="${media.logo}" alt="VAYRO" width="142" style="display:block;max-width:142px;height:auto;margin:0 auto;">
            <div style="display:inline-block;margin-top:12px;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.12);color:#d9eee8;font-size:10px;font-weight:700;letter-spacing:.8px;">${eyebrow}</div>
          </td>
        </tr>
        ${content.replace('{{MASCOT}}', `<div style="width:132px;height:132px;margin:0 auto 12px;border-radius:30px;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="${media.mascot}" alt="VAYRO" width="124" height="124" style="display:block;width:124px;height:124px;object-fit:contain;border:0;outline:0;background:#ffffff;"></div>`)}
        <tr><td style="padding:0 34px 30px;">
          <div style="height:1px;background:#e7efec;margin:4px 0 18px;"></div>
          <p style="margin:0;color:${brand.muted};font-size:12px;line-height:1.8;text-align:center;">هذه رسالة آلية من VAYRO. لا تشارك رابط تفعيل حسابك مع أي شخص.</p>
          <p style="margin:5px 0 0;color:#9aaba5;font-size:11px;text-align:center;">© ${new Date().getFullYear()} VAYRO · vayro-wa.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function actionButton(url: string, label: string) {
  return `<div style="text-align:center;margin:26px 0 22px;"><a href="${url}" style="display:inline-block;background:${brand.green};color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:12px;font-size:15px;font-weight:700;">${label}</a></div>`;
}

function buildInviteEmail(opts: { name: string; companyName: string; setPasswordUrl: string }, origin: string) {
  return shell(`
    <tr><td style="padding:32px 34px 10px;text-align:center;">
      {{MASCOT}}
      <div style="display:inline-block;background:${brand.mint};color:${brand.green};font-size:12px;font-weight:700;padding:7px 12px;border-radius:999px;">دعوة فريق جديدة</div>
      <h1 style="margin:15px 0 8px;font-size:25px;line-height:1.5;">أهلاً ${opts.name} 👋</h1>
      <p style="margin:0;color:${brand.muted};font-size:14px;line-height:1.9;">تمت دعوتك للانضمام إلى فريق <strong>${opts.companyName}</strong> على منصة VAYRO. اضغط الزر التالي واختر كلمة مرورك بنفسك لتفعيل الحساب.</p>
      ${actionButton(opts.setPasswordUrl, 'تفعيل الحساب واختيار كلمة المرور')}
      <div style="background:#f7faf9;border:1px solid #e5eeeb;border-radius:12px;padding:13px 16px;color:${brand.muted};font-size:12px;line-height:1.8;">الرابط صالح لمدة 48 ساعة. لا توجد كلمة مرور جاهزة مرسلة من VAYRO؛ أنت من يختارها عند التفعيل.</div>
    </td></tr>`, origin, 'TEAM INVITATION');
}

function buildResetEmail(opts: { name: string; resetUrl: string }, origin: string) {
  return shell(`
    <tr><td style="padding:32px 34px 14px;text-align:center;">
      {{MASCOT}}
      <div style="display:inline-block;background:${brand.mint};color:${brand.green};font-size:12px;font-weight:700;padding:7px 12px;border-radius:999px;">أمان الحساب</div>
      <h1 style="margin:15px 0 10px;font-size:25px;line-height:1.5;">إعادة تعيين كلمة المرور</h1>
      <p style="margin:0;color:${brand.muted};font-size:14px;line-height:1.9;">مرحباً ${opts.name}، وصلنا طلب لإعادة تعيين كلمة مرور حسابك في VAYRO. استخدم الزر التالي لإنشاء كلمة مرور جديدة.</p>
      ${actionButton(opts.resetUrl, 'إنشاء كلمة مرور جديدة')}
      <div style="background:#f7faf9;border:1px solid #e5eeeb;border-radius:12px;padding:13px 16px;color:${brand.muted};font-size:12px;line-height:1.8;">الرابط صالح لمدة ساعة واحدة. إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة.</div>
    </td></tr>`, origin, 'PASSWORD RESET');
}

function buildWelcomeEmail(opts: { name: string; companyName: string; email: string; setPasswordUrl: string }, origin: string) {
  return shell(`
    <tr><td style="padding:30px 34px 12px;text-align:center;">
      {{MASCOT}}
      <div style="display:inline-block;background:${brand.mint};color:${brand.green};font-size:12px;font-weight:700;padding:7px 12px;border-radius:999px;">حسابك جاهز</div>
      <h1 style="margin:15px 0 7px;font-size:26px;line-height:1.5;">أهلاً بك في VAYRO، ${opts.name} 🎉</h1>
      <p style="margin:0;color:${brand.muted};font-size:14px;line-height:1.9;">تم تجهيز مساحة عمل <strong>${opts.companyName}</strong>. بقيت خطوة واحدة فقط: اختر كلمة المرور الخاصة بك وابدأ استخدام الخدمات المفعّلة لك.</p>
      <div style="margin:22px 0 0;background:#f7faf9;border:1px solid #e5eeeb;border-radius:14px;padding:16px;text-align:right;">
        <div style="font-size:11px;color:${brand.muted};margin-bottom:5px;">بريد الدخول</div>
        <div dir="ltr" style="font-size:14px;font-weight:700;color:${brand.text};word-break:break-all;">${opts.email}</div>
      </div>
      ${actionButton(opts.setPasswordUrl, 'تفعيل الحساب واختيار كلمة المرور')}
      <p style="margin:0;color:${brand.muted};font-size:12px;line-height:1.9;">VAYRO لا يرسل لك كلمة مرور جاهزة. كلمة المرور يختارها صاحب الحساب فقط عبر رابط التفعيل، والرابط صالح لمدة 48 ساعة.</p>
    </td></tr>`, origin, 'WELCOME TO VAYRO');
}
