import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  MessageSquare, 
  Tag, 
  ToggleRight, 
  Plus, 
  CheckCircle2, 
  Palette, 
  Type, 
  Archive,
  Search,
  Sliders,
  Sparkles
} from 'lucide-react';

export function SupportSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    allowAgentClaimUnassigned: true,
    allowAgentViewUnassigned: true,
    allowSupervisorViewAll: true,
    aiEnabled: false,
    aiPauseOnHumanTakeover: true,
    aiInstructions: '',
    aiKnowledgeBase: '',
  });
  // Read-only from the server: whether ANTHROPIC_API_KEY is set. Never sent back.
  const [aiConfigured, setAiConfigured] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [quickReplyForm, setQuickReplyForm] = useState({ title: '', message: '', category: 'عام' });
  const [tagForm, setTagForm] = useState({ name: '', color: '#064E3B' });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);

  async function load() {
    if (!token) return;
    try {
      const [s, qr, t] = await Promise.all([
        apiRequest<any>('/api/support/settings', {}, token),
        apiRequest<any[]>('/api/quick-replies', {}, token),
        apiRequest<any[]>('/api/tags', {}, token),
      ]);
      const { aiConfigured: configured, ...rest } = s || {};
      setSettings((prev) => ({ ...prev, ...rest }));
      setAiConfigured(configured !== false);
      setQuickReplies(qr);
      setTags(t);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { load(); }, [token]);

  async function saveSettings() {
    if (!token) return;
    try {
      setLoading(true);
      setSaveError('');
      const saved = await apiRequest<any>('/api/support/settings', { method: 'PATCH', body: JSON.stringify(settings) }, token);
      if (saved && typeof saved.aiConfigured === 'boolean') setAiConfigured(saved.aiConfigured);
      setNotice('تم حفظ الإعدادات بنجاح');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات');
    } finally { setLoading(false); }
  }

  async function createQuickReply(e: FormEvent) {
    e.preventDefault();
    if (!token || !quickReplyForm.title.trim() || !quickReplyForm.message.trim()) return;
    await apiRequest('/api/quick-replies', { method: 'POST', body: JSON.stringify(quickReplyForm) }, token);
    setQuickReplyForm({ title: '', message: '', category: 'عام' });
    setShowQuickReplyModal(false);
    load();
  }

  async function createTag(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    await apiRequest('/api/tags', { method: 'POST', body: JSON.stringify(tagForm) }, token);
    setTagForm({ name: '', color: '#064E3B' });
    load();
  }

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-stack"
      dir="rtl"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">إعدادات النظام</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>تكوين منصة الدعم</h1>
        </div>
        <AnimatePresence>
          {notice && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ background: 'var(--status-success)', color: 'white', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <CheckCircle2 size={16} /> {notice}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <article className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={20} color="var(--brand-primary)" /> قواعد التوزيع والتشغيل
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { key: 'allowAgentClaimUnassigned', label: 'السماح للموظفين بسحب المحادثات غير المسندة', desc: 'تمكن الموظفين من تعيين المحادثات لأنفسهم يدوياً.' },
                { key: 'allowAgentViewUnassigned', label: 'السماح للموظفين برؤية المحادثات غير المسندة', desc: 'يظهر قسم "غير مسند" لجميع موظفي الدعم.' },
                { key: 'allowSupervisorViewAll', label: 'السماح للمشرفين برؤية جميع محادثات الفريق', desc: 'تمكن المشرفين من مراقبة أداء الفريق بالكامل.' }
              ].map((rule) => (
                <label key={rule.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{rule.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rule.desc}</div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={(settings as any)[rule.key]} 
                    onChange={(e) => setSettings({ ...settings, [rule.key]: e.target.checked })}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--brand-primary)' }}
                  />
                </label>
              ))}
            </div>
            <button className="btn-primary" onClick={saveSettings} disabled={loading} style={{ marginTop: '1.5rem', width: '100%' }}>
              {loading ? 'جاري الحفظ...' : 'حفظ التكوين الحالي'}
            </button>
            {saveError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.75rem' }}>{saveError}</p>}
          </article>

          <article className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="var(--brand-primary)" /> الرد الآلي بالذكاء الاصطناعي
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              يرد على رسائل العملاء من قاعدة المعرفة أدناه فقط. إذا لم يجد الجواب يحوّل المحادثة لموظف ويترك ملاحظة داخلية.
            </p>

            {!aiConfigured && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                مفتاح مزود الذكاء الاصطناعي غير مضبوط على السيرفر (ANTHROPIC_API_KEY) — لن يرد AI حتى يُضاف.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { key: 'aiEnabled', label: 'تفعيل الرد الآلي', desc: settings.aiEnabled ? 'الحالة: AI Active' : 'الحالة: AI Paused — لا يتم إرسال أي رد آلي.' },
                { key: 'aiPauseOnHumanTakeover', label: 'إيقاف AI عند استلام موظف للمحادثة', desc: 'عند رد موظف أو تعيين المحادثة له يتوقف AI فيها (Human Takeover).' },
              ].map((rule) => (
                <label key={rule.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{rule.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rule.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={(settings as any)[rule.key]}
                    onChange={(e) => setSettings({ ...settings, [rule.key]: e.target.checked })}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--brand-primary)' }}
                  />
                </label>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>تعليمات للمساعد (الأسلوب، ما يجب تجنبه)</label>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={settings.aiInstructions}
                  onChange={(e) => setSettings({ ...settings, aiInstructions: e.target.value })}
                  placeholder="مثال: خاطب العميل بلطف، لا تعطي أسعاراً غير مذكورة..."
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>قاعدة المعرفة</label>
                <textarea
                  rows={8}
                  maxLength={60000}
                  value={settings.aiKnowledgeBase}
                  onChange={(e) => setSettings({ ...settings, aiKnowledgeBase: e.target.value })}
                  placeholder="أوقات الدوام، الخدمات، الأسعار، سياسة الاسترجاع، الأسئلة الشائعة..."
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>{settings.aiKnowledgeBase.length.toLocaleString('ar')} / 60,000</div>
              </div>
            </div>
            <button className="btn-primary" onClick={saveSettings} disabled={loading} style={{ marginTop: '1.25rem', width: '100%' }}>
              {loading ? 'جاري الحفظ...' : 'حفظ إعدادات الذكاء الاصطناعي'}
            </button>
          </article>

          <article className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} color="var(--brand-primary)" /> الردود السريعة (Templates)
              </h3>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => {}}>إدارة الفئات</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {quickReplies.map((reply) => (
                <div key={reply._id} className="card" style={{ padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--brand-primary)', fontWeight: 700, textTransform: 'uppercase' }}>{reply.category}</span>
                    <Archive size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{reply.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{reply.message}</div>
                </div>
              ))}
              <div className="card" onClick={() => setShowQuickReplyModal(true)} style={{ border: '2px dashed var(--border-medium)', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.background = 'var(--brand-primary-soft)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Plus size={24} color="var(--brand-primary)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--brand-primary)', marginTop: '0.5rem', fontWeight: 600 }}>إضافة رد جديد</span>
              </div>
            </div>
          </article>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <article className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>إنشاء وسم جديد</h3>
            <form onSubmit={createTag} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>اسم الوسم</label>
                <div style={{ position: 'relative' }}>
                  <Tag size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    placeholder="مثل: عميل VIP، شكوى..." 
                    value={tagForm.name} 
                    onChange={e => setTagForm({ ...tagForm, name: e.target.value })}
                    style={{ paddingRight: '2.5rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>لون الوسم</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['#064E3B', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'].map(c => (
                    <div 
                      key={c} 
                      onClick={() => setTagForm({ ...tagForm, color: c })}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: tagForm.color === c ? '2px solid white' : 'none', boxShadow: tagForm.color === c ? '0 0 0 2px var(--brand-primary)' : 'none' }} 
                    />
                  ))}
                </div>
              </div>
              <button className="btn-primary" style={{ marginTop: '0.5rem' }}><Plus size={18} /> إضافة الوسم</button>
            </form>

            <div style={{ marginTop: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem' }}>الوسوم الحالية</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {tags.map(t => (
                  <span key={t._id} style={{ 
                    padding: '0.4rem 0.8rem', 
                    borderRadius: 'var(--radius-md)', 
                    background: `${t.color}15`, 
                    color: t.color, 
                    border: `1px solid ${t.color}30`,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.color }} />
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="card" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-soft)' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>مساعدة الإعدادات</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              استخدم الردود السريعة لتوفير الوقت على موظفي الدعم. يمكنك استخدام "/" داخل المحادثة للوصول السريع إليها.
              الوسوم تساعدك في تصنيف المحادثات لإنشاء تقارير دقيقة حول طبيعة طلبات العملاء.
            </p>
          </article>
        </div>
      </div>
    </motion.div>

    {/* Quick Reply Modal */}
    {showQuickReplyModal && <div onClick={() => setShowQuickReplyModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={18} color="var(--brand-primary)" /> إضافة رد سريع جديد
          </h3>
          <form onSubmit={createQuickReply} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>العنوان</label>
              <input placeholder="مثل: ترحيب، شكر، متابعة..." value={quickReplyForm.title} onChange={e => setQuickReplyForm({ ...quickReplyForm, title: e.target.value })} required autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>الفئة</label>
              <input placeholder="مثل: عام، مبيعات، دعم..." value={quickReplyForm.category} onChange={e => setQuickReplyForm({ ...quickReplyForm, category: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>نص الرد</label>
              <textarea placeholder="اكتب نص الرد هنا..." value={quickReplyForm.message} onChange={e => setQuickReplyForm({ ...quickReplyForm, message: e.target.value })} required rows={4} style={{ width: '100%', resize: 'vertical', borderRadius: '10px', border: '1px solid var(--border-soft)', padding: '0.65rem 0.85rem', fontSize: '0.9rem', fontFamily: 'inherit', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowQuickReplyModal(false)}>إلغاء</button>
              <button type="submit" className="btn-primary" disabled={!quickReplyForm.title.trim() || !quickReplyForm.message.trim()}><Plus size={15} /> حفظ الرد</button>
            </div>
          </form>
        </div>
      </div>}
    </>
  );
}
