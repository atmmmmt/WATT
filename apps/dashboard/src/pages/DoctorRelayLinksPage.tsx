import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { can, canCreateRoutingLink, Permission } from '../lib/permissions';
import { apiRequest } from '../lib/api';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  Link2,
  Phone,
  Building2,
  XCircle,
  UserRound,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface DoctorRelayDoctor {
  _id: string;
  name: string;
  phone: string;
}

interface DoctorRelayPatient {
  _id: string;
  name: string;
  phone: string;
}

interface DoctorRelayLink {
  _id: string;
  createdByUserId?: string;
  doctorPhone: string;
  doctorName: string;
  patientPhone: string;
  patientName: string;
  patientLabel: string;
  status: 'active' | 'closed';
  lastMessage: string;
}

interface DoctorRelaySettings {
  professionalLabel: string;
  clientLabel: string;
}

const DEFAULT_SETTINGS: DoctorRelaySettings = {
  professionalLabel: 'الطبيب',
  clientLabel: 'المريض',
};

const COMPANY_ID_KEY = 'vayro-doctor-relay-company-id';

export function DoctorRelayLinksPage() {
  const { token, user } = useAuth();
  const [links, setLinks] = useState<DoctorRelayLink[]>([]);
  const [settings, setSettings] = useState<DoctorRelaySettings>(DEFAULT_SETTINGS);
  const [settingsForm, setSettingsForm] = useState<DoctorRelaySettings>(DEFAULT_SETTINGS);

  const [form, setForm] = useState({
    professionalName: '',
    professionalPhone: '',
    clientName: '',
    clientPhone: '',
  });

  const [companyId, setCompanyId] = useState(
    () => user?.tenantId || window.localStorage.getItem(COMPANY_ID_KEY) || '',
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingSettings, setSubmittingSettings] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const isSuperAdmin = user?.role === 'super_admin';
  // Same permission ids the API checks — no button is shown that the API would reject.
  const canCreate = canCreateRoutingLink(user);
  const canManage = can(user, Permission.ROUTING_LINKS_MANAGE);
  const canCloseLink = (link: DoctorRelayLink) =>
    canManage || (canCreate && String(link.createdByUserId || '') === user?.id);
  const { professionalLabel, clientLabel } = settings;

  function query() {
    return isSuperAdmin && companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  }

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [linksData, settingsData] = await Promise.all([
        apiRequest<DoctorRelayLink[]>(`/api/doctor-relay/links${query()}`, {}, token),
        apiRequest<DoctorRelaySettings>(`/api/doctor-relay/settings${query()}`, {}, token),
      ]);
      setLinks(linksData);
      setSettings(settingsData);
      setSettingsForm(settingsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmittingSettings(true);
    setResult(null);
    try {
      const updated = await apiRequest<DoctorRelaySettings>(
        `/api/doctor-relay/settings${query()}`,
        { method: 'PATCH', body: JSON.stringify(settingsForm) },
        token,
      );
      setSettings(updated);
      setResult({ ok: true, msg: 'تم تحديث المسميات' });
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'حدث خطأ' });
    } finally {
      setSubmittingSettings(false);
    }
  }

  async function createLink(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setResult(null);
    try {
      const companyPayload = isSuperAdmin ? { companyId } : {};

      const doctor = await apiRequest<DoctorRelayDoctor>(
        '/api/doctor-relay/doctors',
        { method: 'POST', body: JSON.stringify({ name: form.professionalName, phone: form.professionalPhone, ...companyPayload }) },
        token,
      );
      const patient = await apiRequest<DoctorRelayPatient>(
        '/api/doctor-relay/patients',
        { method: 'POST', body: JSON.stringify({ name: form.clientName, phone: form.clientPhone, ...companyPayload }) },
        token,
      );
      await apiRequest(
        '/api/doctor-relay/links',
        { method: 'POST', body: JSON.stringify({ doctorId: doctor._id, patientId: patient._id, ...companyPayload }) },
        token,
      );

      setResult({ ok: true, msg: 'تم الربط بنجاح، سيتم توجيه الرسائل بينهم تلقائياً' });
      setForm({ professionalName: '', professionalPhone: '', clientName: '', clientPhone: '' });
      load();
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'حدث خطأ' });
    } finally {
      setSubmitting(false);
    }
  }

  async function closeLink(id: string) {
    if (!token) return;
    if (!window.confirm('هل أنت متأكد من إغلاق هذا الربط؟')) return;
    try {
      await apiRequest(`/api/doctor-relay/links/${id}/close`, { method: 'PATCH' }, token);
      load();
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, companyId]);

  const labelStyle = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
  } as const;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-stack" dir="rtl">
      <header>
        <p className="eyebrow">توجيه واتساب</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>توجيه الخصوصية</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          اربط رقمين واتساب ببعض — أي رسالة من الطرف الأول تتوجه تلقائياً للطرف الثاني بدون كشف أي
          رقم. الرد يكون بالاقتباس (Reply) من واتساب الطرف الأول العادي.
        </p>
      </header>

      {isSuperAdmin && (
        <article className="card" style={{ borderRight: '4px solid var(--brand-primary)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} color="var(--brand-primary)" /> تبديل الشركة (Tenant)
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input placeholder="Tenant ID..." value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
            <button className="btn-primary" onClick={load}>تحميل</button>
          </div>
        </article>
      )}

      {result && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: result.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            color: result.ok ? '#16a34a' : '#dc2626',
            fontSize: '0.85rem',
          }}
        >
          {result.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {result.msg}
        </div>
      )}

      {canManage && <article className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
          مسميات الطرفين لهذا العميل
        </h3>
        <form onSubmit={saveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>اسم الطرف الأول (بدل "الطبيب")</label>
            <input
              value={settingsForm.professionalLabel}
              onChange={(e) => setSettingsForm({ ...settingsForm, professionalLabel: e.target.value })}
              placeholder="الطبيب / المهندس / المحامي..."
            />
          </div>
          <div>
            <label style={labelStyle}>اسم الطرف الثاني (بدل "المريض")</label>
            <input
              value={settingsForm.clientLabel}
              onChange={(e) => setSettingsForm({ ...settingsForm, clientLabel: e.target.value })}
              placeholder="المريض / العميل / الموكل..."
            />
          </div>
          <button className="btn-primary" disabled={submittingSettings}>
            {submittingSettings ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : 'حفظ'}
          </button>
        </form>
      </article>}

      {canCreate && <article className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link2 size={20} color="var(--brand-primary)" /> ربط رقمين جدد
        </h3>
        <form onSubmit={createLink} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{professionalLabel}</div>
            <div>
              <label style={labelStyle}>الاسم</label>
              <input
                value={form.professionalName}
                onChange={(e) => setForm({ ...form, professionalName: e.target.value })}
                placeholder={`اسم ${professionalLabel}`}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>رقم الواتساب</label>
              <input
                value={form.professionalPhone}
                onChange={(e) => setForm({ ...form, professionalPhone: e.target.value })}
                placeholder="9665xxxxxxxx"
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{clientLabel}</div>
            <div>
              <label style={labelStyle}>الاسم</label>
              <input
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                placeholder={`اسم ${clientLabel}`}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>رقم الواتساب</label>
              <input
                value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                placeholder="9665xxxxxxxx"
                required
              />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn-primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? <><Loader2 size={18} className="animate-spin" /> جاري الربط...</> : 'إنشاء الربط'}
            </button>
          </div>
        </form>
      </article>}

      <article className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>الروابط النشطة ({links.length})</h3>
          {loading && (
            <div
              className="animate-spin"
              style={{ width: '20px', height: '20px', border: '2px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {links.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              لا توجد روابط بعد
            </div>
          )}
          {links.map((link) => {
            const isActive = link.status === 'active';
            const party = (opts: {
              icon: ReactNode;
              role: string;
              name: string;
              phone: string;
              tint: string;
            }) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 40, height: 40, flexShrink: 0,
                    borderRadius: 'var(--radius-md)',
                    background: opts.tint,
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {opts.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{opts.role}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opts.name || 'بدون اسم'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={10} />
                    <bdi style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{opts.phone}</bdi>
                  </div>
                </div>
              </div>
            );

            return (
              <div
                key={link._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid var(--border-soft)',
                  opacity: isActive ? 1 : 0.55,
                }}
              >
                {/* The linked pair */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  {party({
                    icon: <Stethoscope size={18} />,
                    role: professionalLabel,
                    name: link.doctorName,
                    phone: link.doctorPhone,
                    tint: 'var(--brand-primary)',
                  })}

                  <div style={{ flexShrink: 0, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Link2 size={18} />
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, marginTop: 2 }}>{link.patientLabel}</div>
                  </div>

                  {party({
                    icon: <UserRound size={18} />,
                    role: clientLabel,
                    name: link.patientName,
                    phone: link.patientPhone,
                    tint: '#0ea5e9',
                  })}
                </div>

                {/* Status + disconnect */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <span
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      fontSize: '0.72rem', fontWeight: 700,
                      padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-full)',
                      background: isActive ? 'rgba(34,197,94,0.12)' : 'var(--bg-main)',
                      color: isActive ? '#16a34a' : 'var(--text-muted)',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#16a34a' : 'var(--text-muted)' }} />
                    {isActive ? 'نشط' : 'مفصول'}
                  </span>

                  {isActive && canCloseLink(link) && (
                    <button
                      onClick={() => closeLink(link._id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.8rem', borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(220,38,38,0.25)', background: 'transparent',
                        color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                      }}
                    >
                      <XCircle size={15} /> فصل الربط
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </motion.div>
  );
}
