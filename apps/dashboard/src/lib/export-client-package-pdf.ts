import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ExportPackageInput {
  type?: 'api' | 'support' | 'hr';
  tenantName: string;
  tenantId: string;
  contactEmail: string;
  planName: string;
  subscriptionEnd: string;
  monthlyQuota: number;
  priceLabel: string;
  providerType: string;
  apiBaseUrl: string;
  dashboardUrl?: string;
  portalEmail?: string;
  portalPassword?: string;
  portalRoleLabel?: string;
  otpTemplates?: {
    login?: string;
    register?: string;
    forgotPassword?: string;
  };
  rawKey?: string;
  sendEndpoint?: string;
  verifyEndpoint?: string;
  sessionStartEndpoint?: string;
  sessionStatusEndpoint?: string;
  sessionDisconnectEndpoint?: string;
}

const BRAND = {
  logoWhite: '/brand/vayro-logo-white.png',
  logo: '/brand/vayro-logo.png',
  mascotApi: '/mascot/thumbs.webp',
  mascotSupport: '/mascot/wave.webp',
  mascotHr: '/mascot/working.webp',
};

const OTP_TEMPLATE_FALLBACKS = {
  login: 'رمز تسجيل الدخول الخاص بك هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  register: 'رمز تأكيد إنشاء الحساب هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  forgotPassword: 'رمز إعادة تعيين كلمة المرور هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function providerLabel(providerType: string) {
  switch (providerType) {
    case 'whatsapp_web':
      return 'ربط مباشر برقم واتساب عبر QR';
    case 'twilio':
      return 'مزود رسمي خارجي';
    case 'mock':
    default:
      return 'وضع تجريبي Mock';
  }
}

function brandHero(input: ExportPackageInput, options: {
  badge: string;
  title: string;
  description: string;
  mascot: string;
  service: string;
}) {
  return `
    <section class="hero">
      <div class="hero-content">
        <img class="hero-logo" src="${BRAND.logoWhite}" alt="VAYRO" />
        <div class="hero-badge">${escapeHtml(options.badge)}</div>
        <h1>${escapeHtml(options.title)}</h1>
        <p>${escapeHtml(options.description)}</p>
        <div class="hero-meta">
          <div><span>العميل</span><strong>${escapeHtml(input.tenantName)}</strong></div>
          <div><span>الخدمة</span><strong>${escapeHtml(options.service)}</strong></div>
          <div><span>الباقة</span><strong>${escapeHtml(input.planName)}</strong></div>
          <div><span>ينتهي الاشتراك</span><strong>${escapeHtml(input.subscriptionEnd)}</strong></div>
        </div>
      </div>
      <div class="hero-character">
        <div class="mascot-glow"></div>
        <img class="hero-mascot" src="${options.mascot}" alt="" />
        <div class="hero-stamp">VAYRO</div>
        <div class="hero-stamp-sub">BUSINESS MESSAGING PLATFORM</div>
      </div>
    </section>
  `;
}

function footer() {
  return `
    <footer class="package-footer">
      <img src="${BRAND.logo}" alt="VAYRO" />
      <div>
        <strong>VAYRO</strong>
        <span>تواصل أذكى لأعمال أكبر</span>
      </div>
      <div class="footer-site">vayro-wa.com</div>
    </footer>
  `;
}

function portalSection(input: ExportPackageInput, defaultRole: string) {
  return `
    <section class="panel">
      <div class="section-kicker">CUSTOMER PORTAL</div>
      <div class="section-title">بيانات دخول بوابة العميل</div>
      <div class="info-grid">
        <div class="info-card accent"><div class="info-label">رابط البوابة</div><div class="info-value ltr">${escapeHtml(input.dashboardUrl || '')}</div></div>
        <div class="info-card"><div class="info-label">نوع الحساب</div><div class="info-value">${escapeHtml(input.portalRoleLabel || defaultRole)}</div></div>
        <div class="info-card"><div class="info-label">البريد الإلكتروني</div><div class="info-value ltr">${escapeHtml(input.portalEmail || input.contactEmail || '')}</div></div>
        <div class="info-card"><div class="info-label">كلمة المرور</div><div class="info-value">${escapeHtml(input.portalPassword || 'استخدم كلمة المرور التي تم تسليمها عند التفعيل أو اطلب إعادة تعيينها')}</div></div>
      </div>
    </section>
  `;
}

