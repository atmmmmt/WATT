import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  Copy,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Play,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
  Zap,
} from 'lucide-react';
import {
  defaultLanguage,
  Language,
  normalizeLanguage,
  supportedLanguages,
} from './landing-content';
import './live-demo.css';

type DemoProduct = 'otp' | 'support' | 'relay' | 'hr';
type OtpStatus = 'idle' | 'sending' | 'sent' | 'delivered';

const copy: Record<Language, {
  eyebrow: string;
  title: string;
  subtitle: string;
  back: string;
  share: string;
  shared: string;
  start: string;
  safe: string;
  noLogin: string;
  live: string;
  modules: Record<DemoProduct, { label: string; short: string }>;
  otp: {
    title: string;
    text: string;
    send: string;
    sending: string;
    idle: string;
    sent: string;
    delivered: string;
    phoneTitle: string;
    phoneText: string;
  };
  support: {
    title: string;
    text: string;
    action: string;
    assigned: string;
    conversation: string;
    customer: string;
    customerMessage: string;
    reply: string;
    agents: string;
    sales: string;
    support: string;
  };
  relay: {
    title: string;
    text: string;
    placeholder: string;
    send: string;
    doctor: string;
    client: string;
    hidden: string;
    routed: string;
  };
  hr: {
    title: string;
    text: string;
    next: string;
    candidate: string;
    stages: string[];
  };
  ctaTitle: string;
  ctaText: string;
  cta: string;
}> = {
  ar: {
    eyebrow: 'VAYRO LIVE EXPERIENCE',
    title: 'لا تقرأ عن VAYRO. جرّبه.',
    subtitle: 'ديمو تفاعلي يريك كيف تعمل أهم خدمات المنصة خلال أقل من دقيقة.',
    back: 'العودة للموقع',
    share: 'شارك الديمو',
    shared: 'تم نسخ الرابط',
    start: 'تجربة مباشرة',
    safe: 'بيانات تجريبية فقط',
    noLogin: 'بدون تسجيل',
    live: 'LIVE',
    modules: {
      otp: { label: 'OTP', short: 'رمز تحقق حي' },
      support: { label: 'Support', short: 'صندوق الفريق' },
      relay: { label: 'Privacy', short: 'توجيه بخصوصية' },
      hr: { label: 'HR', short: 'مسار التوظيف' },
    },
    otp: {
      title: 'أرسل OTP وشاهد الرحلة',
      text: 'ولّد رمزاً جديداً وشاهد حالة التسليم داخل واتساب كما يراها عميلك.',
      send: 'إرسال OTP الآن',
      sending: 'جارٍ الإرسال...',
      idle: 'جاهز',
      sent: 'تم الإرسال',
      delivered: 'تم التسليم',
      phoneTitle: 'VAYRO Verify',
      phoneText: 'رمز التحقق الخاص بك هو',
    },
    support: {
      title: 'محادثة واحدة، فريق كامل',
      text: 'جرّب تحويل المحادثة بين الموظفين بدون تغيير رقم واتساب الشركة.',
      action: 'حوّل للموظف التالي',
      assigned: 'المسؤول الآن',
      conversation: 'محادثة نشطة',
      customer: 'عميل جديد',
      customerMessage: 'مرحباً، بدي أعرف تفاصيل الباقة المناسبة لمتجري.',
      reply: 'أهلاً فيك 👋 رح ساعدك تختار الباقة الأنسب.',
      agents: 'فريقك',
      sales: 'مبيعات',
      support: 'دعم',
    },
    relay: {
      title: 'الخصوصية كميزة، مو كتعقيد',
      text: 'الطبيب والعميل يتواصلان عبر VAYRO بدون ما يظهر رقم أي طرف للآخر.',
      placeholder: 'اكتب رسالة تجريبية...',
      send: 'إرسال عبر VAYRO',
      doctor: 'الطبيب',
      client: 'العميل',
      hidden: 'الرقم مخفي',
      routed: 'تم التوجيه بأمان',
    },
    hr: {
      title: 'من أول رسالة إلى التوظيف',
      text: 'انقل المرشح بين المراحل وشاهد كيف يبقى كل شيء واضحاً للفريق.',
      next: 'نقل للمرحلة التالية',
      candidate: 'ليان أحمد · Front-End Developer',
      stages: ['جديد', 'فرز أولي', 'مقابلة', 'عرض', 'تم التوظيف'],
    },
    ctaTitle: 'تخيل هالتجربة على رقم شركتك.',
    ctaText: 'VAYRO يجمع التحقق، الدعم، التوظيف والخصوصية ضمن منصة واحدة.',
    cta: 'ابدأ مع VAYRO',
  },
  en: {
    eyebrow: 'VAYRO LIVE EXPERIENCE',
    title: 'Do not read about VAYRO. Try it.',
    subtitle: 'An interactive demo of the core VAYRO flows in under a minute.',
    back: 'Back to website', share: 'Share demo', shared: 'Link copied', start: 'Interactive demo', safe: 'Demo data only', noLogin: 'No login', live: 'LIVE',
    modules: { otp: { label: 'OTP', short: 'Live verification' }, support: { label: 'Support', short: 'Team inbox' }, relay: { label: 'Privacy', short: 'Private relay' }, hr: { label: 'HR', short: 'Hiring pipeline' } },
    otp: { title: 'Send an OTP and watch the journey', text: 'Generate a fresh code and watch delivery status inside WhatsApp.', send: 'Send OTP now', sending: 'Sending...', idle: 'Ready', sent: 'Sent', delivered: 'Delivered', phoneTitle: 'VAYRO Verify', phoneText: 'Your verification code is' },
    support: { title: 'One conversation. A full team.', text: 'Route a customer conversation between agents without changing your business number.', action: 'Assign next agent', assigned: 'Assigned to', conversation: 'Active conversation', customer: 'New customer', customerMessage: 'Hi, I need help choosing the right plan for my store.', reply: 'Welcome 👋 I will help you choose the right plan.', agents: 'Your team', sales: 'Sales', support: 'Support' },
    relay: { title: 'Privacy without friction', text: 'Doctor and client communicate through VAYRO while both phone numbers stay hidden.', placeholder: 'Type a demo message...', send: 'Send via VAYRO', doctor: 'Doctor', client: 'Client', hidden: 'number hidden', routed: 'Securely routed' },
    hr: { title: 'From first message to hired', text: 'Move a candidate through the pipeline while the whole team stays aligned.', next: 'Move to next stage', candidate: 'Layan Ahmad · Front-End Developer', stages: ['New', 'Screening', 'Interview', 'Offer', 'Hired'] },
    ctaTitle: 'Now imagine this on your business number.', ctaText: 'VAYRO brings verification, support, hiring and privacy into one workspace.', cta: 'Start with VAYRO',
  },
  tr: {
    eyebrow: 'VAYRO LIVE EXPERIENCE', title: 'VAYRO’yu okumayın. Deneyin.', subtitle: 'VAYRO’nun ana akışlarını bir dakikadan kısa sürede deneyin.', back: 'Siteye dön', share: 'Demoyu paylaş', shared: 'Bağlantı kopyalandı', start: 'Canlı deneyim', safe: 'Yalnızca demo verisi', noLogin: 'Giriş gerekmez', live: 'LIVE',
    modules: { otp: { label: 'OTP', short: 'Canlı doğrulama' }, support: { label: 'Support', short: 'Ekip gelen kutusu' }, relay: { label: 'Privacy', short: 'Gizli yönlendirme' }, hr: { label: 'HR', short: 'İşe alım akışı' } },
    otp: { title: 'OTP gönderin ve akışı izleyin', text: 'Yeni bir kod üretin ve WhatsApp teslim durumunu görün.', send: 'OTP gönder', sending: 'Gönderiliyor...', idle: 'Hazır', sent: 'Gönderildi', delivered: 'Teslim edildi', phoneTitle: 'VAYRO Verify', phoneText: 'Doğrulama kodunuz' },
    support: { title: 'Tek konuşma, bütün ekip', text: 'Müşteri konuşmasını şirket numarasını değiştirmeden ekip üyelerine aktarın.', action: 'Sonraki temsilci', assigned: 'Atanan', conversation: 'Aktif konuşma', customer: 'Yeni müşteri', customerMessage: 'Merhaba, mağazam için doğru paketi seçmek istiyorum.', reply: 'Merhaba 👋 Size en uygun paketi seçelim.', agents: 'Ekibiniz', sales: 'Satış', support: 'Destek' },
    relay: { title: 'Karmaşa olmadan gizlilik', text: 'Doktor ve müşteri VAYRO üzerinden konuşur, numaralar gizli kalır.', placeholder: 'Demo mesajı yazın...', send: 'VAYRO ile gönder', doctor: 'Doktor', client: 'Müşteri', hidden: 'numara gizli', routed: 'Güvenle yönlendirildi' },
    hr: { title: 'İlk mesajdan işe alıma', text: 'Adayı aşamalar arasında taşıyın ve tüm ekibi aynı yerde tutun.', next: 'Sonraki aşama', candidate: 'Layan Ahmad · Front-End Developer', stages: ['Yeni', 'Eleme', 'Mülakat', 'Teklif', 'İşe alındı'] },
    ctaTitle: 'Bunu kendi işletme numaranızda düşünün.', ctaText: 'VAYRO doğrulama, destek, işe alım ve gizliliği tek platformda toplar.', cta: 'VAYRO ile başlayın',
  },
  fr: {
    eyebrow: 'VAYRO LIVE EXPERIENCE', title: 'Ne lisez pas VAYRO. Essayez-le.', subtitle: 'Une démo interactive des principaux flux VAYRO en moins d’une minute.', back: 'Retour au site', share: 'Partager la démo', shared: 'Lien copié', start: 'Démo interactive', safe: 'Données de démo', noLogin: 'Sans connexion', live: 'LIVE',
    modules: { otp: { label: 'OTP', short: 'Vérification live' }, support: { label: 'Support', short: 'Inbox équipe' }, relay: { label: 'Privacy', short: 'Relais privé' }, hr: { label: 'HR', short: 'Pipeline RH' } },
    otp: { title: 'Envoyez un OTP et suivez le parcours', text: 'Générez un nouveau code et voyez son statut de livraison WhatsApp.', send: 'Envoyer OTP', sending: 'Envoi...', idle: 'Prêt', sent: 'Envoyé', delivered: 'Livré', phoneTitle: 'VAYRO Verify', phoneText: 'Votre code de vérification est' },
    support: { title: 'Une conversation, toute une équipe', text: 'Affectez une conversation client sans changer le numéro WhatsApp de l’entreprise.', action: 'Agent suivant', assigned: 'Assigné à', conversation: 'Conversation active', customer: 'Nouveau client', customerMessage: 'Bonjour, je cherche le bon forfait pour ma boutique.', reply: 'Bienvenue 👋 Je vais vous aider à choisir.', agents: 'Votre équipe', sales: 'Ventes', support: 'Support' },
    relay: { title: 'La confidentialité sans friction', text: 'Le médecin et le client communiquent via VAYRO sans révéler leurs numéros.', placeholder: 'Écrivez un message...', send: 'Envoyer via VAYRO', doctor: 'Médecin', client: 'Client', hidden: 'numéro masqué', routed: 'Acheminé en sécurité' },
    hr: { title: 'Du premier message à l’embauche', text: 'Faites progresser un candidat tout en gardant l’équipe alignée.', next: 'Étape suivante', candidate: 'Layan Ahmad · Front-End Developer', stages: ['Nouveau', 'Tri', 'Entretien', 'Offre', 'Embauché'] },
    ctaTitle: 'Imaginez maintenant cela sur votre numéro pro.', ctaText: 'VAYRO réunit vérification, support, recrutement et confidentialité.', cta: 'Commencer avec VAYRO',
  },
};

