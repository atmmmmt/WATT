import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, UserPlus, AlertCircle, Plus, X, RefreshCw,
  MessageSquare, CheckCircle, XCircle, Clock, Users, TrendingUp, AlertTriangle,
} from 'lucide-react';

function withTenant(path: string, tenantId: string) {
  return tenantId ? `${path}?tenantId=${encodeURIComponent(tenantId)}` : path;
}

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

function StatCell({ value, icon, color }: { value: any; icon: React.ReactNode; color?: string }) {
  return (
    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: color || 'var(--text-main)', fontWeight: 600 }}>
        {icon}
        {value ?? '—'}
      </div>
    </td>
  );
}

export function HrReportsPage() {
  const { token, user } = useAuth();
  const [tenantId, setTenantId] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'recruiter' });

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setReports(await apiRequest<any[]>(withTenant('/hr/reports/employees', tenantId), {}, token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل التقارير');
    } finally {
      setLoading(false);
    }
  }

  async function createEmployee(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await apiRequest('/hr/employees', { method: 'POST', body: JSON.stringify({ ...form, tenantId: tenantId || undefined }) }, token);
      setForm({ name: '', email: '', password: '', role: 'recruiter' });
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  // Summary row totals
  const totals = reports.reduce((acc, r) => ({
    assigned: acc.assigned + (r.assigned || 0),
    messagesSent: acc.messagesSent + (r.messagesSent || 0),
    contacted: acc.contacted + (r.contacted || 0),
    interviews: acc.interviews + (r.interviews || 0),
    accepted: acc.accepted + (r.accepted || 0),
    rejected: acc.rejected + (r.rejected || 0),
    staleApplications: acc.staleApplications + (r.staleApplications || 0),
  }), { assigned: 0, messagesSent: 0, contacted: 0, interviews: 0, accepted: 0, rejected: 0, staleApplications: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)', background: 'var(--brand-primary-soft)', padding: '0.2rem 0.75rem', borderRadius: 'var(--radius-full)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-block', marginBottom: '0.5rem' }}>HR Hub</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>تقارير أداء الموظفين</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>تابع أداء فريق التوظيف وأضف موظفين جدد.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {user?.role === 'super_admin' && (
            <>
              <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant ID..." style={{ ...inputSt, width: 200 }} />
              <button onClick={load} style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>تحميل</button>
            </>
          )}
          <button onClick={() => load()} style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={() => setShowForm(f => !f)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
            {showForm ? <X size={16} /> : <UserPlus size={16} />}
            {showForm ? 'إلغاء' : 'إضافة موظف'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', color: '#dc2626', fontSize: '0.9rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Add Employee Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={18} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>إضافة موظف HR جديد</h2>
            </div>
            <form onSubmit={createEmployee} style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>الاسم الكامل</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="أحمد محمد" style={inputSt} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>البريد الإلكتروني</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ahmed@company.com" style={inputSt} dir="ltr" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>كلمة المرور</label>
                <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={inputSt} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>الصلاحية</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputSt}>
                  <option value="recruiter">موظف توظيف (Recruiter)</option>
                  <option value="hr_manager">مدير HR</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>إلغاء</button>
                <button type="submit" disabled={submitting} style={{ padding: '0.65rem 1.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء الموظف'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BarChart2 size={20} color="var(--brand-primary)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>أداء فريق التوظيف</h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)' }}>{reports.length} موظف</span>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
            <p style={{ fontSize: '0.9rem' }}>جاري التحميل...</p>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={48} strokeWidth={1} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>لا توجد بيانات بعد</p>
            <p style={{ fontSize: '0.85rem' }}>أضف موظفين وابدأ عملية التوظيف لعرض التقارير.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-soft)' }}>
                  {[
                    { label: 'الموظف', icon: null },
                    { label: 'المُعيَّن', icon: <Users size={12} /> },
                    { label: 'رسائل', icon: <MessageSquare size={12} /> },
                    { label: 'تواصل', icon: <CheckCircle size={12} /> },
                    { label: 'مقابلات', icon: <TrendingUp size={12} /> },
                    { label: 'مقبول', icon: <CheckCircle size={12} color="#10b981" /> },
                    { label: 'مرفوض', icon: <XCircle size={12} color="#ef4444" /> },
                    { label: 'أول رد', icon: <Clock size={12} /> },
                    { label: 'متأخر', icon: <AlertTriangle size={12} color="#f59e0b" /> },
                  ].map(h => (
                    <th key={h.label} style={{ padding: '0.75rem 1.25rem', textAlign: h.icon ? 'center' : 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: h.icon ? 'center' : 'flex-start', gap: '0.3rem' }}>
                        {h.icon}{h.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <motion.tr key={r.employee.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                          {(r.employee.name || '?')[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.employee.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.employee.role === 'hr_manager' ? 'مدير HR' : 'موظف توظيف'}</div>
                        </div>
                      </div>
                    </td>
                    <StatCell value={r.assigned} icon={<Users size={13} />} />
                    <StatCell value={r.messagesSent} icon={<MessageSquare size={13} />} color="var(--brand-primary)" />
                    <StatCell value={r.contacted} icon={<CheckCircle size={13} />} color="#10B981" />
                    <StatCell value={r.interviews} icon={<TrendingUp size={13} />} color="#f59e0b" />
                    <StatCell value={r.accepted} icon={<CheckCircle size={13} />} color="#10b981" />
                    <StatCell value={r.rejected} icon={<XCircle size={13} />} color="#ef4444" />
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {r.averageFirstResponseMinutes != null ? `${r.averageFirstResponseMinutes} دقيقة` : '—'}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      {r.staleApplications > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700, fontSize: '0.78rem' }}>
                          <AlertTriangle size={12} /> {r.staleApplications}
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '0.82rem' }}>✓</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              {/* Totals Row */}
              {reports.length > 1 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-main)', borderTop: '2px solid var(--border-medium)' }}>
                    <td style={{ padding: '0.75rem 1.25rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.82rem' }}>الإجمالي</td>
                    {[totals.assigned, totals.messagesSent, totals.contacted, totals.interviews, totals.accepted, totals.rejected, '—', totals.staleApplications].map((v, i) => (
                      <td key={i} style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.82rem' }}>{v}</td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
