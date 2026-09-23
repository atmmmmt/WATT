import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, X, Copy, CheckCircle } from 'lucide-react';

function withTenant(path: string, tenantId: string) {
  return tenantId ? `${path}?tenantId=${encodeURIComponent(tenantId)}` : path;
}

const stageOptions = [
  { value: 'general', label: 'عام' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'interview', label: 'مقابلة' },
  { value: 'offer', label: 'عرض عمل' },
  { value: 'accepted', label: 'تم القبول' },
  { value: 'rejected', label: 'مرفوض' },
];

const stageColors: Record<string, { color: string; bg: string }> = {
  general:   { color: '#064E3B', bg: 'rgba(6, 78, 59,0.1)' },
  contacted: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  interview: { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  offer:     { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  accepted:  { color: '#059669', bg: 'rgba(5,150,105,0.1)'  },
  rejected:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

const inputSt: React.CSSProperties = {
  padding: '0.65rem 0.9rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-medium)',
  background: 'var(--bg-main)',
  color: 'var(--text-main)',
  fontSize: '0.9rem',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};

const VARS = ['{{candidateName}}', '{{jobTitle}}', '{{recruiterName}}', '{{interviewDate}}'];

export function HrTemplatesPage() {
  const { token, user } = useAuth();
  const [tenantId, setTenantId] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    stage: 'general',
    body: 'مرحباً {{candidateName}}، بخصوص وظيفة {{jobTitle}} نود التواصل معك.',
  });

  async function load() {
    if (!token) return;
    setTemplates(await apiRequest<any[]>(withTenant('/hr/message-templates', tenantId), {}, token));
  }

  async function createTemplate(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await apiRequest('/hr/message-templates', { method: 'POST', body: JSON.stringify({ ...form, tenantId: tenantId || undefined }) }, token);
      setForm({ name: '', stage: 'general', body: '' });
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function copyBody(body: string, id: string) {
    navigator.clipboard.writeText(body).catch(() => undefined);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  useEffect(() => { load().catch(() => undefined); }, [token]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)', background: 'var(--brand-primary-soft)', padding: '0.2rem 0.75rem', borderRadius: 'var(--radius-full)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-block', marginBottom: '0.5rem' }}>HR Hub</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>قوالب رسائل واتساب</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>أنشئ قوالب احترافية لإرسالها للمرشحين بضغطة واحدة.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {user?.role === 'super_admin' && (
            <>
              <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant ID..." style={{ ...inputSt, width: 200 }} />
              <button onClick={load} style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>تحميل</button>
            </>
          )}
          <button onClick={() => setShowForm(f => !f)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'إلغاء' : 'قالب جديد'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={18} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>إنشاء قالب جديد</h2>
            </div>
            <form onSubmit={createTemplate} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>اسم القالب</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: ترحيب بمرشح جديد" style={inputSt} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>المرحلة</label>
                  <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} style={inputSt}>
                    {stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>نص الرسالة</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {VARS.map(v => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, body: f.body + v }))}
                        style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--brand-primary)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea required value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="اكتب نص الرسالة..." style={{ ...inputSt, minHeight: 130, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>إلغاء</button>
                <button type="submit" disabled={submitting} style={{ padding: '0.65rem 1.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'جاري الحفظ...' : 'حفظ القالب'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <MessageSquare size={48} strokeWidth={1} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>لا توجد قوالب بعد</h3>
          <p style={{ fontSize: '0.875rem' }}>أنشئ قالبك الأول وابدأ بالتواصل مع المرشحين باحترافية.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {templates.map((t, i) => {
            const sc = stageColors[t.stage] || stageColors.general;
            return (
              <motion.div key={t._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: sc.bg, color: sc.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={15} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{t.name}</span>
                  </div>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 700, background: sc.bg, color: sc.color }}>
                    {stageOptions.find(o => o.value === t.stage)?.label || t.stage}
                  </span>
                </div>
                <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{t.body}</p>
                </div>
                <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => copyBody(t.body, t._id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', background: 'transparent', cursor: 'pointer', color: copied === t._id ? '#10b981' : 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                    {copied === t._id ? <><CheckCircle size={13} /> تم النسخ</> : <><Copy size={13} /> نسخ النص</>}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