const products: Array<{ id: DemoProduct; icon: typeof KeyRound }> = [
  { id: 'otp', icon: KeyRound },
  { id: 'support', icon: MessageCircle },
  { id: 'relay', icon: LockKeyhole },
  { id: 'hr', icon: BriefcaseBusiness },
];

export function LiveDemo() {
  const params = useParams();
  const language = normalizeLanguage(params.lang);
  if (params.lang && !(params.lang in supportedLanguages)) {
    return <Navigate to={`/${defaultLanguage}/demo`} replace />;
  }

  const t = copy[language];
  const isRtl = supportedLanguages[language].dir === 'rtl';
  const DirectionIcon = isRtl ? ArrowRight : ArrowLeft;
  const [active, setActive] = useState<DemoProduct>('otp');
  const [otp, setOtp] = useState('482913');
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
  const [supportAgent, setSupportAgent] = useState(0);
  const [relayInput, setRelayInput] = useState('');
  const [relayMessage, setRelayMessage] = useState(isRtl ? 'موعدي مناسب الساعة 5 مساءً.' : '5 PM works for my appointment.');
  const [hrStage, setHrStage] = useState(1);
  const [shared, setShared] = useState(false);

  const agents = useMemo(() => [
    { name: language === 'ar' ? 'سارة' : 'Sarah', team: t.support.support, initials: 'S' },
    { name: language === 'ar' ? 'محمد' : 'Mohammad', team: t.support.sales, initials: 'M' },
    { name: language === 'ar' ? 'نور' : 'Nour', team: t.support.support, initials: 'N' },
  ], [language, t.support.sales, t.support.support]);

  function sendOtp() {
    if (otpStatus === 'sending') return;
    setOtp(String(Math.floor(100000 + Math.random() * 900000)));
    setOtpStatus('sending');
    window.setTimeout(() => setOtpStatus('sent'), 650);
    window.setTimeout(() => setOtpStatus('delivered'), 1350);
  }

  function sendRelay() {
    const value = relayInput.trim();
    if (!value) return;
    setRelayMessage(value);
    setRelayInput('');
  }

  async function shareDemo() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'VAYRO LIVE EXPERIENCE', url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      // User cancelled the native share sheet.
    }
  }

  const otpStatusLabel = otpStatus === 'delivered'
    ? t.otp.delivered
    : otpStatus === 'sent'
      ? t.otp.sent
      : otpStatus === 'sending'
        ? t.otp.sending
        : t.otp.idle;

  return (
    <div className="demo-page" dir={supportedLanguages[language].dir}>
      <div className="demo-ambient" aria-hidden="true">
        <span className="demo-orb demo-orb-a" />
        <span className="demo-orb demo-orb-b" />
        <span className="demo-orb demo-orb-c" />
        <span className="demo-grid" />
      </div>

      <header className="demo-nav">
        <Link to={`/${language}`} className="demo-brand" aria-label="VAYRO">
          <img src="/brand/vayro-logo-white.png" alt="VAYRO" />
        </Link>
        <div className="demo-nav-actions">
          <Link to={`/${language}`} className="demo-nav-link">
            <DirectionIcon size={17} />
            <span>{t.back}</span>
          </Link>
          <button type="button" className="demo-share" onClick={shareDemo}>
            {shared ? <Check size={17} /> : <Share2 size={17} />}
            <span>{shared ? t.shared : t.share}</span>
          </button>
        </div>
      </header>

      <main className="demo-main">
        <section className="demo-intro">
          <div className="demo-eyebrow"><Sparkles size={15} />{t.eyebrow}<span>{t.live}</span></div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <div className="demo-trust-row">
            <span><Play size={14} />{t.start}</span>
            <span><ShieldCheck size={14} />{t.safe}</span>
            <span><Zap size={14} />{t.noLogin}</span>
          </div>
        </section>

        <section className="demo-workspace" aria-label="VAYRO interactive demo">
          <div className="demo-product-tabs" role="tablist">
            {products.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active === id}
                className={active === id ? 'active' : ''}
                onClick={() => setActive(id)}
              >
                <span className="demo-tab-icon"><Icon size={19} /></span>
                <span><strong>{t.modules[id].label}</strong><small>{t.modules[id].short}</small></span>
                {active === id ? <span className="demo-tab-live">LIVE</span> : null}
              </button>
            ))}
          </div>

          <div className="demo-stage">
            {active === 'otp' && (
              <div className="demo-scene demo-scene-otp">
                <div className="demo-scene-copy">
                  <span className="demo-kicker"><KeyRound size={16} />OTP API</span>
                  <h2>{t.otp.title}</h2>
                  <p>{t.otp.text}</p>
                  <button type="button" className="demo-primary-action" onClick={sendOtp} disabled={otpStatus === 'sending'}>
                    {otpStatus === 'sending' ? <RefreshCw className="demo-spin" size={18} /> : <Send size={18} />}
                    {otpStatus === 'sending' ? t.otp.sending : t.otp.send}
                  </button>
                  <div className="demo-delivery-track">
                    {(['idle', 'sent', 'delivered'] as const).map((step, index) => {
                      const reached = otpStatus === 'delivered' || (otpStatus === 'sent' && index < 2) || (otpStatus === 'sending' && index === 0) || (otpStatus === 'idle' && index === 0);
                      return <span className={reached ? 'done' : ''} key={step}><i />{step === 'idle' ? t.otp.idle : step === 'sent' ? t.otp.sent : t.otp.delivered}</span>;
                    })}
                  </div>
                </div>
                <div className="demo-phone-wrap">
                  <div className="demo-phone-glow" />
                  <div className="demo-phone">
                    <div className="demo-phone-status"><span>9:41</span><span>•••</span></div>
                    <div className="demo-wa-head"><span className="demo-wa-avatar">V</span><div><strong>{t.otp.phoneTitle}</strong><small>{otpStatusLabel}</small></div><CheckCheck size={17} /></div>
                    <div className="demo-wa-chat">
                      <div className="demo-wa-date">TODAY</div>
                      <div className="demo-wa-message">
                        <p>{t.otp.phoneText}</p>
                        <strong>{otp}</strong>
                        <small>19:00 <CheckCheck size={14} /></small>
                      </div>
                    </div>
                  </div>
                  <div className={`demo-status-float ${otpStatus === 'delivered' ? 'success' : ''}`}>
                    {otpStatus === 'delivered' ? <CheckCheck size={18} /> : <Zap size={18} />}
                    <div><strong>{otpStatusLabel}</strong><small>WhatsApp · VAYRO</small></div>
                  </div>
                </div>
              </div>
            )}

            {active === 'support' && (
              <div className="demo-scene demo-support-scene">
                <div className="demo-inbox-shell">
                  <aside className="demo-inbox-list">
                    <div className="demo-inbox-title"><MessagesIcon /><div><strong>{t.support.conversation}</strong><small>3 online</small></div></div>
                    <div className="demo-contact active"><span className="demo-contact-avatar">R</span><div><strong>{t.support.customer}</strong><small>{t.support.customerMessage}</small></div><b>1</b></div>
                    <div className="demo-contact"><span className="demo-contact-avatar muted">A</span><div><strong>Ahmad Store</strong><small>Thanks!</small></div></div>
                    <div className="demo-contact"><span className="demo-contact-avatar muted">L</span><div><strong>Luma Clinic</strong><small>تم الاستلام</small></div></div>
                  </aside>
                  <div className="demo-chat-panel">
                    <div className="demo-chat-head"><div><strong>{t.support.customer}</strong><small>+963 ••• •• 381</small></div><span><UserRoundCheck size={16} />{agents[supportAgent].name}</span></div>
                    <div className="demo-chat-body">
                      <div className="demo-chat-bubble incoming">{t.support.customerMessage}<small>18:57</small></div>
                      <div className="demo-chat-bubble outgoing">{t.support.reply}<small>18:58 <CheckCheck size={13} /></small></div>
                    </div>
                    <div className="demo-composer"><span>{language === 'ar' ? 'اكتب ردك...' : 'Type a reply...'}</span><Send size={17} /></div>
                  </div>
                  <aside className="demo-agent-panel">
                    <span className="demo-kicker"><Users size={15} />{t.support.agents}</span>
                    <div className="demo-assigned-card"><small>{t.support.assigned}</small><span className="demo-agent-avatar">{agents[supportAgent].initials}</span><strong>{agents[supportAgent].name}</strong><em>{agents[supportAgent].team}</em></div>
                    <button type="button" onClick={() => setSupportAgent((supportAgent + 1) % agents.length)}><RefreshCw size={16} />{t.support.action}</button>
                    <div className="demo-team-stack">{agents.map((agent, index) => <span className={index === supportAgent ? 'active' : ''} key={agent.name}>{agent.initials}</span>)}</div>
                  </aside>
                </div>
              </div>
            )}

            {active === 'relay' && (
              <div className="demo-scene demo-relay-scene">
                <div className="demo-relay-copy">
                  <span className="demo-kicker"><LockKeyhole size={16} />PRIVATE RELAY</span>
                  <h2>{t.relay.title}</h2>
                  <p>{t.relay.text}</p>
                  <div className="demo-relay-form">
                    <input value={relayInput} onChange={(event) => setRelayInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendRelay()} placeholder={t.relay.placeholder} />
                    <button type="button" onClick={sendRelay}><Send size={17} />{t.relay.send}</button>
                  </div>
                </div>
                <div className="demo-relay-map">
                  <div className="demo-person-card doctor"><span><UserRoundCheck size={22} /></span><strong>{t.relay.doctor}</strong><small>+963 ••• •• 214 · {t.relay.hidden}</small><div className="demo-mini-message">{relayMessage}</div></div>
                  <div className="demo-vayro-node"><img src="/brand/vayro-logo-white.png" alt="VAYRO" /><span><ShieldCheck size={15} />{t.relay.routed}</span></div>
                  <div className="demo-person-card client"><span><Users size={22} /></span><strong>{t.relay.client}</strong><small>+963 ••• •• 862 · {t.relay.hidden}</small><div className="demo-mini-message">{relayMessage}</div></div>
                  <div className="demo-relay-line line-one" /><div className="demo-relay-line line-two" />
                </div>
              </div>
            )}

            {active === 'hr' && (
              <div className="demo-scene demo-hr-scene">
                <div className="demo-hr-copy">
                  <span className="demo-kicker"><BriefcaseBusiness size={16} />HR WORKFLOW</span>
                  <h2>{t.hr.title}</h2>
                  <p>{t.hr.text}</p>
                  <button type="button" className="demo-primary-action" onClick={() => setHrStage((hrStage + 1) % t.hr.stages.length)}><ArrowRight size={18} />{t.hr.next}</button>
                </div>
                <div className="demo-pipeline-board">
                  <div className="demo-candidate-head"><span className="demo-candidate-avatar">LA</span><div><strong>{t.hr.candidate}</strong><small>WhatsApp · CV received</small></div><span className="demo-score">92%</span></div>
                  <div className="demo-pipeline-track">
                    {t.hr.stages.map((stage, index) => <div className={`${index <= hrStage ? 'done' : ''} ${index === hrStage ? 'current' : ''}`} key={stage}><span>{index < hrStage ? <Check size={14} /> : index + 1}</span><strong>{stage}</strong></div>)}
                  </div>
                  <div className="demo-activity-card"><span><MessageCircle size={17} /></span><div><strong>{language === 'ar' ? 'آخر نشاط' : 'Latest activity'}</strong><small>{language === 'ar' ? 'تم تحديث مرحلة المرشح الآن' : 'Candidate stage updated just now'}</small></div><i /></div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="demo-final-cta">
          <div><span><Sparkles size={16} />VAYRO</span><h2>{t.ctaTitle}</h2><p>{t.ctaText}</p></div>
          <Link className="demo-final-button" to={`/${language}#pricing`}>{t.cta}<ArrowRight size={18} /></Link>
        </section>
      </main>
    </div>
  );
}

function MessagesIcon() {
  return <MessageCircle size={20} />;
}
