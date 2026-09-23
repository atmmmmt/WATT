import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Globe2,
  KeyRound,
  Languages,
  Menu,
  MessageCircle,
  Moon,
  PhoneCall,
  Send,
  ShieldCheck,
  Sun,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import {
  defaultLanguage,
  landingCopy,
  Language,
  normalizeLanguage,
  supportedLanguages,
} from './landing-content';
import { applySeo } from './seo';
import { Mascot } from './Mascot';

gsap.registerPlugin(ScrollTrigger);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const emptyOrderForm = {
  customerName: '',
  companyName: '',
  phoneNumber: '',
  email: '',
  website: '',
  useCase: '',
  notes: '',
};

const orderLabels: Record<
  Language,
  {
    title: string;
    subtitle: string;
    selectedPlan: string;
    customerName: string;
    companyName: string;
    phoneNumber: string;
    email: string;
    website: string;
    useCase: string;
    notes: string;
    submit: string;
    submitting: string;
    close: string;
    success: string;
    error: string;
    whatsappFallback: string;
  }
> = {
  ar: {
    title: 'طلب الخدمة',
    subtitle: 'املأ البيانات وسنفتح لك واتساب برسالة جاهزة، وسيتم حفظ الطلب داخل لوحة الإدارة.',
    selectedPlan: 'الخدمة المختارة',
    customerName: 'اسمك الكامل',
    companyName: 'اسم الشركة أو المشروع',
    phoneNumber: 'رقم واتساب للتواصل',
    email: 'البريد الإلكتروني',
    website: 'رابط الموقع أو التطبيق',
    useCase: 'ما الاستخدام المطلوب؟',
    notes: 'ملاحظات إضافية',
    submit: 'إرسال الطلب على واتساب',
    submitting: 'جار إرسال الطلب...',
    close: 'إغلاق',
    success: 'تم حفظ الطلب. إذا لم يفتح واتساب تلقائياً استخدم الزر التالي.',
    error: 'تعذر إرسال الطلب. تحقق من البيانات وحاول مرة أخرى.',
    whatsappFallback: 'فتح واتساب',
  },
  en: {
    title: 'Request service',
    subtitle: 'Fill in your details. We will save the request and open WhatsApp with a ready message.',
    selectedPlan: 'Selected service',
    customerName: 'Full name',
    companyName: 'Company or project',
    phoneNumber: 'WhatsApp number',
    email: 'Email address',
    website: 'Website or app URL',
    useCase: 'What do you need?',
    notes: 'Extra notes',
    submit: 'Send request on WhatsApp',
    submitting: 'Sending request...',
    close: 'Close',
    success: 'Request saved. If WhatsApp did not open automatically, use the button below.',
    error: 'Could not send the request. Check the details and try again.',
    whatsappFallback: 'Open WhatsApp',
  },
  tr: {
    title: 'Hizmet talebi',
    subtitle: 'Bilgilerinizi doldurun. Talep kaydedilir ve hazir WhatsApp mesaji acilir.',
    selectedPlan: 'Secilen hizmet',
    customerName: 'Ad soyad',
    companyName: 'Sirket veya proje',
    phoneNumber: 'WhatsApp numarasi',
    email: 'E-posta',
    website: 'Web sitesi veya uygulama',
    useCase: 'Neye ihtiyaciniz var?',
    notes: 'Ek notlar',
    submit: 'WhatsApp ile gonder',
    submitting: 'Gonderiliyor...',
    close: 'Kapat',
    success: 'Talep kaydedildi. WhatsApp acilmadiysa asagidaki butonu kullanin.',
    error: 'Talep gonderilemedi. Bilgileri kontrol edip tekrar deneyin.',
    whatsappFallback: 'WhatsApp ac',
  },
  fr: {
    title: 'Demander le service',
    subtitle: 'Remplissez vos informations. La demande sera enregistree et WhatsApp ouvrira un message pret.',
    selectedPlan: 'Service choisi',
    customerName: 'Nom complet',
    companyName: 'Entreprise ou projet',
    phoneNumber: 'Numero WhatsApp',
    email: 'Adresse email',
    website: 'Site ou application',
    useCase: 'Votre besoin',
    notes: 'Notes',
    submit: 'Envoyer sur WhatsApp',
    submitting: 'Envoi...',
    close: 'Fermer',
    success: 'Demande enregistree. Si WhatsApp ne s ouvre pas, utilisez le bouton ci-dessous.',
    error: 'Impossible d envoyer la demande. Verifiez les informations puis reessayez.',
    whatsappFallback: 'Ouvrir WhatsApp',
  },
};

