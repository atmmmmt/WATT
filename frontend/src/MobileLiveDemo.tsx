import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { defaultLanguage, Language, normalizeLanguage, supportedLanguages } from './landing-content';
import './live-demo-mobile-real.css';

type Flow = 'otp' | 'support' | 'privacy' | 'hr';
type OtpState = 'ready' | 'sending' | 'sent' | 'delivered';

const text: Record<Language, any> = {
  ar: {
    back: 'العودة للموقع', share: 'مشاركة', title: 'جرّب VAYRO بإيدك', subtitle: 'اختَر خدمة ونفّذ خطوة حقيقية داخل محاكاة آمنة. ما بينبعت أي شيء فعلياً.', safe: 'محاكاة آمنة · بدون تسجيل',
    services: { otp: ['OTP', 'جرّب إرسال رمز تحقق'], support: ['الدعم', 'حوّل محادثة بين الموظفين'], privacy: ['الخصوصية', 'أرسل بدون كشف الأرقام'], hr: ['التوظيف', 'حرّك المرشح بين المراحل'] },
    otp: { title: 'أرسل رمز تحقق تجريبي', one: '1. اكتب رقم تجريبي', two: '2. اضغط إرسال', three: '3. شاهد الرسالة على الآيفون', phone: 'رقم العميل التجريبي', send: 'إرسال OTP تجريبي', ready: 'جاهز للتجربة', sending: 'جارٍ الإرسال...', sent: 'تم الإرسال', delivered: 'تم التسليم', msg: 'رمز التحقق الخاص بك هو', note: 'لن يتم إرسال رسالة حقيقية.' },
    support: { title: 'جرّب صندوق الفريق', hint: 'اضغط موظفاً آخر وشاهد المحادثة تنتقل إليه فوراً.', customer: 'عميل جديد', incoming: 'مرحبا، بدي أعرف أي باقة مناسبة لمتجري؟', outgoing: 'أهلاً فيك 👋 رح ساعدك تختار الأنسب.', assigned: 'المسؤول الآن', agents: ['سارة', 'محمد', 'نور'] },
    privacy: { title: 'جرّب التوجيه بخصوصية', hint: 'اكتب رسالة وشاهدها تمر عبر VAYRO بدون إظهار رقم الطرفين.', placeholder: 'اكتب رسالة تجريبية...', send: 'إرسال عبر VAYRO', doctor: 'الطبيب', client: 'العميل', hidden: 'الرقم مخفي', routed: 'تم التوجيه بأمان' },
    hr: { title: 'جرّب مسار التوظيف', hint: 'انقل المرشح خطوة خطوة مثل ما يعمل فريق HR داخل VAYRO.', candidate: 'ليان أحمد · Front-End Developer', next: 'نقل للمرحلة التالية', stages: ['جديد', 'فرز', 'مقابلة', 'عرض', 'تم التوظيف'] },
    cta: 'جاهز تستخدمها على رقم شركتك؟', start: 'ابدأ مع VAYRO'
  },
  en: {
    back: 'Back to site', share: 'Share', title: 'Try VAYRO yourself', subtitle: 'Choose a service and perform a real interaction in a safe simulation. Nothing is actually sent.', safe: 'Safe simulation · no login',
    services: { otp: ['OTP', 'Send a verification code'], support: ['Support', 'Route a live conversation'], privacy: ['Privacy', 'Message without exposing numbers'], hr: ['Hiring', 'Move a candidate through stages'] },
    otp: { title: 'Send a demo verification code', one: '1. Enter a demo number', two: '2. Tap send', three: '3. Watch it arrive on iPhone', phone: 'Demo customer number', send: 'Send demo OTP', ready: 'Ready', sending: 'Sending...', sent: 'Sent', delivered: 'Delivered', msg: 'Your verification code is', note: 'No real message will be sent.' },
    support: { title: 'Try the team inbox', hint: 'Tap another agent and watch the conversation move instantly.', customer: 'New customer', incoming: 'Hi, which plan fits my store?', outgoing: 'Welcome 👋 I’ll help you choose.', assigned: 'Assigned now', agents: ['Sarah', 'Mohammad', 'Nour'] },
    privacy: { title: 'Try private relay', hint: 'Type a message and watch it pass through VAYRO while both numbers stay hidden.', placeholder: 'Type a demo message...', send: 'Send via VAYRO', doctor: 'Doctor', client: 'Client', hidden: 'number hidden', routed: 'Securely routed' },
    hr: { title: 'Try the hiring pipeline', hint: 'Move the candidate step by step like an HR team inside VAYRO.', candidate: 'Layan Ahmad · Front-End Developer', next: 'Move to next stage', stages: ['New', 'Screening', 'Interview', 'Offer', 'Hired'] },
    cta: 'Ready to run this on your business number?', start: 'Start with VAYRO'
  },
  tr: {
    back: 'Siteye dön', share: 'Paylaş', title: 'VAYRO’yu kendiniz deneyin', subtitle: 'Bir hizmet seçin ve güvenli simülasyonda gerçek bir etkileşim yapın.', safe: 'Güvenli simülasyon · giriş yok',
    services: { otp: ['OTP', 'Doğrulama kodu gönder'], support: ['Destek', 'Konuşmayı temsilciye aktar'], privacy: ['Gizlilik', 'Numaraları göstermeden mesaj'], hr: ['İK', 'Adayı aşamalarda ilerlet'] },
    otp: { title: 'Demo doğrulama kodu gönder', one: '1. Demo numara girin', two: '2. Gönder’e basın', three: '3. iPhone’da görün', phone: 'Demo müşteri numarası', send: 'Demo OTP gönder', ready: 'Hazır', sending: 'Gönderiliyor...', sent: 'Gönderildi', delivered: 'Teslim edildi', msg: 'Doğrulama kodunuz', note: 'Gerçek mesaj gönderilmez.' },
    support: { title: 'Ekip gelen kutusunu deneyin', hint: 'Başka bir temsilciye dokunun ve konuşmanın taşınmasını görün.', customer: 'Yeni müşteri', incoming: 'Merhaba, mağazam için hangi paket uygun?', outgoing: 'Hoş geldiniz 👋 Yardım edeyim.', assigned: 'Şu anda atanan', agents: ['Sarah', 'Mohammad', 'Nour'] },
    privacy: { title: 'Gizli yönlendirmeyi deneyin', hint: 'Mesaj yazın, numaralar görünmeden VAYRO üzerinden geçsin.', placeholder: 'Demo mesaj yazın...', send: 'VAYRO ile gönder', doctor: 'Doktor', client: 'Müşteri', hidden: 'numara gizli', routed: 'Güvenle yönlendirildi' },
    hr: { title: 'İşe alım akışını deneyin', hint: 'Adayı aşama aşama ilerletin.', candidate: 'Layan Ahmad · Front-End Developer', next: 'Sonraki aşama', stages: ['Yeni', 'Eleme', 'Mülakat', 'Teklif', 'İşe alındı'] },
    cta: 'Bunu şirket numaranızda kullanmaya hazır mısınız?', start: 'VAYRO ile başlayın'
  },
  fr: {
    back: 'Retour au site', share: 'Partager', title: 'Essayez VAYRO vous-même', subtitle: 'Choisissez un service et effectuez une vraie interaction dans une simulation sûre.', safe: 'Simulation sûre · sans connexion',
    services: { otp: ['OTP', 'Envoyer un code'], support: ['Support', 'Transférer une conversation'], privacy: ['Confidentialité', 'Masquer les numéros'], hr: ['RH', 'Faire avancer un candidat'] },
    otp: { title: 'Envoyez un code de démonstration', one: '1. Entrez un numéro test', two: '2. Appuyez sur envoyer', three: '3. Regardez sur l’iPhone', phone: 'Numéro client test', send: 'Envoyer OTP demo', ready: 'Prêt', sending: 'Envoi...', sent: 'Envoyé', delivered: 'Livré', msg: 'Votre code de vérification est', note: 'Aucun vrai message ne sera envoyé.' },
    support: { title: 'Essayez l’inbox équipe', hint: 'Touchez un autre agent et regardez la conversation être transférée.', customer: 'Nouveau client', incoming: 'Bonjour, quel forfait convient à ma boutique ?', outgoing: 'Bienvenue 👋 Je vais vous aider.', assigned: 'Assigné maintenant', agents: ['Sarah', 'Mohammad', 'Nour'] },
    privacy: { title: 'Essayez le relais privé', hint: 'Écrivez un message et voyez-le passer via VAYRO sans afficher les numéros.', placeholder: 'Écrivez un message test...', send: 'Envoyer via VAYRO', doctor: 'Médecin', client: 'Client', hidden: 'numéro masqué', routed: 'Acheminé en sécurité' },
    hr: { title: 'Essayez le pipeline RH', hint: 'Faites avancer le candidat étape par étape.', candidate: 'Layan Ahmad · Front-End Developer', next: 'Étape suivante', stages: ['Nouveau', 'Tri', 'Entretien', 'Offre', 'Embauché'] },
    cta: 'Prêt à utiliser cela sur votre numéro professionnel ?', start: 'Commencer avec VAYRO'
  }
};