function buildApiTemplate(input: ExportPackageInput) {
  const baseUrl = input.apiBaseUrl.replace(/\/$/, '');
  const docsUrl = `${baseUrl}/docs`;
  const isMock = input.providerType === 'mock';
  const hasQrFlow = input.providerType === 'whatsapp_web' && input.sessionStartEndpoint && input.sessionStatusEndpoint && input.sessionDisconnectEndpoint;
  const templates = {
    login: input.otpTemplates?.login || OTP_TEMPLATE_FALLBACKS.login,
    register: input.otpTemplates?.register || OTP_TEMPLATE_FALLBACKS.register,
    forgotPassword: input.otpTemplates?.forgotPassword || OTP_TEMPLATE_FALLBACKS.forgotPassword,
  };

  return `
    <div class="package-shell" dir="rtl">
      ${brandHero(input, {
        badge: 'VAYRO DELIVERY',
        title: 'حزمة تسليم خدمة واتساب OTP',
        description: 'ملف تسليم جاهز لفريقكم التقني، يتضمن بيانات الربط، مفاتيح API، المسارات وقوالب رسائل التحقق.',
        mascot: BRAND.mascotApi,
        service: 'واتساب OTP',
      })}

      ${isMock ? `<section class="warning"><strong>تنبيه مهم</strong><span>هذه الحزمة حالياً على وضع Mock للتجربة ولن ترسل رسائل واتساب حقيقية قبل تفعيل الربط الفعلي.</span></section>` : ''}

      <section class="panel">
        <div class="section-kicker">INTEGRATION</div>
        <div class="section-title">1. بيانات الربط الأساسية</div>
        <div class="info-grid">
          <div class="info-card accent"><div class="info-label">Base URL</div><div class="info-value ltr">${escapeHtml(baseUrl)}</div></div>
          <div class="info-card"><div class="info-label">Swagger / Docs</div><div class="info-value ltr">${escapeHtml(docsUrl)}</div></div>
          <div class="info-card"><div class="info-label">API Key</div><div class="info-value ltr mono">${escapeHtml(input.rawKey || '')}</div></div>
          <div class="info-card"><div class="info-label">Required Header</div><div class="info-value ltr mono">x-api-key: ${escapeHtml(input.rawKey || '')}</div></div>
        </div>
        <div class="security-note"><b>مهم:</b> لا تضع API Key داخل كود Front-End مكشوف. استخدمه فقط في السيرفر أو بيئة خلفية محمية.</div>
      </section>

      ${portalSection(input, 'مدير الشركة / بوابة العميل')}

      <section class="panel">
        <div class="section-kicker">API ENDPOINTS</div>
        <div class="section-title">3. المسارات المطلوبة للمطور</div>
        <div class="code-label">إرسال كود OTP</div>
        <pre>POST ${escapeHtml(input.sendEndpoint || `${baseUrl}/v1/otp/send`)}
{
  "phoneNumber": "+9639xxxxxxxx",
  "purpose": "login"
}</pre>
        <div class="code-label">التحقق من الكود</div>
        <pre>POST ${escapeHtml(input.verifyEndpoint || `${baseUrl}/v1/otp/verify`)}
{
  "phoneNumber": "+9639xxxxxxxx",
  "code": "123456"
}</pre>
      </section>

      <section class="panel">
        <div class="section-kicker">MESSAGING</div>
        <div class="section-title">4. إرسال رسائل واتساب نصية عامة</div>
        <p class="section-copy">يمكن إرسال رسالة نصية عبر نفس جلسة واتساب المتصلة باستخدام مفتاح API نفسه.</p>
        <div class="code-label">إرسال رسالة</div>
        <pre>POST ${escapeHtml(baseUrl)}/v1/whatsapp/send
{
  "phoneNumber": "+9639xxxxxxxx",
  "message": "نص الرسالة"
}</pre>
      </section>

      ${hasQrFlow ? `
        <section class="panel">
          <div class="section-kicker">WHATSAPP SESSION</div>
          <div class="section-title">5. إدارة جلسة واتساب عبر QR</div>
          <p class="section-copy">يجب أن تصبح الجلسة في حالة <strong>ready</strong> قبل إرسال رسائل حقيقية.</p>
          <div class="code-label">بدء جلسة الربط</div><pre>POST ${escapeHtml(input.sessionStartEndpoint)}</pre>
          <div class="code-label">متابعة حالة الجلسة</div><pre>GET ${escapeHtml(input.sessionStatusEndpoint)}</pre>
          <div class="code-label">فصل الجلسة</div><pre>POST ${escapeHtml(input.sessionDisconnectEndpoint)}</pre>
        </section>
      ` : ''}

      <section class="panel">
        <div class="section-kicker">GO LIVE</div>
        <div class="section-title">6. خطوات التشغيل الصحيحة</div>
        <div class="steps">
          <div class="step"><b>01</b><span>أرسل API Key ضمن الهيدر <span class="ltr">x-api-key</span> في كل طلب.</span></div>
          <div class="step"><b>02</b><span>استدعِ Endpoint الإرسال عندما يطلب المستخدم رمز التحقق.</span></div>
          <div class="step"><b>03</b><span>استقبل الرمز من المستخدم ثم نفّذ Endpoint التحقق.</span></div>
          <div class="step"><b>04</b><span>راقب جلسة واتساب من بوابة VAYRO وتأكد أنها Ready قبل الإنتاج.</span></div>
          <div class="step"><b>05</b><span>لا تشارك المفتاح الخام إلا مع المطور أو المسؤول التقني المخول.</span></div>
        </div>
      </section>

      <section class="panel">
        <div class="section-kicker">OTP TEMPLATES</div>
        <div class="section-title">7. قوالب رسائل OTP المعتمدة</div>
        <div class="template-grid">
          <div class="template-card"><div class="template-title">تسجيل الدخول</div><div class="template-body">${escapeHtml(templates.login)}</div></div>
          <div class="template-card"><div class="template-title">تأكيد إنشاء الحساب</div><div class="template-body">${escapeHtml(templates.register)}</div></div>
          <div class="template-card"><div class="template-title">نسيان كلمة المرور</div><div class="template-body">${escapeHtml(templates.forgotPassword)}</div></div>
        </div>
        <div class="security-note">المتغير <span class="ltr">{{code}}</span> إلزامي، و<span class="ltr">{{expiresInMinutes}}</span> اختياري لإظهار مدة صلاحية الرمز.</div>
      </section>

      <section class="panel compact-panel">
        <div class="section-kicker">NOTES</div>
        <div class="section-title">8. ملاحظات تشغيلية</div>
        <div class="bullet-list">
          <div class="bullet">Swagger هو المرجع التقني الأساسي لأي تكامل أو اختبار إضافي.</div>
          <div class="bullet">إذا تم إصدار مفتاح API جديد، أوقف مشاركة أي مفتاح قديم.</div>
          <div class="bullet">في الربط عبر QR يجب إبقاء جلسة واتساب جاهزة قبل التشغيل الفعلي.</div>
        </div>
      </section>
      ${footer()}
    </div>
  `;
}

