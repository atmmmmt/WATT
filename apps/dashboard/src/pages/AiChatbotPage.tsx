import { FormEvent, useMemo, useState } from 'react';
import { Bot, CheckCircle2, MessageCircle, Save, Send, Sparkles, WandSparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Mascot } from '../components/Mascot';

type Tone = 'friendly' | 'professional' | 'sales';
type Settings = {
  enabled: boolean;
  botName: string;
  welcome: string;
  businessContext: string;
  fallback: string;
  tone: Tone;
  knowledge: string;
};

type ChatMessage = { role: 'user' | 'assistant'; text: string };

const defaults: Settings = {
  enabled: true,
  botName: 'مساعد VAYRO',
  welcome: 'أهلاً وسهلاً 👋 كيف فيني ساعدك اليوم؟',
  businessContext: 'عرّف نشاطك والخدمات الأساسية التي تريد من البوت شرحها للعملاء.',
  fallback: 'ما عندي معلومة دقيقة عن هالسؤال، بخلي أحد أعضاء الفريق يكمل معك.',
  tone: 'friendly',
  knowledge: 'الدوام => من الأحد للخميس من 9 صباحاً حتى 6 مساءً\nالأسعار => الأسعار تختلف حسب الباقة والخدمات المطلوبة\nالدعم => فريق الدعم متوفر لمتابعة أي مشكلة تشغيلية',
};

function normalize(value: string) {
  return value.toLocaleLowerCase('ar').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
}

function generateReply(message: string, settings: Settings) {
  const question = normalize(message);
  const entries = settings.knowledge.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/=>|::|:/).map(part => part.trim());
    return { key: parts[0] || '', answer: parts.slice(1).join(':').trim() };
  }).filter(entry => entry.key && entry.answer);

  const matched = entries
    .map(entry => ({ ...entry, score: normalize(entry.key).split(/\s+/).filter(token => token && question.includes(token)).length }))
    .sort((a, b) => b.score - a.score)[0];

  if (matched?.score) return matched.answer;
  if (/مرحبا|اهلا|السلام|hello/i.test(message)) return settings.welcome;
  if (/موظف|انسان|بشري|فريق/i.test(message)) return 'أكيد، رح أحوّل المحادثة لفريقك حتى يكمل مع العميل مباشرة.';
  return settings.fallback;
}

export function AiChatbotPage() {
  const { user } = useAuth();
  const storageKey = `vayro-ai-chatbot:${user?.tenantId || 'platform'}`;
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { return defaults; }
  });
  const [saved, setSaved] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: settings.welcome }]);

  const toneLabel = useMemo(() => ({ friendly: 'ودود وطبيعي', professional: 'مهني ومختصر', sales: 'بيعي ذكي' }[settings.tone]), [settings.tone]);

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    const reply = generateReply(value, settings);
    setMessages(current => [...current, { role: 'user', text: value }, { role: 'assistant', text: reply }]);
    setInput('');
  }

  return (
    <div className="page-stack vayro-ai-page">
      <section className="vayro-ai-hero">
        <div className="vayro-ai-hero-copy">
          <span className="vayro-ai-kicker"><Sparkles size={15} /> VAYRO AI</span>
          <h1>شات بوت ذكي يحكي بصوت شركتك</h1>
          <p>جهّز شخصية المساعد، قاعدة المعرفة وطريقة الرد، وجرّب التجربة قبل ربطها بمحادثات العملاء.</p>
          <div className="vayro-ai-status"><span className={settings.enabled ? 'on' : ''} /> {settings.enabled ? 'المساعد مفعّل' : 'المساعد متوقف'} · {toneLabel}</div>
        </div>
        <div className="vayro-ai-hero-character">
          <Mascot pose="working" size={168} />
          <div><strong>{settings.botName}</strong><small>جاهز للمساعدة</small></div>
        </div>
      </section>

      <div className="vayro-ai-grid">
        <section className="card vayro-ai-settings">
          <header><div><span>الإعداد</span><h2>شخصية البوت</h2></div><button className="button button-primary" onClick={save}>{saved ? <CheckCircle2 size={17} /> : <Save size={17} />}{saved ? 'تم الحفظ' : 'حفظ'}</button></header>

          <div className="vayro-ai-toggle-row">
            <div><strong>تشغيل المساعد</strong><small>إيقافه ما بيحذف أي إعداد.</small></div>
            <button className={`vayro-ai-switch ${settings.enabled ? 'active' : ''}`} onClick={() => setSettings(current => ({ ...current, enabled: !current.enabled }))} aria-label="تشغيل أو إيقاف المساعد"><span /></button>
          </div>

          <div className="vayro-ai-form-grid">
            <label><span>اسم المساعد</span><input value={settings.botName} onChange={e => setSettings({ ...settings, botName: e.target.value })} /></label>
            <label><span>نبرة الرد</span><select value={settings.tone} onChange={e => setSettings({ ...settings, tone: e.target.value as Tone })}><option value="friendly">ودود وطبيعي</option><option value="professional">مهني ومختصر</option><option value="sales">بيعي ذكي</option></select></label>
            <label className="wide"><span>رسالة الترحيب</span><input value={settings.welcome} onChange={e => setSettings({ ...settings, welcome: e.target.value })} /></label>
            <label className="wide"><span>سياق النشاط</span><textarea rows={3} value={settings.businessContext} onChange={e => setSettings({ ...settings, businessContext: e.target.value })} /></label>
            <label className="wide"><span>الرد الاحتياطي</span><textarea rows={2} value={settings.fallback} onChange={e => setSettings({ ...settings, fallback: e.target.value })} /></label>
          </div>
        </section>

        <section className="card vayro-ai-preview">
          <header><div><span>LIVE PREVIEW</span><h2>جرّب المحادثة</h2></div><WandSparkles size={22} /></header>
          <div className="vayro-ai-chat-preview">
            <div className="vayro-ai-chat-head"><span><Bot size={17} /></span><div><strong>{settings.botName}</strong><small>متصل الآن</small></div></div>
            <div className="vayro-ai-messages">{messages.map((message, index) => <div key={index} className={`vayro-ai-message ${message.role}`}>{message.text}</div>)}</div>
            <form onSubmit={send}><input value={input} onChange={e => setInput(e.target.value)} placeholder="اكتب سؤال للتجربة..." /><button aria-label="إرسال"><Send size={17} /></button></form>
          </div>
        </section>
      </div>

      <section className="card vayro-ai-knowledge">
        <header><div><span>KNOWLEDGE BASE</span><h2>قاعدة معرفة سريعة</h2><p>كل سطر: كلمة أو سؤال ثم <code>=&gt;</code> ثم الجواب. هالطريقة سريعة وخفيفة وبتعطيك Preview فوري.</p></div><MessageCircle size={22} /></header>
        <textarea rows={8} value={settings.knowledge} onChange={e => setSettings({ ...settings, knowledge: e.target.value })} />
      </section>
    </div>
  );
}
