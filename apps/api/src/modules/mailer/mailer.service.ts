import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const smtp = this.configService.get<any>('smtp');
    if (smtp?.host) {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  private get smtpFrom() {
    const smtp = this.configService.get<any>('smtp');
    return `"${smtp?.fromName || 'ProoTech'}" <${smtp?.from || smtp?.user || 'noreply@example.com'}>`;
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.smtpFrom, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err?.message}`);
    }
  }

  async sendEmployeeInvite(opts: {
    to: string;
    name: string;
    companyName: string;
    setPasswordUrl: string;
  }) {
    const subject = `دعوة للانضمام إلى ${opts.companyName} | Invitation to join ${opts.companyName}`;
    const html = buildInviteEmail(opts);
    await this.send(opts.to, subject, html);
  }

  async sendPasswordReset(opts: {
    to: string;
    name: string;
    resetUrl: string;
  }) {
    const subject = 'إعادة تعيين كلمة المرور | Password Reset';
    const html = buildResetEmail(opts);
    await this.send(opts.to, subject, html);
  }

  async sendWelcomeWithCredentials(opts: {
    to: string;
    name: string;
    companyName: string;
    email: string;
    setPasswordUrl: string;
  }) {
    const subject = `مرحباً بك في ${opts.companyName} | Welcome to ${opts.companyName}`;
    const html = buildWelcomeEmail(opts);
    await this.send(opts.to, subject, html);
  }
}

// ─── Email Templates ───────────────────────────────────────────────────────────

const baseStyle = `
  body { margin:0; padding:0; background:#f5f5f5; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
  .wrapper { max-width:600px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
  .header { background:linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding:40px 32px; text-align:center; }
  .header img { width:50px; height:50px; }
  .header h1 { color:#ffffff; margin:16px 0 0; font-size:22px; font-weight:600; letter-spacing:0.5px; }
  .header p { color:rgba(255,255,255,0.7); margin:6px 0 0; font-size:14px; }
  .body { padding:40px 32px; }
  .greeting { font-size:18px; font-weight:600; color:#1a1a2e; margin-bottom:12px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .btn-wrap { text-align:center; margin:32px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg, #0f3460, #533483); color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:16px; font-weight:600; letter-spacing:0.3px; }
  .divider { border:none; border-top:1px solid #eee; margin:28px 0; }
  .note { font-size:13px; color:#999; line-height:1.6; }
  .footer { background:#f9f9f9; padding:24px 32px; text-align:center; border-top:1px solid #eee; }
  .footer p { font-size:12px; color:#aaa; margin:0; }
  .rtl { direction:rtl; text-align:right; }
`;

function buildInviteEmail(opts: { name: string; companyName: string; setPasswordUrl: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle}</style></head><body>
  <div class="wrapper">
    <div class="header">
      <h1>ProoTech Platform</h1>
      <p>${opts.companyName}</p>
    </div>
    <div class="body">
      <div class="greeting rtl">مرحباً ${opts.name} 👋</div>
      <p class="text rtl">تمت دعوتك للانضمام إلى فريق <strong>${opts.companyName}</strong> على منصة ProoTech. لإتمام تسجيل حسابك، يرجى الضغط على الزر أدناه وتعيين كلمة المرور الخاصة بك.</p>
      <div class="btn-wrap"><a class="btn" href="${opts.setPasswordUrl}">تعيين كلمة المرور</a></div>
      <hr class="divider"/>
      <div class="greeting">Hello ${opts.name} 👋</div>
      <p class="text">You've been invited to join <strong>${opts.companyName}</strong> on ProoTech Platform. Click the button below to set your password and activate your account.</p>
      <div class="btn-wrap"><a class="btn" href="${opts.setPasswordUrl}">Set My Password</a></div>
      <hr class="divider"/>
      <p class="note rtl">⏱ هذا الرابط صالح لمدة 48 ساعة. إذا لم تطلب هذه الدعوة، يمكنك تجاهل هذا الإيميل.</p>
      <p class="note">⏱ This link is valid for 48 hours. If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} ProoTech Platform. All rights reserved.</p></div>
  </div>
</body></html>`;
}

function buildResetEmail(opts: { name: string; resetUrl: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle}</style></head><body>
  <div class="wrapper">
    <div class="header">
      <h1>ProoTech Platform</h1>
      <p>إعادة تعيين كلمة المرور | Password Reset</p>
    </div>
    <div class="body">
      <div class="greeting rtl">مرحباً ${opts.name}</div>
      <p class="text rtl">تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لإتمام العملية.</p>
      <div class="btn-wrap"><a class="btn" href="${opts.resetUrl}">إعادة تعيين كلمة المرور</a></div>
      <hr class="divider"/>
      <div class="greeting">Hello ${opts.name}</div>
      <p class="text">We received a request to reset your account password. Click the button below to proceed.</p>
      <div class="btn-wrap"><a class="btn" href="${opts.resetUrl}">Reset My Password</a></div>
      <hr class="divider"/>
      <p class="note rtl">⏱ هذا الرابط صالح لمدة ساعة واحدة. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذا الإيميل وكلمة مرورك ستبقى كما هي.</p>
      <p class="note">⏱ This link expires in 1 hour. If you didn't request a reset, your password remains unchanged.</p>
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} ProoTech Platform. All rights reserved.</p></div>
  </div>
</body></html>`;
}

function buildWelcomeEmail(opts: { name: string; companyName: string; email: string; setPasswordUrl: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyle}</style></head><body>
  <div class="wrapper">
    <div class="header">
      <h1>ProoTech Platform</h1>
      <p>${opts.companyName}</p>
    </div>
    <div class="body">
      <div class="greeting rtl">مرحباً بك ${opts.name} 🎉</div>
      <p class="text rtl">تم إنشاء حساب شركتك <strong>${opts.companyName}</strong> بنجاح على منصة ProoTech. يرجى الضغط على الزر أدناه لتعيين كلمة المرور وتفعيل حسابك.</p>
      <p class="text rtl"><strong>إيميل الدخول:</strong> ${opts.email}</p>
      <div class="btn-wrap"><a class="btn" href="${opts.setPasswordUrl}">تفعيل الحساب وتعيين كلمة المرور</a></div>
      <hr class="divider"/>
      <div class="greeting">Welcome ${opts.name} 🎉</div>
      <p class="text">Your company account <strong>${opts.companyName}</strong> has been created on ProoTech Platform. Click the button below to set your password and activate your account.</p>
      <p class="text"><strong>Login Email:</strong> ${opts.email}</p>
      <div class="btn-wrap"><a class="btn" href="${opts.setPasswordUrl}">Activate Account & Set Password</a></div>
      <hr class="divider"/>
      <p class="note rtl">⏱ هذا الرابط صالح لمدة 48 ساعة.</p>
      <p class="note">⏱ This link is valid for 48 hours.</p>
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} ProoTech Platform. All rights reserved.</p></div>
  </div>
</body></html>`;
}