function buildSupportTemplate(input: ExportPackageInput) {
  return `
    <div class="package-shell" dir="rtl">
      ${brandHero(input, {
        badge: 'VAYRO SUPPORT HUB',
        title: 'دليل استخدام صندوق الدعم المشترك',
        description: 'كل ما يحتاجه فريقكم لربط رقم واتساب وتشغيل صندوق موحد وتوزيع المحادثات بين الموظفين.',
        mascot: BRAND.mascotSupport,
        service: 'الصندوق المشترك',
      })}
      ${portalSection(input, 'مدير الدعم')}
      <section class="panel">
        <div class="section-kicker">FIRST RUN</div>
        <div class="section-title">2. أول تشغيل</div>
        <div class="steps">
          <div class="step"><b>01</b><span>سجل الدخول إلى بوابة VAYRO بالحساب المسلم لك.</span></div>
          <div class="step"><b>02</b><span>افتح قسم ربط واتساب واضغط بدء جلسة ربط.</span></div>
          <div class="step"><b>03</b><span>من واتساب افتح الأجهزة المرتبطة وامسح QR.</span></div>
          <div class="step"><b>04</b><span>انتظر حتى تصبح حالة الجلسة Connected / Ready.</span></div>
        </div>
      </section>
      <section class="panel">
        <div class="section-kicker">SHARED INBOX</div>
        <div class="section-title">3. كيف يعمل الصندوق</div>
        <div class="feature-grid">
          <div class="feature"><b>01</b><strong>صندوق موحد</strong><span>كل الرسائل الواردة تظهر في مكان واحد.</span></div>
          <div class="feature"><b>02</b><strong>توزيع المحادثات</strong><span>تعيين أو Claim للمحادثات حسب الفريق.</span></div>
          <div class="feature"><b>03</b><strong>هوية الموظف</strong><span>يسجل النظام اسم الموظف الذي أرسل كل رد.</span></div>
          <div class="feature"><b>04</b><strong>أدوات الفريق</strong><span>ملاحظات داخلية، ردود سريعة، Tags وتقارير.</span></div>
        </div>
      </section>
      ${footer()}
    </div>
  `;
}