const dashboardPreviewLabels: Record<
  Language,
  {
    control: string;
    otp: string;
    inbox: string;
    hr: string;
    firstAgent: string;
    secondAgent: string;
    support: string;
    sales: string;
    skip: string;
  }
> = {
  ar: {
    control: 'لوحة VAYRO',
    otp: 'التحقق',
    inbox: 'الصندوق',
    hr: 'التوظيف',
    firstAgent: 'سارة',
    secondAgent: 'محمد',
    support: 'دعم العملاء',
    sales: 'مبيعات',
    skip: 'انتقل إلى المحتوى',
  },
  en: {
    control: 'VAYRO workspace',
    otp: 'OTP',
    inbox: 'Inbox',
    hr: 'HR',
    firstAgent: 'Sarah',
    secondAgent: 'Mohammad',
    support: 'Support',
    sales: 'Sales',
    skip: 'Skip to main content',
  },
  tr: {
    control: 'VAYRO paneli',
    otp: 'OTP',
    inbox: 'Gelen kutusu',
    hr: 'İK',
    firstAgent: 'Sarah',
    secondAgent: 'Mohammad',
    support: 'Destek',
    sales: 'Satış',
    skip: 'İçeriğe geç',
  },
  fr: {
    control: 'Espace VAYRO',
    otp: 'OTP',
    inbox: 'Inbox',
    hr: 'RH',
    firstAgent: 'Sarah',
    secondAgent: 'Mohammad',
    support: 'Support',
    sales: 'Ventes',
    skip: 'Aller au contenu',
  },
};

type ApiPlan = {
  id: string;
  name: string;
  price: string;
  currency: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
};

type ApiLandingContent = {
  brand?: {
    name?: string;
    badge?: string;
  };
  plans?: ApiPlan[];
  whatsapp?: {
    phoneNumber?: string;
    message?: string;
    buttonLabel?: string;
  };
};

type DisplayPlan = {
  id: string;
  name: string;
  monthly: string;
  yearly: string;
  currency: string;
  description: string;
  features: string[];
  badge?: string;
  cta: string;
  highlighted?: boolean;
};

function mapApiPlans(apiPlans: ApiPlan[] | undefined, fallback: DisplayPlan[]): DisplayPlan[] {
  if (!apiPlans?.length) return fallback;

  return apiPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    monthly: plan.price,
    yearly: plan.price,
    currency: plan.currency,
    description: plan.description,
    features: plan.features,
    badge: plan.highlighted ? fallback.find((item) => item.badge)?.badge : undefined,
    cta: plan.cta,
    highlighted: plan.highlighted,
  }));
}

