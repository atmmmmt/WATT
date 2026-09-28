import { landingCopy, Language } from './landing-content';

/** Public launch surface: only advertise products that are ready for customers today. */
const publicCopy: Record<Language, {
  seoTitle: string;
  seoDescription: string;
  heroEyebrow: string;
  heroSubtitle: string;
  proofSubtitle: string;
  finalSubtitle: string;
  footerDescription: string;
  businessDescription: string;
  businessFeatures: string[];
}> = {
  ar: {
    seoTitle: 'VAYRO | واتساب OTP وصندوق دعم للشركات',
    seoDescription: 'VAYRO منصة واتساب للأعمال لإرسال OTP عبر واتساب وإدارة محادثات العملاء من صندوق دعم مشترك وآمن.',
    heroEyebrow: 'OTP • دعم العملاء • خصوصية التواصل عبر واتساب',
    heroSubtitle: 'VAYRO يجمع إرسال رموز التحقق وتوزيع محادثات العملاء على فريقك في لوحة عربية موحدة — بدون بناء نظام من الصفر.',
    proofSubtitle: 'مناسب للمتاجر، فرق الدعم، العيادات، شركات الخدمات والفرق التي تعتمد على واتساب يومياً.',
    finalSubtitle: 'خدمة واتساب احترافية للتفعيل ودعم العملاء جاهزة لشركتك خلال دقائق.',
    footerDescription: 'VAYRO منصة واتساب للأعمال: تحقق ودعم عملاء من مكان واحد.',
    businessDescription: 'الحل المتكامل للشركات التي تريد OTP وصندوق دعم ضمن مساحة عمل واحدة.',
    businessFeatures: ['OTP + صندوق الدعم', 'لوحات عملاء', 'إعداد مخصص', 'دعم أولوية'],
  },
  en: {
    seoTitle: 'VAYRO | WhatsApp OTP and Shared Support Inbox',
    seoDescription: 'VAYRO helps businesses send WhatsApp OTP and manage customer conversations from one secure shared inbox.',
    heroEyebrow: 'WhatsApp OTP • Customer support • Private communication',
    heroSubtitle: 'VAYRO brings verification and customer conversations into one clean workspace without building the stack from scratch.',
    proofSubtitle: 'Built for ecommerce, support teams, clinics, service businesses, and teams that run on WhatsApp.',
    finalSubtitle: 'Professional WhatsApp verification and customer support, ready for your business in minutes.',
    footerDescription: 'VAYRO is a WhatsApp business platform for verification and customer support.',
    businessDescription: 'An integrated workspace for companies that need OTP and a shared support inbox.',
    businessFeatures: ['OTP + shared inbox', 'Client workspaces', 'Custom setup', 'Priority support'],
  },
  tr: {
    seoTitle: 'VAYRO | WhatsApp OTP ve Ortak Destek Kutusu',
    seoDescription: 'VAYRO, işletmelerin WhatsApp OTP göndermesine ve müşteri konuşmalarını ortak bir destek kutusundan yönetmesine yardımcı olur.',
    heroEyebrow: 'WhatsApp OTP • Müşteri desteği • Gizli iletişim',
    heroSubtitle: 'VAYRO doğrulama ve müşteri konuşmalarını, sıfırdan sistem kurmadan tek bir çalışma alanında toplar.',
    proofSubtitle: 'E-ticaret, destek ekipleri, klinikler ve WhatsApp ile çalışan hizmet işletmeleri için.',
    finalSubtitle: 'WhatsApp doğrulama ve müşteri desteği dakikalar içinde işletmenize hazır.',
    footerDescription: 'VAYRO: doğrulama ve müşteri desteği için WhatsApp iş platformu.',
    businessDescription: 'OTP ve ortak destek kutusunu tek çalışma alanında isteyen şirketler için.',
    businessFeatures: ['OTP + destek kutusu', 'Müşteri alanları', 'Özel kurulum', 'Öncelikli destek'],
  },
  fr: {
    seoTitle: 'VAYRO | OTP WhatsApp et Inbox Support Partagée',
    seoDescription: 'VAYRO permet aux entreprises d’envoyer des OTP WhatsApp et de gérer les conversations clients depuis une inbox partagée sécurisée.',
    heroEyebrow: 'OTP WhatsApp • Support client • Communication privée',
    heroSubtitle: 'VAYRO réunit la vérification et les conversations clients dans un espace unique, sans construire tout le système.',
    proofSubtitle: 'Pensé pour l’e-commerce, les équipes support, les cliniques et les entreprises de services.',
    finalSubtitle: 'Vérification WhatsApp et support client professionnels, prêts en quelques minutes.',
    footerDescription: 'VAYRO est une plateforme WhatsApp pour la vérification et le support client.',
    businessDescription: 'Un espace intégré pour les entreprises qui veulent OTP et inbox support partagée.',
    businessFeatures: ['OTP + inbox support', 'Espaces clients', 'Configuration sur mesure', 'Support prioritaire'],
  },
};

(Object.keys(landingCopy) as Language[]).forEach((lang) => {
  const copy = landingCopy[lang];
  const clean = publicCopy[lang];

  copy.seo.title = clean.seoTitle;
  copy.seo.description = clean.seoDescription;
  copy.seo.keywords = copy.seo.keywords.filter((keyword) => !/hr|recruit|توظيف|işe|recrut/i.test(keyword));
  copy.hero.eyebrow = clean.heroEyebrow;
  copy.hero.subtitle = clean.heroSubtitle;
  copy.dashboard.hr = '';
  copy.dashboard.candidate = '';
  copy.proof.subtitle = clean.proofSubtitle;
  copy.proof.logos = copy.proof.logos.filter((logo) => !/hr|recruit|توظيف|işe|recrut/i.test(logo));
  copy.pain.items = copy.pain.items.filter((item) => !/hr|recruit|توظيف|işe|recrut/i.test(item));
  copy.services.items = copy.services.items.filter((_, index) => index < 2);
  copy.testimonials = copy.testimonials.filter((item) => !/hr|recruit|توظيف|موارد بشرية|işe|recrut/i.test(`${item.quote} ${item.name} ${item.role}`));
  copy.finalCta.subtitle = clean.finalSubtitle;
  copy.footer.description = clean.footerDescription;

  const business = copy.pricing.plans.find((plan) => plan.id === 'business');
  if (business) {
    business.description = clean.businessDescription;
    business.features = clean.businessFeatures;
  }
});
