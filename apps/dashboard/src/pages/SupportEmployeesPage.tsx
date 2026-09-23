import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  Shield,
  UserCheck,
  UserMinus,
  Edit3,
  Building2,
  Search,
  MoreVertical,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'supervisor' | 'agent';
  status: 'active' | 'inactive';
}

interface EmployeeFormState {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'supervisor' | 'agent';
}

const initialForm: EmployeeFormState = {
  name: '',
  email: '',
  phone: '',
  role: 'agent',
};
const COMPANY_ID_KEY = 'vayro-support-company-id';

function roleBadge(role: string) {
  switch (role) {
    case 'admin': return { label: 'مدير الدعم', color: '#064E3B', bg: 'rgba(6, 78, 59, 0.1)' };
    case 'supervisor': return { label: 'مشرف', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
    default: return { label: 'موظف', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' };
  }
}

export function SupportEmployeesPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(() => user?.tenantId || window.localStorage.getItem(COMPANY_ID_KEY) || '');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const isSuperAdmin = user?.role === 'super_admin';

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const query = isSuperAdmin && companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const data = await apiRequest<Employee[]>(`/api/employees${query}`, {}, token);
      setEmployees(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      if (editingId) {
        console.log('[Employee] Updating employee', editingId, form);
        await apiRequest(`/api/employees/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) }, token);
        setSubmitResult({ ok: true, msg: 'تم تحديث بيانات الموظف' });
      } else {
        const payload = { ...form, ...(isSuperAdmin ? { companyId } : {}) };
        console.log('[Employee] Creating employee:', payload);
        await apiRequest('/api/employees', { method: 'POST', body: JSON.stringify(payload) }, token);
        setSubmitResult({ ok: true, msg: 'تم إنشاء الحساب وإرسال إيميل الدعوة ✅' });
      }
      setForm(initialForm);
      setEditingId(null);
      load();
    } catch (err) {
      console.error('[Employee] Error:', err);
      setSubmitResult({ ok: false, msg: err instanceof Error ? err.message : 'حدث خطأ' });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEmployee(id: string) {
    if (!token) return;
    if (!window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
    try {
      await apiRequest(`/api/employees/${id}`, { method: 'DELETE' }, token);
      load();
    } catch (err) {
      console.error('[Employee] Delete error:', err);
    }
  }

  useEffect(() => { load(); }, [token, companyId]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-stack"
      dir="rtl"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">إدارة الموارد البشرية</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>فريق عمل الدعم</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input placeholder="البحث عن موظف..." style={{ paddingRight: '2.5rem', width: '260px' }} />
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        <article className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>أعضاء الفريق ({employees.length})</h3>
            {loading && <div className="animate-spin" style={{ width: '20px', height: '20px', border: '2px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-main)' }}>
                <tr>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>الموظف</th>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>الدور</th>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>الحالة</th>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const badge = roleBadge(emp.role);
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {emp.name[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{emp.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Mail size={12} /> {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', background: badge.bg, color: badge.color, fontSize: '0.75rem', fontWeight: 700 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: emp.status === 'active' ? 'var(--status-success)' : emp.status === 'inactive' ? '#f59e0b' : 'var(--status-error)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: emp.status === 'active' ? 'var(--status-success)' : emp.status === 'inactive' ? '#f59e0b' : 'var(--status-error)' }} />
                          {emp.status === 'active' ? 'نشط' : emp.status === 'inactive' ? 'في الانتظار' : 'موقوف'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn-ghost" 
                            style={{ padding: '0.4rem' }}
                            onClick={() => { setEditingId(emp.id); setForm({ name: emp.name, email: emp.email, phone: emp.phone, role: emp.role }); }}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            className="btn-ghost" 
                            style={{ padding: '0.4rem', color: 'var(--status-error)' }}
                            onClick={() => deleteEmployee(emp.id)}
                          >
                            <UserMinus size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {isSuperAdmin && (
            <article className="card" style={{ borderRight: '4px solid var(--brand-primary)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} color="var(--brand-primary)" /> تبديل الشركة (Tenant)
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  placeholder="Tenant ID..." 
                  value={companyId} 
                  onChange={e => setCompanyId(e.target.value)} 
                />
                <button className="btn-primary" onClick={load}>تحميل</button>
              </div>
            </article>
          )}

          <article className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingId ? <Edit3 size={20} color="var(--brand-primary)" /> : <UserPlus size={20} color="var(--brand-primary)" />}
              {editingId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
            </h3>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>الاسم الكامل</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: أحمد محمد" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>رقم الهاتف (WhatsApp)</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="2010..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>الدور الوظيفي</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
                  <option value="agent">موظف دعم (Agent)</option>
                  <option value="supervisor">مشرف فريق (Supervisor)</option>
                  <option value="admin">مدير نظام (Admin)</option>
                </select>
              </div>
              {!editingId && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(6, 78, 59,0.06)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--brand-primary)', fontSize: '0.85rem', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={15} />
                  سيصل الموظف إيميل دعوة لتعيين كلمة المرور بنفسه
                </div>
              )}
              {submitResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: submitResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: submitResult.ok ? '#16a34a' : '#dc2626', fontSize: '0.85rem' }}>
                  {submitResult.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {submitResult.msg}
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button className="btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? <><Loader2 size={18} className="animate-spin" /> جاري الإرسال...</> : editingId ? 'حفظ التغييرات' : 'إنشاء الحساب'}
                </button>
                {editingId && <button className="btn-ghost" type="button" onClick={() => { setEditingId(null); setForm(initialForm); setSubmitResult(null); }}>إلغاء</button>}
              </div>
            </form>
          </article>
        </div>
      </div>
    </motion.div>
  );
}
