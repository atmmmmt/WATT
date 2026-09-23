export const supportedLanguages = {
  ar: { label: 'العربية', short: 'AR', dir: 'rtl', locale: 'ar_SY' },
  en: { label: 'English', short: 'EN', dir: 'ltr', locale: 'en_US' },
  tr: { label: 'Türkçe', short: 'TR', dir: 'ltr', locale: 'tr_TR' },
  fr: { label: 'Français', short: 'FR', dir: 'ltr', locale: 'fr_FR' },
} as const;

export type Language = keyof typeof supportedLanguages;

export const defaultLanguage: Language = 'ar';

type Service = {
  title: string;
  description: string;
  features: string[];
  cta: string;
};

type Plan = {
  id: string;
  name: string;
  monthly: string;
  yearly: string;
  currency: string;
  description: string;
  features: string[];
  badge?: string;
  cta: string;
};

export type LandingCopy = {
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  nav: {
    home: string;
    services: string;
    how: string;
    pricing: string;
    faq: string;
    contact: string;
    cta: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primary: string;
    secondary: string;
    badges: string[];
  };
  dashboard: {
    otp: string;
    qr: string;
    inbox: string;
    hr: string;
    online: string;
    sent: string;
    candidate: string;
  };
  proof: {
    title: string;
    subtitle: string;
    logos: string[];
    metrics: Array<{ value: string; label: string }>;
  };
  pain: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: string[];
    resolution: string;
  };
  services: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: Service[];
  };
  how: {
    eyebrow: string;
    title: string;
    steps: string[];
  };
  results: {
    eyebrow: string;
    title: string;
    items: Array<{ value: string; label: string; text: string }>;
  };
  testimonials: Array<{ quote: string; name: string; role: string }>;
  pricing: {
    eyebrow: string;
    title: string;
    monthly: string;
    yearly: string;
    save: string;
    plans: Plan[];
  };
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
  finalCta: {
    title: string;
    subtitle: string;
    primary: string;
    secondary: string;
  };
  footer: {
    description: string;
    linksTitle: string;
    contactTitle: string;
    terms: string;
    privacy: string;
    rights: string;
  };
  whatsapp: {
    phoneNumber: string;
    message: string;
    buttonLabel: string;
  };
};

