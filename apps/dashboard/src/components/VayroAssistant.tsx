import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronLeft, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mascot } from './Mascot';

const routeHelp: Array<{ match: RegExp; title: string; text: string; actions: Array<{ label: string; path: string }> }> = [
  { match: /^\/support\/inbox/, title: 'أنا معك بصندوق الوارد', text: 'افتح محادثة، عيّن الموظف، واستخدم الردود الجاهزة. إذا بدك أتمتة أكثر افتح VAYRO AI.', actions: [{ label: 'VAYRO AI', path: '/ai-chatbot' }, { label: 'فريق الدعم', path: '/support/employees' }] },
  { match: /^\/support\/connection/, title: 'خلينا نربط واتساب', text: 'ابدأ جلسة الربط وامسح QR. بعد ظهور حالة جاهز بتصير المحادثات متاحة للفريق.', actions: [{ label: 'صندوق الوارد', path: '/support/inbox' }] },
  { match: /^\/hr/, title: 'مساعد التوظيف جاهز', text: 'بقدر أوصلك بسرعة للمرشحين والوظائف والتقارير بدون ما تضيع بالقوائم.', actions: [{ label: 'المتقدمين', path: '/hr/inbox' }, { label: 'الوظائف', path: '/hr/jobs' }] },
  { match: /^\/otp/, title: 'مساعد OTP', text: 'راجع السجل والقوالب ومفاتيح API من مكان واحد، وخلي التجربة قصيرة وواضحة للمطور.', actions: [{ label: 'سجل OTP', path: '/otp-logs' }, { label: 'مفاتيح API', path: '/api-keys' }] },
  { match: /^\/tenants/, title: 'مساعد إدارة العملاء', text: 'من هون بتضيف العميل، تختار خدماته، وتدير اشتراكه وتسليمه.', actions: [{ label: 'الباقات', path: '/packages' }, { label: 'المالية', path: '/finance' }] },
  { match: /^\/ai-chatbot/, title: 'VAYRO AI', text: 'هنا بتبني شخصية البوت وقاعدة المعرفة وتجرّب الرد قبل تشغيله مع العملاء.', actions: [{ label: 'صندوق الوارد', path: '/support/inbox' }] },
];

function answerFor(message: string) {
  const q = message.trim();
  if (!q) return '';
  if (/ربط|واتساب|qr/i.test(q)) return 'روح على «ربط واتساب»، ابدأ الجلسة وامسح QR. لما تصير الحالة جاهز افتح صندوق الوارد.';
  if (/عميل|شركة|اشتراك/i.test(q)) return 'من «العملاء» بتضيف الشركة وتحدد خدماتها، وبعدها بتضبط الباقة والمدة والسعر.';
  if (/موظف|فريق|دعم/i.test(q)) return 'من «فريق الدعم» بتضيف الموظفين والصلاحيات، وبصندوق الوارد بتعيّن كل محادثة للشخص المناسب.';
  if (/ذكاء|بوت|ai|chatbot/i.test(q)) return 'افتح VAYRO AI: عرّف أسلوب الرد، أضف قاعدة المعرفة، وجرّب البوت قبل تشغيله.';
  if (/otp|تحقق|رمز/i.test(q)) return 'خدمة OTP موجودة بالسجل والقوالب ومفاتيح API. ابدأ من سجل OTP إذا بدك تراجع المحاولات.';
  return 'اكتبلي شو بدك تعمل بالمنصة، مثل: «كيف أربط واتساب؟» أو «وين أضيف موظف؟» وأنا بوجّهك مباشرة.';
}

export function VayroAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  const context = useMemo(
    () => routeHelp.find(item => item.match.test(location.pathname)) || {
      title: 'أنا مساعد VAYRO',
      text: 'إذا ضعت بأي صفحة، اسألني وأنا بوصلك للمكان الصح بسرعة.',
      actions: [{ label: 'VAYRO AI', path: '/ai-chatbot' }, { label: 'الرئيسية', path: '/home' }],
    },
    [location.pathname],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setMessages(current => [...current, { role: 'user', text: value }, { role: 'assistant', text: answerFor(value) }]);
    setInput('');
  }

  return (
    <>
      <button className="vayro-assistant-fab" onClick={() => setOpen(true)} aria-label="فتح مساعد VAYRO">
        <span className="vayro-assistant-fab-character"><Mascot pose="pointing" size={70} float={false} /></span>
        <span className="vayro-assistant-fab-copy"><small><Sparkles size={12} /> مساعد VAYRO</small><strong>كيف بقدر ساعدك؟</strong></span>
        <MessageCircle size={19} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div className="vayro-assistant-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.currentTarget === e.target) setOpen(false); }}>
            <motion.section className="vayro-assistant-panel" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .985 }} transition={{ duration: .2, ease: [0.22, 1, 0.36, 1] }}>
              <header className="vayro-assistant-head">
                <div className="vayro-assistant-head-character"><Mascot pose="wave" size={92} /></div>
                <div><span>VAYRO ASSISTANT</span><h2>{context.title}</h2><p>{context.text}</p></div>
                <button onClick={() => setOpen(false)} aria-label="إغلاق"><X size={19} /></button>
              </header>

              <div className="vayro-assistant-actions">
                {context.actions.map(action => <button key={action.path} onClick={() => { setOpen(false); navigate(action.path); }}>{action.label}<ChevronLeft size={16} /></button>)}
              </div>

              <div className="vayro-assistant-chat">
                {messages.length === 0 ? <div className="vayro-assistant-empty"><Bot size={20} /><span>اسألني عن أي خطوة داخل VAYRO.</span></div> : messages.map((message, index) => <div key={index} className={`vayro-assistant-message ${message.role}`}>{message.text}</div>)}
              </div>

              <form className="vayro-assistant-composer" onSubmit={submit}>
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="مثلاً: كيف أربط واتساب؟" />
                <button type="submit" aria-label="إرسال"><Send size={18} /></button>
              </form>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
