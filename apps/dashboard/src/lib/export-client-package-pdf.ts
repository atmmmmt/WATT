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

const OTP_TEMPLATE_FALLBACKS = {
  login:
    'رمز تسجيل الدخول الخاص بك هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  register:
    'رمز تأكيد إنشاء الحساب هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  forgotPassword:
    'رمز إعادة تعيين كلمة المرور هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value || '')
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

function buildApiTemplate(input: ExportPackageInput) {
  const docsUrl = `${input.apiBaseUrl.replace(/\/$/, '')}/docs`;
  const isMock = input.providerType === 'mock';
  const hasQrFlow =
    input.providerType === 'whatsapp_web' &&
    input.sessionStartEndpoint &&
    input.sessionStatusEndpoint &&
    input.sessionDisconnectEndpoint;

  const warning = isMock
    ? `
      <section class="warning">
        <div class="warning-title">تنبيه مهم</div>
        <p>هذه الحزمة مضبوطة على وضع <strong>Mock</strong> للتجربة فقط. لن يتم إرسال رسائل حقيقية حتى يتم تحويل المزود إلى ربط واتساب فعلي أو مزود إنتاج.</p>
      </section>
    `
    : '';

  const qrSection = hasQrFlow
    ? `
      <section class="panel">
        <div class="section-title">5. إدارة جلسة واتساب عبر QR</div>
        <p class="section-copy">هذه المسارات تستخدم فقط إذا كان الربط يعمل عبر <strong>whatsapp_web</strong>. يجب أن تصبح الجلسة في حالة <strong>ready</strong> قبل الإرسال الفعلي للـ OTP.</p>
        <div class="code-label">بدء جلسة الربط</div>
        <pre>POST ${escapeHtml(input.sessionStartEndpoint)}</pre>
        <div class="code-label">متابعة حالة الجلسة</div>
        <pre>GET ${escapeHtml(input.sessionStatusEndpoint)}</pre>
        <div class="code-label">فصل الجلسة</div>
        <pre>POST ${escapeHtml(input.sessionDisconnectEndpoint)}</pre>
      </section>
    `
    : '';

  const effectiveOtpTemplates = {
    login: input.otpTemplates?.login || OTP_TEMPLATE_FALLBACKS.login,
    register: input.otpTemplates?.register || OTP_TEMPLATE_FALLBACKS.register,
    forgotPassword:
      input.otpTemplates?.forgotPassword || OTP_TEMPLATE_FALLBACKS.forgotPassword,
  };

  return `
    <div class="package-shell" dir="rtl">
      <section class="hero hero-api">
        <div class="hero-main">
          <div class="eyebrow">VAYRO Delivery</div>
          <h1>حزمة تسليم خدمة واتساب OTP</h1>
          <p>هذه الحزمة موجهة لكم ولفريقكم التقني، وتحتوي على كل ما يلزم لتشغيل وربط خدمة التحقق عبر واتساب داخل موقعكم أو تطبيقكم.</p>
        </div>
        <div class="hero-summary">
          <div class="summary-row">
            <span>العميل</span>
            <strong>${escapeHtml(input.tenantName)}</strong>
          </div>
          <div class="summary-row">
            <span>الباقة</span>
            <strong>${escapeHtml(input.planName)}</strong>
          </div>
          <div class="summary-row">
            <span>المزود</span>
            <strong>${escapeHtml(providerLabel(input.providerType))}</strong>
          </div>
          <div class="summary-row">
            <span>ينتهي الاشتراك</span>
            <strong>${escapeHtml(input.subscriptionEnd)}</strong>
          </div>
        </div>
      </section>

      ${warning}

      <section class="panel">
        <div class="section-title">1. بيانات الربط الأساسية</div>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Base URL</div>
            <div class="info-value ltr">${escapeHtml(input.apiBaseUrl)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Swagger / Docs</div>
            <div class="info-value ltr">${escapeHtml(docsUrl)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">API Key</div>
            <div class="info-value ltr">${escapeHtml(input.rawKey || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Required Header</div>
            <div class="info-value ltr">x-api-key: ${escapeHtml(input.rawKey || '')}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">2. بيانات دخول بوابة العميل</div>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">رابط البوابة</div>
            <div class="info-value ltr">${escapeHtml(input.dashboardUrl || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">نوع الحساب</div>
            <div class="info-value">${escapeHtml(input.portalRoleLabel || 'مدير الشركة / بوابة العميل')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">البريد الإلكتروني</div>
            <div class="info-value ltr">${escapeHtml(input.portalEmail || input.contactEmail || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">كلمة المرور</div>
            <div class="info-value">${escapeHtml(input.portalPassword || 'استخدم كلمة المرور التي تم تسليمها عند التفعيل أو اطلب إعادة تعيينها')}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">3. المسارات المطلوبة للمطور</div>
        <div class="code-label">إرسال كود OTP</div>
        <pre>POST ${escapeHtml(input.sendEndpoint || '/v1/otp/send')}
{
  "phoneNumber": "+9639xxxxxxxx",
  "purpose": "login"
}</pre>
        <div class="code-label">التحقق من الكود</div>
        <pre>POST ${escapeHtml(input.verifyEndpoint || '/v1/otp/verify')}
{
  "phoneNumber": "+9639xxxxxxxx",
  "code": "123456"
}</pre>
      </section>

      <section class="panel">
        <div class="section-title">4. إرسال رسائل واتساب نصية عامة</div>
        <p class="section-copy">يتيح هذا المسار إرسال رسالة نصية حرة عبر نفس جلسة واتساب المتصلة — مفيد لإشعار مزودي الخدمة أو أي إخطارات داخلية تحتاجها. يستخدم نفس الـ API Key بدون أي إعداد إضافي.</p>
        <div class="code-label">إرسال رسالة نصية</div>
        <pre>POST ${escapeHtml(input.apiBaseUrl.replace(/\/$/, ''))}/v1/whatsapp/send
{
  "phoneNumber": "+9639xxxxxxxx",
  "message":     "نص الرسالة"
}</pre>
        <div class="code-label">استجابة النجاح</div>
        <pre>{ "success": true }</pre>
        <div class="code-label">استجابة الخطأ</div>
        <pre>{ "success": false, "message": "وصف الخطأ" }</pre>
      </section>

      ${qrSection}

      <section class="panel">
        <div class="section-title">6. خطوات التشغيل الصحيحة</div>
        <div class="steps">
          <div class="step"><b>1.</b> مرر <span class="ltr">API Key</span> داخل الهيدر <span class="ltr">x-api-key</span> في كل طلب.</div>
          <div class="step"><b>2.</b> استدعِ <span class="ltr">sendOtp</span> عندما يطلب المستخدم تسجيل الدخول أو التحقق.</div>
          <div class="step"><b>3.</b> استقبل الكود من المستخدم ثم استدعِ <span class="ltr">verifyOtp</span>.</div>
          <div class="step"><b>4.</b> يمكنكم من بوابة VAYRO متابعة حالة QR وإصدار مفاتيح API جديدة عند الحاجة، بينما تبقى نصوص الرسائل المعتمدة موضحة لكم في هذا الملف.</div>
          <div class="step"><b>5.</b> في حالة <span class="ltr">whatsapp_web</span> تأكد أن جلسة واتساب في حالة <span class="ltr">ready</span> قبل التشغيل الفعلي.</div>
          <div class="step"><b>6.</b> لا تشارك المفتاح الخام إلا مع المطور أو المسؤول التقني.</div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">7. قوالب رسائل OTP المعتمدة لحسابكم</div>
        <div class="bullet-list">
          <div class="bullet">هذه هي النصوص المعتمدة حالياً لحسابكم، وهي التي سيستخدمها النظام فعلياً عند إرسال رسائل OTP إلى مستخدميكم.</div>
          <div class="bullet">المتغير الإلزامي داخل كل رسالة هو <span class="ltr">{{code}}</span>، وهذا هو الموضع الذي سيظهر فيه رمز التحقق الفعلي داخل النص.</div>
          <div class="bullet">المتغير الاختياري <span class="ltr">{{expiresInMinutes}}</span> يضيف مدة صلاحية الكود داخل الرسالة عند الحاجة.</div>
        </div>
        <div class="template-grid">
          <div class="template-card">
            <div class="template-title">تسجيل الدخول</div>
            <div class="template-body">${escapeHtml(effectiveOtpTemplates.login)}</div>
          </div>
          <div class="template-card">
            <div class="template-title">تأكيد إنشاء الحساب</div>
            <div class="template-body">${escapeHtml(effectiveOtpTemplates.register)}</div>
          </div>
          <div class="template-card">
            <div class="template-title">نسيان كلمة المرور</div>
            <div class="template-body">${escapeHtml(effectiveOtpTemplates.forgotPassword)}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">8. ملاحظات تشغيلية</div>
        <div class="bullet-list">
          <div class="bullet">استخدم هذا المفتاح فقط داخل بيئة السيرفر أو داخل لوحة إدارة محمية، وليس داخل تطبيق عميل مكشوف.</div>
          <div class="bullet">إذا تم إصدار مفتاح جديد للتسليم، اعتبره المرجع المعتمد وأوقف مشاركة أي مفتاح أقدم.</div>
          <div class="bullet">في حالة الربط عبر QR يجب إبقاء جلسة واتساب في حالة جاهزة قبل التشغيل الفعلي.</div>
          <div class="bullet">المرجع التقني الأساسي لأي تكامل أو اختبار إضافي هو Swagger الموجود على نفس رابط الـ API.</div>
        </div>
      </section>
    </div>
  `;
}

function buildSupportTemplate(input: ExportPackageInput) {
  return `
    <div class="package-shell" dir="rtl">
      <section class="hero hero-support">
        <div class="hero-main">
          <div class="eyebrow">VAYRO Support Hub</div>
          <h1>دليل استخدام صندوق الدعم المشترك</h1>
          <p>هذا الملف موجه لكم لبدء تشغيل صندوق الدعم المشترك وإدارة فريق الدعم من داخل لوحة التحكم.</p>
        </div>
        <div class="hero-summary">
          <div class="summary-row"><span>العميل</span><strong>${escapeHtml(input.tenantName)}</strong></div>
          <div class="summary-row"><span>الخدمة</span><strong>صندوق الدعم المشترك</strong></div>
          <div class="summary-row"><span>ينتهي الاشتراك</span><strong>${escapeHtml(input.subscriptionEnd)}</strong></div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">1. بيانات الدخول</div>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">رابط البوابة</div>
            <div class="info-value ltr">${escapeHtml(input.dashboardUrl || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">البريد الإلكتروني</div>
            <div class="info-value ltr">${escapeHtml(input.portalEmail || input.contactEmail || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">كلمة المرور</div>
            <div class="info-value">${escapeHtml(input.portalPassword || 'استخدم كلمة المرور التي تم تسليمها عند التفعيل أو اطلب إعادة تعيينها')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">نوع الحساب</div>
            <div class="info-value">${escapeHtml(input.portalRoleLabel || 'مدير الدعم')}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">2. أول تشغيل</div>
        <div class="steps">
          <div class="step"><b>1.</b> سجل الدخول إلى لوحة التحكم بالحساب المسلم لك.</div>
          <div class="step"><b>2.</b> افتح قسم ربط واتساب الدعم.</div>
          <div class="step"><b>3.</b> امسح رمز QR من رقم واتساب الشركة.</div>
          <div class="step"><b>4.</b> انتظر حتى تظهر الحالة متصل أو جاهز.</div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">3. كيف يعمل الصندوق</div>
        <div class="bullet-list">
          <div class="bullet">كل الرسائل الواردة تظهر داخل صندوق المحادثات المشترك.</div>
          <div class="bullet">يمكن توزيع المحادثات على الموظفين أو المشرفين.</div>
          <div class="bullet">كل رسالة صادرة تحفظ باسم الموظف الذي أرسلها.</div>
          <div class="bullet">يمكن استخدام الملاحظات الداخلية والردود السريعة.</div>
        </div>
      </section>
    </div>
  `;
}

function buildHrTemplate(input: ExportPackageInput) {
  return `
    <div class="package-shell" dir="rtl">
      <section class="hero hero-hr">
        <div class="hero-main">
          <div class="eyebrow">VAYRO HR Suite</div>
          <h1>دليل إدارة التوظيف عبر واتساب</h1>
          <p>هذا الملف موجه لكم لبدء تشغيل منصة التوظيف عبر واتساب وإدارة الوظائف والمرشحين من داخل اللوحة.</p>
        </div>
        <div class="hero-summary">
          <div class="summary-row"><span>العميل</span><strong>${escapeHtml(input.tenantName)}</strong></div>
          <div class="summary-row"><span>الخدمة</span><strong>منصة التوظيف</strong></div>
          <div class="summary-row"><span>ينتهي الاشتراك</span><strong>${escapeHtml(input.subscriptionEnd)}</strong></div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">1. بيانات الدخول</div>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">رابط البوابة</div>
            <div class="info-value ltr">${escapeHtml(input.dashboardUrl || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">البريد الإلكتروني</div>
            <div class="info-value ltr">${escapeHtml(input.portalEmail || input.contactEmail || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">كلمة المرور</div>
            <div class="info-value">${escapeHtml(input.portalPassword || 'استخدم كلمة المرور التي تم تسليمها عند التفعيل أو اطلب إعادة تعيينها')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">نوع الحساب</div>
            <div class="info-value">${escapeHtml(input.portalRoleLabel || 'مدير التوظيف')}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">2. بداية التشغيل</div>
        <div class="steps">
          <div class="step"><b>1.</b> سجل الدخول إلى لوحة التحكم بالحساب المسلم لك.</div>
          <div class="step"><b>2.</b> اربط رقم واتساب الشركة من صفحة الربط.</div>
          <div class="step"><b>3.</b> أنشئ الوظائف من قسم الوظائف.</div>
          <div class="step"><b>4.</b> تابع المرشحين من صندوق التوظيف والتقارير.</div>
        </div>
      </section>
    </div>
  `;
}

function buildStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .package-shell,
    .package-shell * {
      font-family: 'Cairo', 'Tahoma', 'Arial Unicode MS', Arial, sans-serif !important;
      direction: rtl;
      unicode-bidi: plaintext;
      letter-spacing: 0;
      text-align: right;
    }
    .package-shell {
      width: 794px;
      padding: 40px;
      background: #ffffff;
      color: #101828;
      line-height: 1.7;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.5fr 0.95fr;
      gap: 20px;
      border-radius: 24px;
      padding: 28px;
      color: #ffffff;
      margin-bottom: 24px;
    }
    .hero-api { background: #0f766e; }
    .hero-support { background: #064E3B; }
    .hero-hr { background: #059669; }
    .eyebrow {
      display: inline-block;
      margin-bottom: 12px;
      padding: 5px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.16);
      font-size: 11px;
      font-weight: 700;
    }
    .hero-main h1 {
      font-size: 28px;
      line-height: 1.45;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .hero-main p {
      font-size: 14px;
      opacity: 0.92;
      line-height: 1.9;
    }
    .hero-summary {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 18px;
      padding: 18px;
      align-self: start;
    }
    .summary-row {
      margin-bottom: 12px;
    }
    .summary-row:last-child {
      margin-bottom: 0;
    }
    .summary-row span {
      display: block;
      font-size: 11px;
      opacity: 0.75;
      margin-bottom: 2px;
    }
    .summary-row strong {
      display: block;
      font-size: 15px;
      line-height: 1.7;
    }
    .warning {
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: #9a3412;
      border-radius: 18px;
      padding: 18px 20px;
      margin-bottom: 20px;
    }
    .warning-title {
      font-size: 15px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .warning p {
      font-size: 13px;
      line-height: 1.9;
    }
    .panel {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 22px;
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .section-copy {
      font-size: 13px;
      color: #475569;
      margin-bottom: 14px;
      line-height: 1.9;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px;
      min-height: 82px;
    }
    .info-label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .info-value {
      font-size: 13px;
      color: #0f172a;
      line-height: 1.8;
      word-break: break-word;
    }
    .code-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 700;
      margin: 14px 0 6px;
    }
    pre {
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      font-size: 11px;
      line-height: 1.8;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .ltr,
    pre,
    .code-label {
      direction: ltr;
      text-align: left;
    }
    .steps {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .step,
    .bullet {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.9;
      color: #1e293b;
    }
    .bullet-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .template-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 14px;
    }
    .template-card {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #f8fafc;
      padding: 14px 16px;
    }
    .template-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .template-body {
      font-size: 13px;
      line-height: 1.9;
      color: #334155;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `;
}

function buildContent(input: ExportPackageInput) {
  switch (input.type) {
    case 'support':
      return buildSupportTemplate(input);
    case 'hr':
      return buildHrTemplate(input);
    case 'api':
    default:
      return buildApiTemplate(input);
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
    const blockHeight =
      block.offsetHeight +
      parseFloat(styles.marginTop || '0') +
      parseFloat(styles.marginBottom || '0');

    if (currentPage.length > 0 && currentHeight + blockHeight > maxPageHeight) {
      pages.push(currentPage);
      currentPage = [block];
      currentHeight = blockHeight;
      return;
    }

    currentPage.push(block);
    currentHeight += blockHeight;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

async function renderPageCanvas(
  stage: HTMLElement,
  sourceShell: HTMLElement,
  blocks: HTMLElement[],
) {
  stage.innerHTML = `<style>${buildStyles()}</style>`;
  const pageShell = sourceShell.cloneNode(false) as HTMLElement;
  pageShell.innerHTML = '';
  blocks.forEach((block) => {
    pageShell.appendChild(block.cloneNode(true));
  });
  stage.appendChild(pageShell);

  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 80));

  return html2canvas(stage, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
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
  measurementHost.innerHTML = `
    <style>${buildStyles()}</style>
    ${buildContent(input)}
  `;

  document.body.appendChild(measurementHost);
  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 900));

  try {
    const shell = measurementHost.querySelector('.package-shell') as HTMLElement | null;
    if (!shell) {
      throw new Error('Unable to prepare PDF content');
    }

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
        const y = 0;

        if (index > 0) {
          pdf.addPage();
        }

        pdf.addImage(image, 'PNG', x, y, renderWidth, renderHeight);
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