export const landingCopy: Record<Language, LandingCopy> = {
  ar: {
    seo: {
      title: 'VAYRO | واتساب OTP وصندوق دعم وتوظيف للشركات',
      description:
        'VAYRO منصة واتساب للأعمال تساعد الشركات على إرسال OTP عبر واتساب، إدارة صندوق دعم مشترك، وتنظيم التوظيف من لوحة واحدة.',
      keywords: [
        'واتساب OTP',
        'تفعيل واتساب',
        'OTP واتساب',
        'نظام دعم واتساب',
        'واتساب للشركات',
        'صندوق دعم واتساب',
        'توظيف عبر واتساب',
      ],
    },
    nav: {
      home: 'الرئيسية',
      services: 'الخدمات',
      how: 'كيف تعمل',
      pricing: 'الأسعار',
      faq: 'الأسئلة',
      contact: 'تواصل معنا',
      cta: 'ابدأ الآن',
    },
    hero: {
      eyebrow: 'OTP • دعم العملاء • التوظيف عبر واتساب',
      title: 'كل عمليات واتساب لشركتك في منصة واحدة',
      subtitle:
        'VAYRO يجمع إرسال رموز التحقق، توزيع محادثات العملاء على فريقك، ومتابعة المرشحين والمقابلات في لوحة عربية موحدة — بدون بناء نظام من الصفر.',
      primary: 'اطلب الخدمة الآن',
      secondary: 'شاهد كيف تعمل',
      badges: ['إعداد وربط سريع', 'حساب مستقل وآمن لكل شركة'],
    },
    dashboard: {
      otp: 'رمز التحقق 482913 جاهز للإرسال',
      qr: 'جلسة واتساب متصلة',
      inbox: '12 محادثة تنتظر الفريق',
      hr: '5 مرشحين بانتظار المتابعة',
      online: 'متصل الآن',
      sent: 'تم الإرسال من لوحة VAYRO',
      candidate: 'مقابلة غداً 11:30',
    },
    proof: {
      title: 'شركات تستخدم VAYRO يومياً',
      subtitle: 'مناسب للمتاجر، فرق الدعم، شركات الخدمات، ووكالات التوظيف.',
      logos: ['تجارة إلكترونية', 'عيادات', 'وكالات توظيف', 'دعم العملاء', 'خدمات ميدانية'],
      metrics: [
        { value: '+5000', label: 'رسالة واتساب يومياً' },
        { value: '+120', label: 'شركة تستخدم الخدمة' },
        { value: '99.9%', label: 'استقرار في التشغيل' },
      ],
    },
    pain: {
      eyebrow: 'المشكلة',
      title: 'هل ما زلت تدير واتساب شركتك بطريقة عشوائية؟',
      subtitle: 'الفوضى في واتساب لا تظهر فقط في الرسائل، بل في ضياع العملاء والتأخر بالرد وتكاليف التحقق.',
      items: [
        'OTP عبر SMS مكلف ومتعب',
        'ضياع المحادثات بين الموظفين',
        'لا يوجد تتبع واضح للمحادثات',
        'هاتف واحد لفريق كامل',
        'التوظيف عبر واتساب غير منظم',
        'لا توجد صلاحيات وتقارير',
      ],
      resolution: 'VAYRO يحوّل هذه الفوضى إلى نظام واضح ومنظم وجاهز للعمل والتوسع.',
    },
    services: {
      eyebrow: 'الخدمات',
      title: 'حلول واتساب داخل منصة واحدة',
      subtitle: 'اختر الخدمة المناسبة أو اجمع أكثر من منتج حسب حجم شركتك وطريقة عمل فريقك.',
      items: [
        {
          title: 'رموز التحقق OTP',
          description: 'أرسل رموز التحقق عبر واتساب بسرعة وبتكلفة أقل من SMS.',
          features: ['تسجيل دخول', 'إنشاء حساب', 'نسيان كلمة المرور', 'تأكيد العمليات'],
          cta: 'اطلب OTP',
        },
        {
          title: 'صندوق دعم الفريق',
          description: 'حوّل رقم واتساب الشركة إلى صندوق دعم لفريق كامل.',
          features: ['حسابات موظفين', 'تعيين محادثات', 'ملاحظات داخلية', 'ردود سريعة', 'تقارير أداء'],
          cta: 'اطلب صندوق الدعم',
        },
        {
          title: 'إدارة التوظيف',
          description: 'تابع المرشحين والمقابلات والتوظيف عبر واتساب.',
          features: ['إدارة المرشحين', 'توزيع الموظفين', 'متابعة المقابلات', 'سجل متابعة كامل'],
          cta: 'اطلب HR',
        },
      ],
    },
    how: {
      eyebrow: 'آلية العمل',
      title: 'تشغيل واضح خلال دقائق',
      steps: ['اختر الخدمة المناسبة', 'نستلم طلبك على واتساب', 'يتم تجهيز الحساب والربط', 'تربط واتساب عبر QR', 'تبدأ باستخدام الخدمة مباشرة'],
    },
    results: {
      eyebrow: 'النتائج',
      title: 'تكلفة أقل وتنظيم أعلى',
      items: [
        { value: '40%', label: 'توفير محتمل', text: 'تقليل الاعتماد على SMS في عمليات التحقق.' },
        { value: '1M+', label: 'رسالة واتساب', text: 'بنية جاهزة للتوسع مع نمو العملاء.' },
        { value: '120+', label: 'شركة', text: 'مصمم كمنتج SaaS قابل للبيع لشركات حقيقية.' },
      ],
    },
    testimonials: [
      { quote: 'VAYRO نقل دعم العملاء عندنا لمستوى مختلف، صار كل شيء واضح ومتابع.', name: 'مدير متجر إلكتروني', role: 'Ecommerce' },
      { quote: 'خفضنا تكلفة OTP بشكل واضح، والتسليم للمطور صار أسهل بكثير.', name: 'مؤسس شركة تقنية', role: 'SaaS Startup' },
      { quote: 'فريق التوظيف صار يعرف من تابع كل مرشح ومتى تم الرد عليه.', name: 'مديرة موارد بشرية', role: 'HR Agency' },
    ],
    pricing: {
      eyebrow: 'الباقات',
      title: 'باقات واضحة قابلة للتوسع',
      monthly: 'شهري',
      yearly: 'سنوي',
      save: 'وفر أكثر مع السنوي',
      plans: [
        {
          id: 'starter',
          name: 'VAYRO Starter',
          monthly: '49',
          yearly: '490',
          currency: '$',
          description: 'مناسب للمواقع والتطبيقات التي تحتاج تحقق عبر واتساب.',
          features: ['OTP API', 'ربط QR', 'ملف تسليم PDF', 'قوالب رسائل ثابتة'],
          cta: 'اطلب Starter',
        },
        {
          id: 'support',
          name: 'Support Inbox',
          monthly: '149',
          yearly: '1490',
          currency: '$',
          description: 'صندوق وارد مشترك لفريق الدعم والمبيعات.',
          features: ['موظفون متعددون', 'تعيين محادثات', 'ردود سريعة', 'تقارير فريق'],
          badge: 'الأكثر طلباً',
          cta: 'اطلب Support',
        },
        {
          id: 'business',
          name: 'Business Complete',
          monthly: '299',
          yearly: '2990',
          currency: '$',
          description: 'الحل الكامل للشركات التي تريد OTP ودعم وتوظيف.',
          features: ['كل المنتجات', 'لوحات عملاء', 'إعداد مخصص', 'دعم أولوية'],
          cta: 'اطلب Business',
        },
      ],
    },
    faq: {
      eyebrow: 'الأسئلة',
      title: 'أسئلة قبل البدء',
      items: [
        { question: 'هل أحتاج خبرة تقنية؟', answer: 'لا تحتاج خبرة تقنية لاستخدام الداشبورد. خدمة OTP تحتاج مطوراً فقط لربط API داخل موقعك أو تطبيقك.' },
        { question: 'هل يمكن إضافة موظفين؟', answer: 'نعم في خدمة صندوق الدعم يمكن إنشاء حسابات موظفين وتوزيع المحادثات عليهم.' },
        { question: 'هل OTP أرخص من SMS؟', answer: 'في أغلب الحالات واتساب يقلل التكلفة التشغيلية مقارنة برسائل SMS، خصوصاً مع الأحجام الكبيرة.' },
        { question: 'هل كل عميل يملك حساباً مستقلاً؟', answer: 'نعم كل شركة تعمل ضمن مساحة منفصلة ومفاتيح وصلاحيات خاصة بها.' },
        { question: 'هل يوجد API؟', answer: 'نعم خدمة OTP تقدم API واضحاً مع API Key وملف تسليم للمطور.' },
        { question: 'هل يوجد شرح وتسليم؟', answer: 'نعم يتم تسليم ملف PDF وبيانات الدخول أو الربط حسب الخدمة المطلوبة.' },
      ],
    },
    finalCta: {
      title: 'حوّل واتساب إلى نظام عمل',
      subtitle: 'خدمة واتساب احترافية للتفعيل، الدعم، والتوظيف جاهزة لشركتك خلال دقائق.',
      primary: 'اطلب الخدمة الآن',
      secondary: 'تحدث معنا عبر واتساب',
    },
    footer: {
      description: 'VAYRO منصة واتساب للأعمال: تحقق، دعم، وتوظيف من مكان واحد.',
      linksTitle: 'روابط سريعة',
      contactTitle: 'تواصل',
      terms: 'الشروط',
      privacy: 'الخصوصية',
      rights: 'جميع الحقوق محفوظة.',
    },
    whatsapp: {
      phoneNumber: '+963000000000',
      message: 'مرحباً، أريد الاشتراك في {{planName}} بسعر {{price}} {{currency}}.',
      buttonLabel: 'اطلب عبر واتساب',
    },
  },
  en: {
    seo: {
      title: 'VAYRO | WhatsApp OTP, Shared Inbox, and HR for Businesses',
      description:
        'VAYRO helps businesses send WhatsApp OTP, manage support teams from one inbox, and run HR recruiting workflows through WhatsApp.',
      keywords: ['WhatsApp OTP', 'WhatsApp Business Support', 'WhatsApp Shared Inbox', 'WhatsApp HR System', 'WhatsApp OTP API'],
    },
    nav: {
      home: 'Home',
      services: 'Services',
      how: 'How it works',
      pricing: 'Pricing',
      faq: 'FAQ',
      contact: 'Contact',
      cta: 'Start now',
    },
    hero: {
      eyebrow: 'Premium WhatsApp operations for modern teams',
      title: 'Run WhatsApp like a business system',
      subtitle:
        'VAYRO helps businesses verify users, support customers, and manage recruiting from one clean dashboard without building a system from scratch.',
      primary: 'Request the service',
      secondary: 'See how it works',
      badges: ['Live in minutes', 'Isolated account for each company'],
    },
    dashboard: {
      otp: 'OTP 482913 ready to send',
      qr: 'WhatsApp session connected',
      inbox: '12 conversations waiting',
      hr: '5 candidates need follow-up',
      online: 'Online now',
      sent: 'Sent from VAYRO dashboard',
      candidate: 'Interview tomorrow 11:30',
    },
    proof: {
      title: 'Businesses rely on VAYRO every day',
      subtitle: 'Built for ecommerce brands, service teams, support centers, and recruiting agencies.',
      logos: ['Ecommerce', 'Clinics', 'Recruiting', 'Support desks', 'Field services'],
      metrics: [
        { value: '+5000', label: 'WhatsApp messages daily' },
        { value: '+120', label: 'businesses served' },
        { value: '99.9%', label: 'operational stability' },
      ],
    },
    pain: {
      eyebrow: 'The problem',
      title: 'Still running your business WhatsApp manually?',
      subtitle: 'Manual WhatsApp work creates missed leads, slow replies, unclear ownership, and expensive verification.',
      items: ['SMS OTP is expensive', 'Chats get lost between employees', 'No clear conversation tracking', 'One phone for a whole team', 'Recruiting is scattered', 'No roles or reports'],
      resolution: 'VAYRO turns that chaos into a clear, trackable, sellable operating system.',
    },
    services: {
      eyebrow: 'Services',
      title: 'One platform for WhatsApp workflows',
      subtitle: 'Choose one product or combine multiple services as your company grows.',
      items: [
        { title: 'WhatsApp OTP', description: 'Send verification codes through WhatsApp faster and at lower cost than SMS.', features: ['Login OTP', 'Account signup', 'Password reset', 'Operation confirmation'], cta: 'Request OTP' },
        { title: 'Shared Team Inbox', description: 'Turn one company WhatsApp number into a shared support inbox.', features: ['Employee accounts', 'Conversation assignment', 'Internal notes', 'Quick replies', 'Team reports'], cta: 'Request Inbox' },
        { title: 'HR Recruiting', description: 'Track candidates, interviews, and recruiting communication over WhatsApp.', features: ['Candidate management', 'Recruiter assignment', 'Interview follow-up', 'Full timeline'], cta: 'Request HR' },
      ],
    },
    how: {
      eyebrow: 'Process',
      title: 'From request to live in minutes',
      steps: ['Choose the right service', 'We receive your WhatsApp request', 'Your account is prepared', 'Connect WhatsApp through QR', 'Start using the service immediately'],
    },
    results: {
      eyebrow: 'Results',
      title: 'Lower cost. Cleaner operations.',
      items: [
        { value: '40%', label: 'potential savings', text: 'Reduce dependency on SMS for verification flows.' },
        { value: '1M+', label: 'WhatsApp messages', text: 'Infrastructure ready to scale with customer growth.' },
        { value: '120+', label: 'companies', text: 'Designed as a SaaS product for real businesses.' },
      ],
    },
    testimonials: [
      { quote: 'VAYRO moved our support operation to a completely different level.', name: 'Ecommerce Manager', role: 'Online retail' },
      { quote: 'We reduced OTP cost and made developer handoff much easier.', name: 'Tech Founder', role: 'SaaS Startup' },
      { quote: 'Our recruiters finally know who followed up with each candidate.', name: 'HR Director', role: 'Recruiting Agency' },
    ],
    pricing: {
      eyebrow: 'Pricing',
      title: 'Clear packages for every workflow',
      monthly: 'Monthly',
      yearly: 'Yearly',
      save: 'Save more yearly',
      plans: [
        { id: 'starter', name: 'VAYRO Starter', monthly: '49', yearly: '490', currency: '$', description: 'For apps and websites that need WhatsApp verification.', features: ['OTP API', 'QR connection', 'Delivery PDF', 'Static message templates'], cta: 'Request Starter' },
        { id: 'support', name: 'Support Inbox', monthly: '149', yearly: '1490', currency: '$', description: 'A shared inbox for support and sales teams.', features: ['Multiple employees', 'Assignments', 'Quick replies', 'Team reports'], badge: 'Most popular', cta: 'Request Support' },
        { id: 'business', name: 'Business Complete', monthly: '299', yearly: '2990', currency: '$', description: 'The complete solution for OTP, support, and HR.', features: ['All products', 'Client dashboards', 'Custom setup', 'Priority support'], cta: 'Request Business' },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Questions before you start',
      items: [
        { question: 'Do I need technical experience?', answer: 'No for dashboard products. OTP API requires a developer to connect your website or app.' },
        { question: 'Can I add employees?', answer: 'Yes, the shared inbox supports employee accounts and conversation assignments.' },
        { question: 'Is WhatsApp OTP cheaper than SMS?', answer: 'In many cases it reduces operating cost, especially at larger volumes.' },
        { question: 'Does each client get an isolated account?', answer: 'Yes, every company has separate access, keys, permissions, and data.' },
        { question: 'Is there an API?', answer: 'Yes, OTP includes API endpoints, API Key, and developer delivery files.' },
        { question: 'Do you provide handoff materials?', answer: 'Yes, each service can be delivered with a PDF and access details.' },
      ],
    },
    finalCta: {
      title: 'Turn WhatsApp into operations',
      subtitle: 'A professional WhatsApp service for verification, support, and recruiting ready in minutes.',
      primary: 'Request the service',
      secondary: 'Talk on WhatsApp',
    },
    footer: {
      description: 'VAYRO is a WhatsApp business platform for verification, support, and recruiting.',
      linksTitle: 'Quick links',
      contactTitle: 'Contact',
      terms: 'Terms',
      privacy: 'Privacy',
      rights: 'All rights reserved.',
    },
    whatsapp: {
      phoneNumber: '+963000000000',
      message: 'Hello, I want to subscribe to {{planName}} for {{price}} {{currency}}.',
      buttonLabel: 'Order on WhatsApp',
    },
  },
  tr: {
    seo: {
      title: 'VAYRO | WhatsApp OTP, Destek Kutusu ve HR Sistemi',
      description:
        'VAYRO, şirketlerin WhatsApp OTP göndermesine, destek ekiplerini tek kutudan yönetmesine ve işe alım süreçlerini WhatsApp üzerinden yürütmesine yardımcı olur.',
      keywords: ['WhatsApp OTP sistemi', 'WhatsApp destek sistemi', 'WhatsApp müşteri desteği'],
    },
    nav: { home: 'Ana sayfa', services: 'Hizmetler', how: 'Nasıl çalışır', pricing: 'Fiyatlar', faq: 'SSS', contact: 'İletişim', cta: 'Başla' },
    hero: {
      eyebrow: 'Modern ekipler için profesyonel WhatsApp operasyonu',
      title: 'WhatsApp operasyonunuzu düzenleyin',
      subtitle:
        'VAYRO; doğrulama, müşteri desteği ve işe alım süreçlerini sıfırdan sistem kurmadan tek panelden yönetmenizi sağlar.',
      primary: 'Hizmeti iste',
      secondary: 'Nasıl çalışır?',
      badges: ['Dakikalar içinde aktif', 'Hızlı QR bağlantısı', 'Ekipler için uygun', 'Kolay yönetim paneli'],
    },
    dashboard: { otp: 'OTP 482913 gönderime hazır', qr: 'WhatsApp oturumu bağlı', inbox: '12 konuşma bekliyor', hr: '5 aday takip bekliyor', online: 'Çevrimiçi', sent: 'VAYRO panelinden gönderildi', candidate: 'Yarın 11:30 görüşme' },
    proof: {
      title: 'Şirketler her gün VAYRO kullanıyor',
      subtitle: 'E-ticaret, servis ekipleri, destek merkezleri ve işe alım ajansları için.',
      logos: ['E-ticaret', 'Klinikler', 'İşe alım', 'Destek ekipleri', 'Saha hizmetleri'],
      metrics: [{ value: '+5000', label: 'günlük WhatsApp mesajı' }, { value: '+120', label: 'aktif şirket' }, { value: '99.9%', label: 'operasyon kararlılığı' }],
    },
    pain: {
      eyebrow: 'Problem',
      title: 'WhatsApp iş akışınızı hala manuel mi yönetiyorsunuz?',
      subtitle: 'Manuel süreçler müşteri kaybı, yavaş yanıt, belirsiz sorumluluk ve yüksek doğrulama maliyeti oluşturur.',
      items: ['SMS OTP pahalı', 'Konuşmalar çalışanlar arasında kaybolur', 'Net takip yok', 'Tüm ekip için tek telefon', 'İşe alım dağınık', 'Rol ve rapor yok'],
      resolution: 'VAYRO bu dağınıklığı ölçülebilir ve düzenli bir sisteme dönüştürür.',
    },
    services: {
      eyebrow: 'Hizmetler',
      title: 'WhatsApp iş akışları tek yerde',
      subtitle: 'Tek ürün seçin veya şirketiniz büyüdükçe birden fazla hizmeti birleştirin.',
      items: [
        { title: 'WhatsApp OTP', description: 'Doğrulama kodlarını SMS yerine WhatsApp ile daha hızlı gönderin.', features: ['Giriş doğrulama', 'Hesap oluşturma', 'Şifre sıfırlama', 'İşlem onayı'], cta: 'OTP iste' },
        { title: 'Shared Team Inbox', description: 'Tek WhatsApp numarasını ekip destek kutusuna çevirin.', features: ['Çalışan hesapları', 'Konuşma atama', 'İç notlar', 'Hızlı yanıtlar', 'Ekip raporları'], cta: 'Destek kutusu iste' },
        { title: 'HR Recruiting', description: 'Adayları, görüşmeleri ve işe alım iletişimini WhatsApp ile takip edin.', features: ['Aday yönetimi', 'Sorumlu atama', 'Görüşme takibi', 'Tam zaman çizelgesi'], cta: 'HR iste' },
      ],
    },
    how: { eyebrow: 'Süreç', title: 'Dakikalar içinde hazır', steps: ['Doğru hizmeti seçin', 'Talebinizi WhatsApp üzerinden alırız', 'Hesabınız hazırlanır', 'WhatsApp QR ile bağlanır', 'Hemen kullanmaya başlarsınız'] },
    results: {
      eyebrow: 'Sonuçlar',
      title: 'Daha düşük maliyet. Daha düzenli ekip.',
      items: [{ value: '40%', label: 'tasarruf potansiyeli', text: 'Doğrulamada SMS bağımlılığını azaltın.' }, { value: '1M+', label: 'WhatsApp mesajı', text: 'Müşteri büyümesine hazır altyapı.' }, { value: '120+', label: 'şirket', text: 'Gerçek şirketler için SaaS olarak tasarlandı.' }],
    },
    testimonials: [
      { quote: 'VAYRO destek operasyonumuzu çok daha düzenli hale getirdi.', name: 'E-ticaret Yöneticisi', role: 'Online satış' },
      { quote: 'OTP maliyetimiz azaldı ve geliştiriciye teslim çok kolaylaştı.', name: 'Teknoloji Kurucusu', role: 'SaaS Startup' },
      { quote: 'İK ekibi artık her adayın kim tarafından takip edildiğini görüyor.', name: 'İK Direktörü', role: 'Recruiting Agency' },
    ],
    pricing: {
      eyebrow: 'Fiyatlar',
      title: 'Net ve ölçeklenebilir paketler',
      monthly: 'Aylık',
      yearly: 'Yıllık',
      save: 'Yıllıkta daha avantajlı',
      plans: [
        { id: 'starter', name: 'VAYRO Starter', monthly: '49', yearly: '490', currency: '$', description: 'WhatsApp doğrulama isteyen uygulama ve web siteleri için.', features: ['OTP API', 'QR bağlantısı', 'Teslim PDF', 'Sabit mesaj şablonları'], cta: 'Starter iste' },
        { id: 'support', name: 'Support Inbox', monthly: '149', yearly: '1490', currency: '$', description: 'Destek ve satış ekipleri için ortak gelen kutusu.', features: ['Çoklu çalışan', 'Atamalar', 'Hızlı yanıtlar', 'Ekip raporları'], badge: 'En popüler', cta: 'Support iste' },
        { id: 'business', name: 'Business Complete', monthly: '299', yearly: '2990', currency: '$', description: 'OTP, destek ve HR için komple çözüm.', features: ['Tüm ürünler', 'Müşteri panelleri', 'Özel kurulum', 'Öncelikli destek'], cta: 'Business iste' },
      ],
    },
    faq: {
      eyebrow: 'SSS',
      title: 'Başlamadan önce sorular',
      items: [
        { question: 'Teknik bilgi gerekir mi?', answer: 'Panel ürünleri için gerekmez. OTP API entegrasyonu için geliştirici gerekir.' },
        { question: 'Çalışan ekleyebilir miyim?', answer: 'Evet, destek kutusunda çalışan hesapları ve konuşma atamaları vardır.' },
        { question: 'WhatsApp OTP SMS’ten ucuz mu?', answer: 'Birçok senaryoda özellikle yüksek hacimde operasyon maliyetini azaltır.' },
        { question: 'Her müşteri ayrı mı çalışır?', answer: 'Evet, her şirketin kendi erişimi, anahtarları, yetkileri ve verileri vardır.' },
        { question: 'API var mı?', answer: 'Evet, OTP hizmeti API endpointleri, API Key ve geliştirici teslim dosyaları içerir.' },
        { question: 'Teslim dokümanı var mı?', answer: 'Evet, hizmete göre PDF ve erişim bilgileri teslim edilir.' },
      ],
    },
    finalCta: { title: 'WhatsApp’i iş sistemine çevirin', subtitle: 'Doğrulama, destek ve işe alım için dakikalar içinde hazır profesyonel WhatsApp hizmeti.', primary: 'Hizmeti iste', secondary: 'WhatsApp ile konuş' },
    footer: { description: 'VAYRO doğrulama, destek ve işe alım için WhatsApp iş platformudur.', linksTitle: 'Hızlı bağlantılar', contactTitle: 'İletişim', terms: 'Şartlar', privacy: 'Gizlilik', rights: 'Tüm hakları saklıdır.' },
    whatsapp: { phoneNumber: '+963000000000', message: 'Merhaba, {{planName}} paketine {{price}} {{currency}} fiyatıyla abone olmak istiyorum.', buttonLabel: 'WhatsApp ile sipariş ver' },
  },
  fr: {
    seo: {
      title: 'VAYRO | OTP WhatsApp, Support Partage et RH pour Entreprises',
      description:
        'VAYRO aide les entreprises à envoyer des OTP WhatsApp, gérer le support client depuis une boîte partagée et organiser le recrutement via WhatsApp.',
      keywords: ['OTP WhatsApp', 'Support client WhatsApp', 'Système WhatsApp entreprise'],
    },
    nav: { home: 'Accueil', services: 'Services', how: 'Fonctionnement', pricing: 'Tarifs', faq: 'FAQ', contact: 'Contact', cta: 'Commencer' },
    hero: {
      eyebrow: 'Opérations WhatsApp pour équipes modernes',
      title: 'Transformez WhatsApp en système clair',
      subtitle:
        'VAYRO aide les entreprises a verifier les utilisateurs, gerer le support client et suivre le recrutement depuis un seul tableau de bord.',
      primary: 'Demander le service',
      secondary: 'Voir le fonctionnement',
      badges: ['Actif en quelques minutes', 'Connexion QR rapide', 'Concu pour les equipes', 'Tableau de bord simple'],
    },
    dashboard: { otp: 'OTP 482913 pret a envoyer', qr: 'Session WhatsApp connectee', inbox: '12 conversations en attente', hr: '5 candidats a suivre', online: 'En ligne', sent: 'Envoye depuis VAYRO', candidate: 'Entretien demain 11:30' },
    proof: {
      title: 'Des entreprises utilisent VAYRO chaque jour',
      subtitle: 'Pour e-commerce, equipes de service, support client et agences de recrutement.',
      logos: ['E-commerce', 'Cliniques', 'Recrutement', 'Support', 'Services terrain'],
      metrics: [{ value: '+5000', label: 'messages WhatsApp par jour' }, { value: '+120', label: 'entreprises servies' }, { value: '99.9%', label: 'stabilite operationnelle' }],
    },
    pain: {
      eyebrow: 'Le probleme',
      title: 'Votre WhatsApp professionnel est encore gere manuellement ?',
      subtitle: 'Le travail manuel cree des prospects perdus, des reponses lentes, une responsabilite floue et des couts de verification eleves.',
      items: ['SMS OTP couteux', 'Conversations perdues entre employes', 'Aucun suivi clair', 'Un seul telephone pour toute une equipe', 'Recrutement disperse', 'Pas de roles ni rapports'],
      resolution: 'VAYRO transforme ce chaos en systeme clair, suivi et pret a vendre.',
    },
    services: {
      eyebrow: 'Services',
      title: 'Tous vos flux WhatsApp au meme endroit',
      subtitle: 'Choisissez un produit ou combinez plusieurs services selon la croissance de votre entreprise.',
      items: [
        { title: 'WhatsApp OTP', description: 'Envoyez les codes de verification via WhatsApp plus vite et a moindre cout que le SMS.', features: ['Connexion', 'Creation de compte', 'Mot de passe oublie', 'Confirmation operation'], cta: 'Demander OTP' },
        { title: 'Shared Team Inbox', description: 'Transformez un numero WhatsApp en boite de support partagee.', features: ['Comptes employes', 'Assignation', 'Notes internes', 'Reponses rapides', 'Rapports equipe'], cta: 'Demander Support' },
        { title: 'HR Recruiting', description: 'Suivez candidats, entretiens et recrutement avec WhatsApp.', features: ['Gestion candidats', 'Assignation recruteurs', 'Suivi entretiens', 'Timeline complete'], cta: 'Demander RH' },
      ],
    },
    how: { eyebrow: 'Processus', title: 'Pret en quelques minutes', steps: ['Choisissez le service', 'Nous recevons votre demande WhatsApp', 'Votre compte est prepare', 'Connectez WhatsApp par QR', 'Commencez immediatement'] },
    results: {
      eyebrow: 'Resultats',
      title: 'Moins de couts. Plus d ordre.',
      items: [{ value: '40%', label: 'economie potentielle', text: 'Reduisez la dependance au SMS pour la verification.' }, { value: '1M+', label: 'messages WhatsApp', text: 'Infrastructure prete a grandir avec vos clients.' }, { value: '120+', label: 'entreprises', text: 'Concu comme un SaaS pour de vraies entreprises.' }],
    },
    testimonials: [
      { quote: 'VAYRO a amene notre support client a un niveau beaucoup plus professionnel.', name: 'Responsable e-commerce', role: 'Commerce en ligne' },
      { quote: 'Nous avons reduit le cout OTP et simplifie la livraison aux developpeurs.', name: 'Fondateur tech', role: 'SaaS Startup' },
      { quote: 'Notre equipe RH sait enfin qui a suivi chaque candidat.', name: 'Directrice RH', role: 'Agence RH' },
    ],
    pricing: {
      eyebrow: 'Tarifs',
      title: 'Des offres claires et evolutives',
      monthly: 'Mensuel',
      yearly: 'Annuel',
      save: 'Economisez avec l annuel',
      plans: [
        { id: 'starter', name: 'VAYRO Starter', monthly: '49', yearly: '490', currency: '$', description: 'Pour sites et applications qui ont besoin de verification WhatsApp.', features: ['OTP API', 'Connexion QR', 'PDF de livraison', 'Modeles fixes'], cta: 'Demander Starter' },
        { id: 'support', name: 'Support Inbox', monthly: '149', yearly: '1490', currency: '$', description: 'Boite partagee pour support et ventes.', features: ['Plusieurs employes', 'Assignations', 'Reponses rapides', 'Rapports equipe'], badge: 'Le plus demande', cta: 'Demander Support' },
        { id: 'business', name: 'Business Complete', monthly: '299', yearly: '2990', currency: '$', description: 'Solution complete pour OTP, support et RH.', features: ['Tous les produits', 'Tableaux clients', 'Configuration dediee', 'Support prioritaire'], cta: 'Demander Business' },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Questions avant de commencer',
      items: [
        { question: 'Faut-il une competence technique ?', answer: 'Non pour les produits dashboard. L API OTP necessite un developpeur pour connecter votre site ou application.' },
        { question: 'Puis-je ajouter des employes ?', answer: 'Oui, la boite support permet les comptes employes et l assignation des conversations.' },
        { question: 'WhatsApp OTP est-il moins cher que SMS ?', answer: 'Dans beaucoup de cas, il reduit le cout operationnel surtout a volume important.' },
        { question: 'Chaque client est-il isole ?', answer: 'Oui, chaque entreprise a ses acces, cles, permissions et donnees separes.' },
        { question: 'Existe-t-il une API ?', answer: 'Oui, OTP inclut endpoints API, API Key et fichiers de livraison developpeur.' },
        { question: 'Fournissez-vous une documentation ?', answer: 'Oui, chaque service peut etre livre avec PDF et details d acces.' },
      ],
    },
    finalCta: { title: 'Faites de WhatsApp un vrai systeme', subtitle: 'Un service WhatsApp professionnel pour verification, support et recrutement, pret en quelques minutes.', primary: 'Demander le service', secondary: 'Parler sur WhatsApp' },
    footer: { description: 'VAYRO est une plateforme WhatsApp business pour verification, support et recrutement.', linksTitle: 'Liens rapides', contactTitle: 'Contact', terms: 'Conditions', privacy: 'Confidentialite', rights: 'Tous droits reserves.' },
    whatsapp: { phoneNumber: '+963000000000', message: 'Bonjour, je veux souscrire a {{planName}} pour {{price}} {{currency}}.', buttonLabel: 'Commander sur WhatsApp' },
  },
};

export function normalizeLanguage(value: string | undefined): Language {
  return value && value in supportedLanguages ? (value as Language) : defaultLanguage;
}
