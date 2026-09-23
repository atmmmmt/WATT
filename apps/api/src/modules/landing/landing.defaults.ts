export const DEFAULT_LANDING_PAGE = {
  brand: {
    name: 'VAYRO',
    badge: 'WhatsApp SaaS',
    dashboardUrl: 'https://whatsapp-otp.prootech-agency.com',
  },
  hero: {
    eyebrow: 'منصة واتساب جاهزة للبيع والتشغيل',
    title: 'VAYRO',
    subtitle:
      'خدمة OTP عبر واتساب، صندوق دعم مشترك، وتوظيف HR من منصة واحدة قابلة للبيع كاشتراكات شهرية وسنوية.',
    primaryCta: 'احجز خدمتك الآن',
    secondaryCta: 'شاهد الباقات',
    trustLine: 'إعداد سريع، لوحة تحكم عربية، وربط واتساب عبر QR.',
  },
  stats: [
    { value: '3', label: 'منتجات داخل منصة واحدة' },
    { value: 'QR', label: 'ربط مباشر عبر واتساب' },
    { value: 'API', label: 'جاهز للمطورين' },
    { value: 'SaaS', label: 'اشتراكات قابلة للبيع' },
  ],
  features: [
    {
      title: 'WhatsApp OTP API',
      text: 'إرسال رموز تحقق لتسجيل الدخول، تأكيد الحساب، واستعادة كلمة المرور من رقم واتساب مربوط.',
    },
    {
      title: 'Shared Team Inbox',
      text: 'صندوق دعم مشترك للفريق مع توزيع محادثات، ملاحظات داخلية، وتقارير أداء.',
    },
    {
      title: 'HR Recruiting',
      text: 'إدارة وظائف ومرشحين وغرف موظفين مع رسائل واتساب وتقارير متابعة.',
    },
    {
      title: 'Client Delivery',
      text: 'ملفات تسليم PDF، مفاتيح API، وبوابة عميل مخصصة حسب الخدمة المباعة.',
    },
  ],
  plans: [
    {
      id: 'otp',
      name: 'VAYRO Starter',
      price: '49',
      currency: 'USD',
      period: 'شهرياً',
      description: 'مناسب للمواقع والتطبيقات التي تحتاج تحقق عبر واتساب.',
      features: ['OTP API', 'ربط QR', 'ملف تسليم PDF', 'حصة شهرية مرنة'],
      highlighted: false,
      cta: 'اطلب باقة OTP',
    },
    {
      id: 'support',
      name: 'Support Inbox',
      price: '149',
      currency: 'USD',
      period: 'شهرياً',
      description: 'صندوق واتساب مشترك لفريق الدعم والمبيعات.',
      features: ['موظفون متعددون', 'تعيين محادثات', 'ردود سريعة', 'تقارير فريق'],
      highlighted: true,
      cta: 'اطلب صندوق الدعم',
    },
    {
      id: 'all',
      name: 'VAYRO Business',
      price: '299',
      currency: 'USD',
      period: 'شهرياً',
      description: 'الحل الكامل للشركات التي تريد OTP ودعم وتوظيف.',
      features: ['كل المنتجات', 'لوحات عملاء', 'إعداد مخصص', 'دعم أولوية'],
      highlighted: false,
      cta: 'اطلب الحل الكامل',
    },
  ],
  testimonials: [
    {
      quote:
        'اختصرنا وقت الربط والتسليم، وصار العميل يستلم الخدمة كمنتج جاهز بدل مشروع مخصص.',
      name: 'مدير منتج SaaS',
      role: 'شركة تقنية',
    },
  ],
  faqs: [
    {
      question: 'هل يحتاج العميل إلى مطور؟',
      answer:
        'لخدمة OTP يحتاج المطور إلى API Key فقط. أما الدعم وHR فتعمل من داخل الداشبورد.',
    },
    {
      question: 'كيف يتم الدفع حالياً؟',
      answer:
        'الطلب يتحول إلى واتساب برسالة جاهزة، ويمكن لاحقاً إضافة بوابة دفع مباشرة.',
    },
    {
      question: 'هل يمكن تعديل الباقات والأسعار؟',
      answer: 'نعم، من لوحة الإدارة يمكن تعديل النصوص والباقات ورقم واتساب الطلب.',
    },
  ],
  whatsapp: {
    phoneNumber: '+963000000000',
    message:
      'مرحباً، أريد الاشتراك في {{planName}} بسعر {{price}} {{currency}}. اسمي: ',
    buttonLabel: 'اطلب عبر واتساب',
  },
  finalCta: {
    title: 'حوّل واتساب إلى منتج SaaS قابل للبيع',
    subtitle: 'اختر الباقة المناسبة وسنجهز لك الربط والتسليم.',
    buttonLabel: 'ابدأ الآن',
  },
  isPublished: true,
};