const flows: Array<{ id: Flow; icon: typeof KeyRound }> = [
  { id: 'otp', icon: KeyRound },
  { id: 'support', icon: MessageCircle },
  { id: 'privacy', icon: LockKeyhole },
  { id: 'hr', icon: BriefcaseBusiness },
];

export function MobileLiveDemo() {
  const params = useParams();
  const language = normalizeLanguage(params.lang);
  if (params.lang && !(params.lang in supportedLanguages)) return <Navigate to={`/${defaultLanguage}/demo`} replace />;
  const t = text[language];
  const rtl = supportedLanguages[language].dir === 'rtl';
  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const [active, setActive] = useState<Flow>('otp');
  const [phone, setPhone] = useState('+963 9XX XXX XXX');
  const [otp, setOtp] = useState('482913');
  const [otpState, setOtpState] = useState<OtpState>('ready');
  const [agent, setAgent] = useState(0);
  const [privacyInput, setPrivacyInput] = useState('');
  const [privacyMessage, setPrivacyMessage] = useState(rtl ? 'موعدي مناسب الساعة 5 مساءً.' : '5 PM works for me.');
  const [hrStage, setHrStage] = useState(1);

  const otpLabel = useMemo(() => t.otp[otpState], [otpState, t]);

  function sendOtp() {
    if (otpState === 'sending') return;
    setOtp(String(Math.floor(100000 + Math.random() * 900000)));
    setOtpState('sending');
    window.setTimeout(() => setOtpState('sent'), 650);
    window.setTimeout(() => setOtpState('delivered'), 1450);
  }

  function sendPrivacy() {
    const value = privacyInput.trim();
    if (!value) return;
    setPrivacyMessage(value);
    setPrivacyInput('');
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'VAYRO LIVE', url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
    } catch { /* cancelled */ }
  }

  return (
    <div className="mlive-page" dir={supportedLanguages[language].dir}>
      <header className="mlive-nav">
        <Link to={`/${language}`} className="mlive-back"><BackIcon size={18} /><span>{t.back}</span></Link>
        <img src="/brand/vayro-logo-white.png" alt="VAYRO" />
        <button type="button" onClick={share} aria-label={t.share}><Share2 size={18} /></button>
      </header>

      <main className="mlive-main">
        <section className="mlive-intro">
          <span className="mlive-live"><i /> LIVE EXPERIENCE</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <small><ShieldCheck size={14} />{t.safe}</small>
        </section>

        <div className="mlive-flows" role="tablist">
          {flows.map(({ id, icon: Icon }) => (
            <button key={id} type="button" className={active === id ? 'active' : ''} onClick={() => setActive(id)}>
              <span><Icon size={18} /></span><strong>{t.services[id][0]}</strong><small>{t.services[id][1]}</small>
            </button>
          ))}
        </div>

        <section className="mlive-card">
          {active === 'otp' && (
            <div className="mlive-flow mlive-otp">
              <div className="mlive-flow-head"><span><KeyRound size={17} /></span><div><h2>{t.otp.title}</h2><p>{t.otp.note}</p></div></div>
              <div className="mlive-steps"><span><b>1</b>{t.otp.one.replace(/^1\.\s*/, '')}</span><span><b>2</b>{t.otp.two.replace(/^2\.\s*/, '')}</span><span><b>3</b>{t.otp.three.replace(/^3\.\s*/, '')}</span></div>
              <label className="mlive-field"><span>{t.otp.phone}</span><input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
              <button className="mlive-primary" type="button" onClick={sendOtp} disabled={otpState === 'sending'}>{otpState === 'sending' ? <RefreshCw className="mlive-spin" size={18} /> : <Send size={18} />}{t.otp.send}</button>
              <div className="mlive-iphone-wrap">
                <div className="mlive-iphone">
                  <div className="mlive-island" />
                  <div className="mlive-status"><span>9:41</span><span>5G&nbsp; ▰</span></div>
                  <div className="mlive-wa-head"><span className="mlive-avatar">V</span><div><strong>VAYRO Verify</strong><small>{otpLabel}</small></div><CheckCheck size={17} /></div>
                  <div className="mlive-wa-body">
                    <span className="mlive-date">اليوم</span>
                    <div className={`mlive-message ${otpState !== 'ready' ? 'arrived' : ''}`}><p>{t.otp.msg}</p><strong>{otp}</strong><small>19:00 <CheckCheck size={13} /></small></div>
                  </div>
                  <div className="mlive-home-indicator" />
                </div>
                <div className={`mlive-delivery ${otpState === 'delivered' ? 'done' : ''}`}><span>{otpLabel}</span><small>{phone}</small></div>
              </div>
            </div>
          )}

          {active === 'support' && (
            <div className="mlive-flow">
              <div className="mlive-flow-head"><span><MessageCircle size={17} /></span><div><h2>{t.support.title}</h2><p>{t.support.hint}</p></div></div>
              <div className="mlive-chat-phone">
                <div className="mlive-chat-head"><span className="mlive-avatar">R</span><div><strong>{t.support.customer}</strong><small>online</small></div><span className="mlive-agent-badge"><UserRoundCheck size={14} />{t.support.agents[agent]}</span></div>
                <div className="mlive-chat-body"><div className="in">{t.support.incoming}<small>18:57</small></div><div className="out">{t.support.outgoing}<small>18:58 ✓✓</small></div></div>
                <div className="mlive-composer"><span>...</span><Send size={17} /></div>
              </div>
              <div className="mlive-agent-picker"><small>{t.support.assigned}</small><div>{t.support.agents.map((name: string, index: number) => <button type="button" className={agent === index ? 'active' : ''} onClick={() => setAgent(index)} key={name}><span>{name[0]}</span>{name}</button>)}</div></div>
            </div>
          )}

          {active === 'privacy' && (
            <div className="mlive-flow">
              <div className="mlive-flow-head"><span><LockKeyhole size={17} /></span><div><h2>{t.privacy.title}</h2><p>{t.privacy.hint}</p></div></div>
              <div className="mlive-privacy-map"><div><span><UserRoundCheck size={18} /></span><strong>{t.privacy.doctor}</strong><small>+963 ••• •• 214 · {t.privacy.hidden}</small></div><i><img src="/brand/vayro-logo-white.png" alt="VAYRO" /><small>{t.privacy.routed}</small></i><div><span><Users size={18} /></span><strong>{t.privacy.client}</strong><small>+963 ••• •• 862 · {t.privacy.hidden}</small></div></div>
              <div className="mlive-routed-message">{privacyMessage}</div>
              <div className="mlive-inline-form"><input value={privacyInput} onChange={(e) => setPrivacyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendPrivacy()} placeholder={t.privacy.placeholder} /><button type="button" onClick={sendPrivacy}><Send size={17} /></button></div>
            </div>
          )}

          {active === 'hr' && (
            <div className="mlive-flow">
              <div className="mlive-flow-head"><span><BriefcaseBusiness size={17} /></span><div><h2>{t.hr.title}</h2><p>{t.hr.hint}</p></div></div>
              <div className="mlive-candidate"><span>LA</span><div><strong>{t.hr.candidate}</strong><small>WhatsApp · CV received</small></div><b>92%</b></div>
              <div className="mlive-pipeline">{t.hr.stages.map((stage: string, index: number) => <div className={`${index <= hrStage ? 'done' : ''} ${index === hrStage ? 'current' : ''}`} key={stage}><span>{index < hrStage ? <Check size={13} /> : index + 1}</span><small>{stage}</small></div>)}</div>
              <button className="mlive-primary" type="button" onClick={() => setHrStage((hrStage + 1) % t.hr.stages.length)}><RefreshCw size={17} />{t.hr.next}</button>
            </div>
          )}
        </section>

        <section className="mlive-cta"><div><h2>{t.cta}</h2><p>VAYRO</p></div><Link to={`/${language}#pricing`}>{t.start}<ArrowRight size={17} /></Link></section>
      </main>
    </div>
  );
}