function buildHrTemplate(input: ExportPackageInput) {
  return `
    <div class="package-shell" dir="rtl">
      ${brandHero(input, {
        badge: 'VAYRO HR SUITE',
        title: 'دليل إدارة التوظيف عبر واتساب',
        description: 'دليل سريع لتشغيل وظائفكم، متابعة المرشحين والتواصل معهم عبر واتساب من لوحة موحدة.',
        mascot: BRAND.mascotHr,
        service: 'منصة التوظيف',
      })}
      ${portalSection(input, 'مدير التوظيف')}
      <section class="panel">
        <div class="section-kicker">GET STARTED</div>
        <div class="section-title">2. بداية التشغيل</div>
        <div class="steps">
          <div class="step"><b>01</b><span>سجل الدخول إلى لوحة التحكم بالحساب المسلم لك.</span></div>
          <div class="step"><b>02</b><span>اربط رقم واتساب الشركة من صفحة الربط.</span></div>
          <div class="step"><b>03</b><span>أنشئ الوظائف وحدد تفاصيل كل وظيفة.</span></div>
          <div class="step"><b>04</b><span>تابع المرشحين من صندوق التوظيف والتقارير.</span></div>
        </div>
      </section>
      <section class="panel">
        <div class="section-kicker">WORKFLOW</div>
        <div class="section-title">3. دورة عمل فريق التوظيف</div>
        <div class="feature-grid">
          <div class="feature"><b>01</b><strong>استقبال الطلبات</strong><span>كل طلب مرتبط بالوظيفة والمرشح.</span></div>
          <div class="feature"><b>02</b><strong>مراحل واضحة</strong><span>نقل المرشح بين المراحل وتسجيل كل تحديث.</span></div>
          <div class="feature"><b>03</b><strong>واتساب مباشر</strong><span>مراسلة المرشح من داخل لوحة VAYRO.</span></div>
          <div class="feature"><b>04</b><strong>تقارير الفريق</strong><span>متابعة أعداد الطلبات والحركة والنتائج.</span></div>
        </div>
      </section>
      ${footer()}
    </div>
  `;
}

function buildStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .package-shell, .package-shell * {
      font-family: 'Cairo', 'Tahoma', 'Arial Unicode MS', Arial, sans-serif !important;
      direction: rtl;
      unicode-bidi: plaintext;
      letter-spacing: 0;
      text-align: right;
    }
    .package-shell {
      width: 794px;
      padding: 34px;
      background: #f7faf9;
      color: #101828;
      line-height: 1.7;
    }
    .hero {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: 1.55fr 0.65fr;
      gap: 18px;
      min-height: 320px;
      padding: 32px;
      border-radius: 28px;
      background: #064E3B;
      color: #ffffff;
      margin-bottom: 22px;
      box-shadow: 0 14px 34px rgba(6, 78, 59, 0.18);
    }
    .hero::after {
      content: '';
      position: absolute;
      width: 230px;
      height: 230px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 50%;
      left: -90px;
      bottom: -120px;
    }
    .hero-content { position: relative; z-index: 2; }
    .hero-logo { width: 150px; height: auto; object-fit: contain; margin-bottom: 20px; }
    .hero-badge {
      display: inline-block;
      padding: 5px 11px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: #d1fae5;
      font-size: 10px;
      font-weight: 800;
      direction: ltr;
      text-align: center;
      margin-bottom: 10px;
    }
    .hero h1 { font-size: 29px; line-height: 1.42; font-weight: 800; margin-bottom: 10px; max-width: 500px; }
    .hero p { font-size: 13px; line-height: 1.9; color: #d8eee7; max-width: 520px; }
    .hero-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 18px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.14);
    }
    .hero-meta span { display: block; font-size: 9px; color: #a7cfc2; margin-bottom: 2px; }
    .hero-meta strong { display: block; font-size: 12px; color: #ffffff; font-weight: 700; }
    .hero-character {
      position: relative;
      z-index: 2;
      min-height: 255px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .mascot-glow {
      position: absolute;
      width: 170px;
      height: 170px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
    }
    .hero-mascot {
      position: relative;
      z-index: 2;
      width: 135px;
      max-height: 180px;
      object-fit: contain;
      filter: drop-shadow(0 14px 12px rgba(0,0,0,0.18));
      margin-bottom: 10px;
    }
    .hero-stamp { font-size: 12px; font-weight: 900; letter-spacing: 1px; direction: ltr; text-align: center; }
    .hero-stamp-sub { font-size: 6px; color: #a7cfc2; letter-spacing: 0.8px; direction: ltr; text-align: center; }
    .panel {
      background: #ffffff;
      border: 1px solid #dce8e4;
      border-radius: 20px;
      padding: 22px;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(15, 46, 39, 0.035);
    }
    .compact-panel { padding-bottom: 18px; }
    .section-kicker { color: #0f766e; font-size: 9px; font-weight: 900; letter-spacing: 1px; direction: ltr; text-align: right; margin-bottom: 3px; }
    .section-title { font-size: 18px; font-weight: 800; color: #10231f; margin-bottom: 13px; }
    .section-copy { font-size: 12.5px; color: #52635e; margin-bottom: 14px; line-height: 1.9; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
    .info-card { background: #f9fbfa; border: 1px solid #e0e9e6; border-radius: 14px; padding: 14px; min-height: 78px; }
    .info-card.accent { border-color: #b7ded1; background: #f0faf6; }
    .info-label { font-size: 10px; color: #71807b; margin-bottom: 5px; font-weight: 700; }
    .info-value { font-size: 12.5px; color: #13231f; line-height: 1.75; word-break: break-word; }
    .mono { font-family: 'Courier New', monospace !important; font-size: 10px; }
    .security-note { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: #f0fdf4; border: 1px solid #d2f0dc; color: #276749; font-size: 11px; line-height: 1.8; }
    .warning { display: flex; flex-direction: column; gap: 4px; background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; border-radius: 16px; padding: 14px 16px; margin-bottom: 16px; font-size: 12px; }
    .code-label { font-size: 11px; color: #65756f; font-weight: 800; margin: 13px 0 6px; direction: ltr; text-align: left; }
    pre {
      background: #10231f;
      color: #d7eee6;
      border: 1px solid #183b32;
      border-radius: 14px;
      padding: 15px;
      font-family: 'Courier New', monospace !important;
      font-size: 10px;
      line-height: 1.75;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      direction: ltr !important;
      text-align: left !important;
    }
    .ltr { direction: ltr !important; text-align: left !important; unicode-bidi: embed !important; }
    .steps, .bullet-list { display: flex; flex-direction: column; gap: 9px; }
    .step { display: grid; grid-template-columns: 36px 1fr; align-items: start; gap: 10px; background: #f9fbfa; border: 1px solid #e0e9e6; border-radius: 13px; padding: 11px 12px; font-size: 12px; color: #21332d; }
    .step b { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: #064E3B; color: #ffffff; font-size: 10px; direction: ltr; }
    .bullet { position: relative; background: #f9fbfa; border: 1px solid #e0e9e6; border-radius: 13px; padding: 11px 14px 11px 34px; font-size: 12px; color: #263833; }
    .bullet::before { content: '✓'; position: absolute; left: 12px; top: 10px; width: 17px; height: 17px; display: grid; place-items: center; border-radius: 50%; background: #dcfce7; color: #047857; font-size: 10px; font-weight: 900; }
    .template-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .template-card { border: 1px solid #dce8e4; border-radius: 14px; background: #f9fbfa; padding: 13px 15px; }
    .template-title { font-size: 12px; font-weight: 800; color: #10231f; margin-bottom: 6px; }
    .template-body { font-size: 12px; line-height: 1.85; color: #3b5049; white-space: pre-wrap; overflow-wrap: anywhere; }
    .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .feature { min-height: 100px; padding: 13px; border-radius: 14px; border: 1px solid #dce8e4; background: #f9fbfa; }
    .feature b { display: inline-block; color: #0f766e; font-size: 9px; direction: ltr; margin-bottom: 5px; }
    .feature strong { display: block; font-size: 12px; color: #13231f; margin-bottom: 4px; }
    .feature span { display: block; font-size: 11px; color: #667770; line-height: 1.75; }
    .package-footer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 4px 4px;
      border-top: 1px solid #dce8e4;
      margin-top: 8px;
      color: #5f706a;
    }
    .package-footer img { width: 86px; height: auto; object-fit: contain; }
    .package-footer strong { display: block; color: #064E3B; font-size: 11px; direction: ltr; text-align: right; }
    .package-footer span { display: block; font-size: 9px; }
    .footer-site { margin-right: auto; direction: ltr !important; text-align: left !important; font-size: 10px; color: #0f766e; }
  `;
}

function buildContent(input: ExportPackageInput) {
  switch (input.type) {
    case 'support': return buildSupportTemplate(input);
    case 'hr': return buildHrTemplate(input);
    case 'api':
    default: return buildApiTemplate(input);
  }
}

function getPageRenderHeight(pageWidthPx: number) {
  const pdfPageWidth = 595.28;
  const pdfPageHeight = 841.89;
  return Math.floor((pdfPageHeight / pdfPageWidth) * pageWidthPx) - 16;
}

function splitBlocksIntoPages(blocks: HTMLElement[], maxPageHeight: number) {
  const pages: HTMLElement[][] = [];
  let currentPage: HTMLElement[] = [];
  let currentHeight = 0;

  blocks.forEach((block) => {
    const styles = window.getComputedStyle(block);
    const blockHeight = block.offsetHeight + parseFloat(styles.marginTop || '0') + parseFloat(styles.marginBottom || '0');
    if (currentPage.length > 0 && currentHeight + blockHeight > maxPageHeight) {
      pages.push(currentPage);
      currentPage = [block];
      currentHeight = blockHeight;
      return;
    }
    currentPage.push(block);
    currentHeight += blockHeight;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

async function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }));
}

async function renderPageCanvas(stage: HTMLElement, sourceShell: HTMLElement, blocks: HTMLElement[]) {
  stage.innerHTML = `<style>${buildStyles()}</style>`;
  const pageShell = sourceShell.cloneNode(false) as HTMLElement;
  pageShell.innerHTML = '';
  blocks.forEach((block) => pageShell.appendChild(block.cloneNode(true)));
  stage.appendChild(pageShell);

  await document.fonts.ready;
  await waitForImages(stage);
  await new Promise((resolve) => setTimeout(resolve, 100));

  return html2canvas(stage, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#f7faf9',
    windowWidth: 794,
  });
}

export async function exportClientPackagePdf(input: ExportPackageInput) {
  const measurementHost = document.createElement('div');
  measurementHost.style.position = 'fixed';
  measurementHost.style.top = '-100000px';
  measurementHost.style.left = '0';
  measurementHost.style.width = '794px';
  measurementHost.style.zIndex = '-1';
  measurementHost.innerHTML = `<style>${buildStyles()}</style>${buildContent(input)}`;
  document.body.appendChild(measurementHost);

  await document.fonts.ready;
  await waitForImages(measurementHost);
  await new Promise((resolve) => setTimeout(resolve, 150));

  try {
    const shell = measurementHost.querySelector('.package-shell') as HTMLElement | null;
    if (!shell) throw new Error('Unable to prepare PDF content');

    const blocks = Array.from(shell.children) as HTMLElement[];
    const pageGroups = splitBlocksIntoPages(blocks, getPageRenderHeight(794));
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    const renderStage = document.createElement('div');
    renderStage.style.position = 'fixed';
    renderStage.style.top = '-100000px';
    renderStage.style.left = '0';
    renderStage.style.width = '794px';
    renderStage.style.zIndex = '-1';
    document.body.appendChild(renderStage);

    try {
      for (let index = 0; index < pageGroups.length; index += 1) {
        const canvas = await renderPageCanvas(renderStage, shell, pageGroups[index]);
        const image = canvas.toDataURL('image/png');
        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
        const renderWidth = canvas.width * ratio;
        const renderHeight = canvas.height * ratio;
        const x = (pageWidth - renderWidth) / 2;

        if (index > 0) pdf.addPage();
        pdf.addImage(image, 'PNG', x, 0, renderWidth, renderHeight);
      }
    } finally {
      document.body.removeChild(renderStage);
    }

    if (pageGroups.length === 0) {
      const canvas = await renderPageCanvas(measurementHost, shell, blocks);
      const image = canvas.toDataURL('image/png');
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const renderWidth = canvas.width * ratio;
      const renderHeight = canvas.height * ratio;
      pdf.addImage(image, 'PNG', (pageWidth - renderWidth) / 2, 0, renderWidth, renderHeight);
    }

    pdf.save(`vayro-${input.type || 'api'}-${input.tenantName}.pdf`);
  } finally {
    document.body.removeChild(measurementHost);
  }
}
