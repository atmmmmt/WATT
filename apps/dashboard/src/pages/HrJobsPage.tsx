import { FormEvent, useEffect, useState } from 'react';
import { API_BASE_URL, apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Plus, Copy, ExternalLink, CheckCircle, AlertCircle,
  MapPin, Clock, DollarSign, Tag, FileText, AlignLeft, RefreshCw, X,
} from 'lucide-react';

function withTenant(path: string, tenantId: string) {
  return tenantId ? `${path}?tenantId=${encodeURIComponent(tenantId)}` : path;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  open:   { label: 'مفتوحة',  color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  closed: { label: 'مغلقة',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
  draft:  { label: 'مسودة',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
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

export function HrJobsPage() {
  const { token, user } = useAuth();
  const [tenantId, setTenantId] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', slug: '', city: '', employmentType: '', salaryRange: '', description: '', requirements: '',
  });

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setJobs(await apiRequest<any[]>(withTenant('/hr/jobs', tenantId), {}, token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الوظائف');
    } finally {
      setLoading(false);
    }
  }

  async function createJob(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await apiRequest('/hr/jobs', { method: 'POST', body: JSON.stringify({ ...form, tenantId: tenantId || undefined }) }, token);
      setForm({ title: '', slug: '', city: '', employmentType: '', salaryRange: '', description: '', requirements: '' });
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink(slug: string) {
    const link = `${window.location.origin}/apply/${slug}`;
    navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  useEffect(() => { load(); }, [token]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)', background: 'var(--brand-primary-soft)', padding: '0.2rem 0.75rem', borderRadius: 'var(--radius-full)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HR Hub</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>الوظائف وروابط التقديم</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>أنشئ وظائف وشارك روابط التقديم مع المرشحين مباشرةً.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {user?.role === 'super_admin' && (
            <>
              <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant ID..." style={{ ...inputStyle, width: 200 }} />
              <button onClick={load} style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>تحميل</button>
            </>
          )}
          <button onClick={() => load()} style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => setShowForm(f => !f)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'إلغاء' : 'وظيفة جديدة'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', color: '#dc2626', fontSize: '0.9rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={18} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>إنشاء وظيفة جديدة</h2>
            </div>
            <form onSubmit={createJob} style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <Field label="اسم الوظيفة">
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: مندوب مبيعات" style={inputStyle} />
              </Field>
              <Field label="الرابط (Slug)">
                <input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="مثال: sales-agent" style={inputStyle} dir="ltr" />
              </Field>
              <Field label="المدينة">
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="الرياض" style={inputStyle} />
              </Field>
              <Field label="نوع الدوام">
                <input value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value })} placeholder="دوام كامل / جزئي" style={inputStyle} />
              </Field>
              <Field label="نطاق الراتب">
                <input value={form.salaryRange} onChange={e => setForm({ ...form, salaryRange: e.target.value })} placeholder="5,000 – 8,000 ريال" style={inputStyle} />
              </Field>
              <div />
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="الوصف الوظيفي">
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="اكتب وصفاً تفصيلياً للوظيفة..." style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} />
                </Field>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="المتطلبات">
                  <textarea value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} placeholder="المؤهلات والخبرات المطلوبة..." style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                </Field>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>إلغاء</button>
                <button type="submit" disabled={submitting} style={{ padding: '0.65rem 1.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء الوظيفة'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jobs Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>قائمة الوظائف</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)' }}>{jobs.length} وظيفة</span>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
            <p style={{ fontSize: '0.9rem' }}>جاري التحميل...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Briefcase size={48} strokeWidth={1} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>لا توجد وظائف بعد</p>
            <p style={{ fontSize: '0.85rem' }}>أنشئ أول وظيفة وابدأ باستقطاب المرشحين.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-soft)' }}>
                  {['الوظيفة', 'الحالة', 'المدينة', 'نوع الدوام', 'الراتب', 'رابط التقديم'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => {
                  const sConf = statusConfig[job.status] || { label: job.status, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' };
                  const applyLink = `${window.location.origin}/apply/${job.slug}`;
                  return (
                    <motion.tr
                      key={job._id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{ borderBottom: '1px solid var(--border-soft)' }}
                    >
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.15rem' }}>{job.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{job.slug}</div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700, background: sConf.bg, color: sConf.color }}>{sConf.label}</span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MapPin size={13} /> {job.city || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={13} /> {job.employmentType || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <DollarSign size={13} /> {job.salaryRange || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>/apply/{job.slug}</code>
                          <button
                            onClick={() => copyLink(job.slug)}
                            title="نسخ الرابط"
                            style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-soft)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied === job.slug ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }}
                          >
                            {copied === job.slug ? <CheckCircle size={13} /> : <Copy size={13} />}
                          </button>
                          <a href={applyLink} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-soft)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-main)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          API العام: <code style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{API_BASE_URL}/apply/[slug]</code>
        </div>
      </div>
    </div>
  );
}