function LandingRoute() {
  const params = useParams();
  const location = useLocation();
  const { i18n } = useTranslation();
  const language = normalizeLanguage(params.lang);
  const copy = landingCopy[language];
  const isRtl = supportedLanguages[language].dir === 'rtl';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState(0);
  const [apiContent, setApiContent] = useState<ApiLandingContent>({});
  const [selectedPlan, setSelectedPlan] = useState<DisplayPlan | null>(null);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');
  const [orderWhatsappUrl, setOrderWhatsappUrl] = useState('');
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  if (params.lang && !(params.lang in supportedLanguages)) {
    return <Navigate to={`/${defaultLanguage}`} replace />;
  }

  const brandName = apiContent.brand?.name || 'VAYRO';
  const previewLabels = dashboardPreviewLabels[language];
  const orderCopy = orderLabels[language];
  const timelineIcons = [Check, MessageCircle, ShieldCheck, KeyRound, Zap];
  const productIcons = [KeyRound, MessageCircle, BriefcaseBusiness];
  const plans = useMemo(
    () => mapApiPlans(apiContent.plans, copy.pricing.plans),
    [apiContent.plans, copy.pricing.plans],
  );
  const highlightedPlan =
    plans.find((plan) => plan.highlighted || plan.badge) || plans[1] || plans[0];
  const whatsapp = {
    ...copy.whatsapp,
    ...apiContent.whatsapp,
  };

  useEffect(() => {
    i18n.changeLanguage(language);
    applySeo(language, copy);
  }, [copy, i18n, language]);

  useEffect(() => {
    const preferredTheme =
      localStorage.getItem('vayro-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    setTheme(preferredTheme === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vayro-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/landing/public`)
      .then((response) => response.json())
      .then((data: ApiLandingContent) => setApiContent(data))
      .catch(() => setApiContent({}));
  }, []);

  useEffect(() => {
    if (!location.hash) return;

    const target = document.querySelector(location.hash);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!languageMenuOpen) return;

    const closeMenu = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, [languageMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = selectedPlan || mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedPlan, mobileMenuOpen]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const context = gsap.context(() => {
      const compactScreen = window.matchMedia('(max-width: 760px)').matches;
      const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroTimeline
        .from('.hero-mascot', {
          y: 18,
          opacity: 0,
          duration: 0.5,
          clearProps: 'transform,opacity',
        })
        .from('.hero-copy .eyebrow, .hero-copy h1, .hero-copy > p', {
          y: 16,
          opacity: 0,
          duration: 0.4,
          stagger: 0.06,
          clearProps: 'transform,opacity',
        }, '-=0.28')
        .from('.hero-capability', {
          y: 10,
          opacity: 0,
          duration: 0.3,
          stagger: 0.04,
          clearProps: 'transform,opacity',
        }, '-=0.22')
        .from('.hero-actions, .trust-badges', {
          y: 10,
          opacity: 0,
          duration: 0.3,
          clearProps: 'transform,opacity',
        }, '-=0.18')
        .from('.dashboard-shell', {
          y: 18,
          opacity: 0,
          duration: 0.45,
          clearProps: 'transform,opacity',
        }, '-=0.28');
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((element) => {
        gsap.from(element, {
          y: compactScreen ? 10 : 18,
          opacity: 0,
          duration: compactScreen ? 0.28 : 0.5,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: element,
            start: compactScreen ? 'top 96%' : 'top 86%',
            once: true,
          },
        });
      });
      gsap.utils.toArray<HTMLElement>('.counter').forEach((element) => {
        const raw = element.dataset.value || '0';
        const target = Number(raw.replace(/[^\d.]/g, '')) || 0;
        const prefix = raw.startsWith('+') ? '+' : '';
        const suffix = raw.includes('%') ? '%' : '';
        const state = { value: 0 };

        gsap.to(state, {
          value: target,
          duration: 1.1,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 88%',
            once: true,
          },
          onUpdate() {
            const rounded = raw.includes('.') ? state.value.toFixed(1) : String(Math.round(state.value));
            element.textContent = `${prefix}${rounded}${suffix}`;
          },
        });
      });
    }, rootRef);

    return () => context.revert();
  }, [language]);

  function planPrice(plan: DisplayPlan) {
    return billing === 'monthly' ? plan.monthly : plan.yearly;
  }

  function openOrder(plan: DisplayPlan) {
    setMobileMenuOpen(false);
    setSelectedPlan(plan);
    setOrderForm(emptyOrderForm);
    setOrderMessage('');
    setOrderWhatsappUrl('');
  }

  function closeOrder() {
    if (orderSubmitting) return;
    setSelectedPlan(null);
    setOrderMessage('');
    setOrderWhatsappUrl('');
  }

  function planForService(index: number) {
    const preferredIds = ['otp', 'support', 'hr'];
    const preferredId = preferredIds[index];
    return (
      plans.find((plan) => plan.id === preferredId) ||
      plans.find((plan) => plan.id.includes(preferredId)) ||
      highlightedPlan
    );
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan) return;

    setOrderSubmitting(true);
    setOrderMessage('');
    setOrderWhatsappUrl('');

    try {
      const response = await fetch(`${API_BASE_URL}/landing/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          ...orderForm,
          language,
          metadata: {
            billing,
            displayedPrice: planPrice(selectedPlan),
            currency: selectedPlan.currency,
            pageUrl: window.location.href,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || orderCopy.error);
      }

      setOrderWhatsappUrl(data.whatsappUrl);
      setOrderMessage(orderCopy.success);
      window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      setOrderMessage(error?.message || orderCopy.error);
    } finally {
      setOrderSubmitting(false);
    }
  }

  return (
    <div className="site" ref={rootRef} dir={supportedLanguages[language].dir}>
      <a href="#main" className="skip-link">
        {previewLabels.skip}
      </a>

      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <header className={`navbar${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
        <Link to={`/${language}`} className="brand" aria-label={brandName}>
          {/* Official wordmark alone — the logo carries the brand, no tagline beside it. */}
          <img className="brand-logo" src="/brand/vayro-logo.png" alt={brandName} height={30} />
        </Link>

        <nav aria-label="Primary navigation">
          <a href={`/${language}#services`}>{copy.nav.services}</a>
          <a href={`/${language}#how`}>{copy.nav.how}</a>
          <a href={`/${language}#pricing`}>{copy.nav.pricing}</a>
          <a href={`/${language}#faq`}>{copy.nav.faq}</a>
        </nav>

        <div className="nav-actions">
          {/* One compact control instead of a row of language links — the row wrapped
              badly on phones and pushed the rest of the navbar around. */}
          <div className={`language-menu${languageMenuOpen ? ' open' : ''}`} ref={languageMenuRef}>
            <button
              type="button"
              className="language-trigger"
              aria-haspopup="listbox"
              aria-expanded={languageMenuOpen}
              aria-label="Language"
              onClick={() => setLanguageMenuOpen((open) => !open)}
            >
              <Languages size={17} aria-hidden="true" />
              <span>{supportedLanguages[language].short}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {languageMenuOpen && (
              <ul className="language-list" role="listbox">
                {Object.keys(supportedLanguages).map((lang) => (
                  <li key={lang}>
                    <Link
                      className={language === lang ? 'active' : ''}
                      to={`/${lang}`}
                      lang={lang}
                      role="option"
                      aria-selected={language === lang}
                      onClick={() => setLanguageMenuOpen(false)}
                    >
                      <span>{supportedLanguages[lang as Language].label}</span>
                      <small>{supportedLanguages[lang as Language].short}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Toggle color theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-controls="mobile-navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => {
              setLanguageMenuOpen(false);
              setMobileMenuOpen((open) => !open);
            }}
          >
            {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="nav-cta"
            onClick={() => openOrder(highlightedPlan)}
          >
            {copy.nav.cta}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile navigation">
            <a href={`/${language}#services`} onClick={() => setMobileMenuOpen(false)}>
              <Workflow size={18} aria-hidden="true" />
              <span>{copy.nav.services}</span>
            </a>
            <a href={`/${language}#how`} onClick={() => setMobileMenuOpen(false)}>
              <Zap size={18} aria-hidden="true" />
              <span>{copy.nav.how}</span>
            </a>
            <a href={`/${language}#pricing`} onClick={() => setMobileMenuOpen(false)}>
              <BarChart3 size={18} aria-hidden="true" />
              <span>{copy.nav.pricing}</span>
            </a>
            <a href={`/${language}#faq`} onClick={() => setMobileMenuOpen(false)}>
              <MessageCircle size={18} aria-hidden="true" />
              <span>{copy.nav.faq}</span>
            </a>
            <button type="button" onClick={() => openOrder(highlightedPlan)}>
              <span>{copy.nav.cta}</span>
              <ArrowIcon size={18} aria-hidden="true" />
            </button>
          </nav>
        )}
      </header>

      <main id="main">
        <section className="hero-section" id="home">
          <div className="hero-orbit" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">{copy.hero.eyebrow}</span>
              <h1>{copy.hero.title}</h1>
            <p>{copy.hero.subtitle}</p>
              <div className="hero-capabilities" aria-label={copy.services.title}>
                {copy.services.items.slice(0, 3).map((service, index) => {
                  const ProductIcon = productIcons[index] || Workflow;

                  return (
                    <div className="hero-capability" key={service.title}>
                      <span className="hero-capability-icon">
                        <ProductIcon size={18} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{service.title}</strong>
                        <small>{service.features[0]}</small>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="hero-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => openOrder(highlightedPlan)}
                >
                  {copy.hero.primary}
                  <ArrowIcon size={18} aria-hidden="true" />
                </button>
                <a className="button button-ghost" href={`/${language}#how`}>
                  {copy.hero.secondary}
                </a>
              </div>
              <div className="trust-badges" aria-label="Trust badges">
                {copy.hero.badges.slice(0, 2).map((badge) => (
                  <span key={badge}>
                    <CircleCheck size={15} aria-hidden="true" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <div className="hero-visual" aria-label="VAYRO dashboard preview">
              <div className="dashboard-shell">
                <div className="dashboard-top">
                  <span className="traffic-dot" />
                  <span className="traffic-dot" />
                  <span className="traffic-dot" />
                  <strong>{previewLabels.control}</strong>
                </div>
                <div className="product-tabs">
                  <span className="active"><KeyRound size={14} />{previewLabels.otp}</span>
                  <span><MessageCircle size={14} />{previewLabels.inbox}</span>
                  <span><BriefcaseBusiness size={14} />{previewLabels.hr}</span>
                </div>
                <div className="dashboard-grid">
                  <div className="panel panel-hero-main">
                    <div className="panel-label">{previewLabels.otp}</div>
                    <h3>482913</h3>
                    <p>{copy.dashboard.otp}</p>
                    <div className="delivery-row">
                      <span>{copy.dashboard.sent}</span>
                      <CircleCheck size={16} />
                    </div>
                  </div>
                  <div className="panel panel-qr">
                    <span className="status-pill">
                      <ShieldCheck size={14} />
                      {copy.dashboard.online}
                    </span>
                    <div className="qr-box">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <p>{copy.dashboard.qr}</p>
                  </div>
                  <div className="panel panel-inbox">
                    <div className="panel-title">
                      <Users size={18} />
                      <strong>{copy.dashboard.inbox}</strong>
                    </div>
                    <div className="conversation-list">
                      <span><b>{previewLabels.firstAgent}</b><em>{previewLabels.support}</em></span>
                      <span><b>{previewLabels.secondAgent}</b><em>{previewLabels.sales}</em></span>
                    </div>
                  </div>
                  <div className="panel panel-hr">
                    <div className="panel-title">
                      <BriefcaseBusiness size={18} />
                      <strong>{copy.dashboard.hr}</strong>
                    </div>
                    <div className="pipeline">
                      <span />
                      <span />
                      <span />
                    </div>
                    <p>{copy.dashboard.candidate}</p>
                  </div>
                </div>
              </div>
              <div className="hero-mascot">
                <Mascot
                  className="hero-mascot-character"
                  pose="wave"
                  size={168}
                  ambient={false}
                  interactive={false}
                  priority
                />
                <div className="mascot-presence" aria-hidden="true">
                  <span className="presence-dot" />
                  <span>
                    <strong>{copy.dashboard.online}</strong>
                    <small>{copy.hero.badges[0]}</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="proof-section">
          <div className="container">
            <div className="section-heading centered reveal">
              <span>{copy.proof.title}</span>
              <h2>{copy.proof.subtitle}</h2>
            </div>
            <div className="logo-wall reveal" aria-label="Trusted companies">
              {copy.proof.logos.map((logo) => (
                <span key={logo}>{logo}</span>
              ))}
            </div>
            <div className="proof-metrics">
              {copy.proof.metrics.map((metric) => (
                <div className="metric-card reveal" key={metric.label}>
                  <strong className="counter" data-value={metric.value}>
                    {metric.value}
                  </strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pain-section">
          <div className="container pain-grid">
            <div className="section-heading reveal">
              <span>{copy.pain.eyebrow}</span>
              <h2>{copy.pain.title}</h2>
              <p>{copy.pain.subtitle}</p>
            </div>
            <div className="pain-list">
              {copy.pain.items.map((item, index) => (
                <div className="pain-card reveal" key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="pain-resolution reveal">
              <BadgeCheck size={22} aria-hidden="true" />
              {copy.pain.resolution}
            </div>
          </div>
        </section>

        <section className="section" id="services">
          <div className="container">
            <div className="section-heading reveal">
              <span>{copy.services.eyebrow}</span>
              <h2>{copy.services.title}</h2>
              <p>{copy.services.subtitle}</p>
            </div>
            <div className="services-grid">
              {copy.services.items.map((service, index) => {
                const ServiceIcon = productIcons[index] || Workflow;

                return (
                  <article className="service-card reveal" key={service.title}>
                    <div className="service-visual">
                      <ServiceIcon size={22} aria-hidden="true" />
                    </div>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                    <ul>
                      {service.features.map((feature) => (
                        <li key={feature}>
                          <Check size={16} aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="service-order-link"
                      onClick={() => openOrder(planForService(index))}
                    >
                      {service.cta}
                      <ArrowIcon size={16} aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section how-section" id="how">
          <div className="container">
            <div className="section-heading centered reveal">
              <span>{copy.how.eyebrow}</span>
              <h2>{copy.how.title}</h2>
            </div>
            <div className="timeline">
              {copy.how.steps.map((step, index) => {
                const StepIcon = timelineIcons[index] || Zap;

                return (
                  <article className="timeline-item reveal" key={step}>
                    <div className="timeline-head">
                      <span className="timeline-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="timeline-icon">
                        <StepIcon size={18} aria-hidden="true" />
                      </span>
                    </div>
                    <p>{step}</p>
                    <span className="timeline-progress" aria-hidden="true" />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section results-section">
          <div className="container results-grid">
            <div className="section-heading reveal">
              <span>{copy.results.eyebrow}</span>
              <h2>{copy.results.title}</h2>
            </div>
            {copy.results.items.map((result) => (
              <article className="result-card reveal" key={result.label}>
                <strong className="counter" data-value={result.value}>
                  {result.value}
                </strong>
                <span>{result.label}</span>
                <p>{result.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section testimonials-section">
          <div className="container testimonials-grid">
            {copy.testimonials.map((testimonial) => (
              <article className="testimonial-card reveal" key={testimonial.name}>
                <div className="avatar" aria-hidden="true">
                  {testimonial.name.trim().charAt(0)}
                </div>
                <p>{testimonial.quote}</p>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section pricing-section" id="pricing">
          <div className="container">
            <div className="pricing-head reveal">
              <div className="section-heading">
                <span>{copy.pricing.eyebrow}</span>
                <h2>{copy.pricing.title}</h2>
              </div>
              <div className="billing-toggle" role="group" aria-label="Billing period">
                <button
                  type="button"
                  className={billing === 'monthly' ? 'active' : ''}
                  onClick={() => setBilling('monthly')}
                >
                  {copy.pricing.monthly}
                </button>
                <button
                  type="button"
                  className={billing === 'yearly' ? 'active' : ''}
                  onClick={() => setBilling('yearly')}
                >
                  {copy.pricing.yearly}
                </button>
                <small>{copy.pricing.save}</small>
              </div>
            </div>
            <div className="pricing-grid">
              {plans.map((plan) => (
                <article
                  className={`pricing-card reveal ${plan.highlighted || plan.badge ? 'featured' : ''}`}
                  key={plan.id}
                >
                  {plan.badge ? <div className="plan-badge">{plan.badge}</div> : null}
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className="price">
                    <strong>{plan.currency}{planPrice(plan)}</strong>
                    <span>/ {billing === 'monthly' ? copy.pricing.monthly : copy.pricing.yearly}</span>
                  </div>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={16} aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="button button-plan"
                    onClick={() => openOrder(plan)}
                  >
                    {plan.cta || whatsapp.buttonLabel}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section faq-section" id="faq">
          <div className="container faq-grid">
            <div className="section-heading reveal">
              <span>{copy.faq.eyebrow}</span>
              <h2>{copy.faq.title}</h2>
            </div>
            <div className="faq-list">
              {copy.faq.items.map((item, index) => (
                <div
                  className={`faq-item reveal ${openFaq === index ? 'open' : ''}`}
                  key={item.question}
                >
                  <button
                    type="button"
                    className="faq-trigger"
                    aria-expanded={openFaq === index}
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                  >
                    <span>{item.question}</span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="final-section" id="contact">
          <div className="final-glow" aria-hidden="true" />
          <div className="container final-inner reveal">
            <span className="eyebrow">
              <Clock3 size={16} aria-hidden="true" />
              {copy.nav.contact}
            </span>
            <h2>{copy.finalCta.title}</h2>
            <p>{copy.finalCta.subtitle}</p>
            <div className="hero-actions centered-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => openOrder(highlightedPlan)}
              >
                {copy.finalCta.primary}
                <Send size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="button button-dark-ghost"
                onClick={() => openOrder(highlightedPlan)}
              >
                {copy.finalCta.secondary}
                <PhoneCall size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {selectedPlan ? (
        <div className="order-modal-backdrop" role="presentation" onClick={closeOrder}>
          <section
            className="order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="order-modal-head">
              <div>
                <span className="order-eyebrow">{orderCopy.selectedPlan}</span>
                <h2 id="order-modal-title">{orderCopy.title}</h2>
                <p>{orderCopy.subtitle}</p>
              </div>
              <button type="button" className="order-close" onClick={closeOrder} aria-label={orderCopy.close}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="order-plan-summary">
              <div>
                <small>{orderCopy.selectedPlan}</small>
                <strong>{selectedPlan.name}</strong>
              </div>
              <span>
                {selectedPlan.currency}
                {planPrice(selectedPlan)} / {billing === 'monthly' ? copy.pricing.monthly : copy.pricing.yearly}
              </span>
            </div>

            <form className="order-form" onSubmit={submitOrder}>
              <label className="order-field">
                <span>{orderCopy.customerName}</span>
                <input
                  required
                  value={orderForm.customerName}
                  onChange={(event) =>
                    setOrderForm({ ...orderForm, customerName: event.target.value })
                  }
                  placeholder={orderCopy.customerName}
                />
              </label>
              <label className="order-field">
                <span>{orderCopy.companyName}</span>
                <input
                  required
                  value={orderForm.companyName}
                  onChange={(event) =>
                    setOrderForm({ ...orderForm, companyName: event.target.value })
                  }
                  placeholder={orderCopy.companyName}
                />
              </label>
              <label className="order-field">
                <span>{orderCopy.phoneNumber}</span>
                <input
                  required
                  value={orderForm.phoneNumber}
                  onChange={(event) =>
                    setOrderForm({ ...orderForm, phoneNumber: event.target.value })
                  }
                  placeholder="+963..."
                  inputMode="tel"
                  dir="ltr"
                />
              </label>
              <label className="order-field">
                <span>{orderCopy.email}</span>
                <input
                  required
                  type="email"
                  value={orderForm.email}
                  onChange={(event) => setOrderForm({ ...orderForm, email: event.target.value })}
                  placeholder="name@example.com"
                  dir="ltr"
                />
              </label>
              <label className="order-field">
                <span>{orderCopy.website}</span>
                <input
                  value={orderForm.website}
                  onChange={(event) => setOrderForm({ ...orderForm, website: event.target.value })}
                  placeholder="https://example.com"
                  dir="ltr"
                />
              </label>
              <label className="order-field">
                <span>{orderCopy.useCase}</span>
                <input
                  value={orderForm.useCase}
                  onChange={(event) => setOrderForm({ ...orderForm, useCase: event.target.value })}
                  placeholder={orderCopy.useCase}
                />
              </label>
              <label className="order-field order-field-wide">
                <span>{orderCopy.notes}</span>
                <textarea
                  value={orderForm.notes}
                  onChange={(event) => setOrderForm({ ...orderForm, notes: event.target.value })}
                  placeholder={orderCopy.notes}
                  rows={4}
                />
              </label>

              {orderMessage ? (
                <div className={orderWhatsappUrl ? 'order-message success' : 'order-message error'}>
                  {orderMessage}
                  {orderWhatsappUrl ? (
                    <a href={orderWhatsappUrl} target="_blank" rel="noreferrer">
                      {orderCopy.whatsappFallback}
                    </a>
                  ) : null}
                </div>
              ) : null}

              <button type="submit" className="button button-primary order-submit" disabled={orderSubmitting}>
                {orderSubmitting ? orderCopy.submitting : orderCopy.submit}
                <MessageCircle size={18} aria-hidden="true" />
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <Link to={`/${language}`} className="brand footer-brand">
              {/* Wordmark only — the "WhatsApp SaaS" line no longer sits beside the logo. */}
              <img className="brand-logo" src="/brand/vayro-logo.png" alt={brandName} height={28} />
            </Link>
            <p>{copy.footer.description}</p>
          </div>
          <div>
            <h3>{copy.footer.linksTitle}</h3>
            <a href={`/${language}#services`}>{copy.nav.services}</a>
            <a href={`/${language}#pricing`}>{copy.nav.pricing}</a>
            <a href={`/${language}#faq`}>{copy.nav.faq}</a>
          </div>
          <div>
            <h3>{copy.footer.contactTitle}</h3>
            <button type="button" className="footer-order-button" onClick={() => openOrder(highlightedPlan)}>
              WhatsApp
            </button>
            <a href="mailto:sales@vayro.com">sales@vayro.com</a>
            <div className="footer-language">
              <Globe2 size={16} aria-hidden="true" />
              {Object.keys(supportedLanguages).map((lang) => (
                <Link key={lang} to={`/${lang}`}>
                  {supportedLanguages[lang as Language].short}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} VAYRO. {copy.footer.rights}</span>
          <span>{copy.footer.terms} · {copy.footer.privacy}</span>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${defaultLanguage}`} replace />} />
        <Route path="/:lang" element={<LandingRoute />} />
        <Route path="*" element={<Navigate to={`/${defaultLanguage}`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
