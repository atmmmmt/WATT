import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
  Briefcase, Users, FileText, UserCheck, Wifi, WifiOff, Loader,
  QrCode, Unplug, RefreshCw, TrendingUp, CheckCircle, AlertCircle,
  Clock, ChevronRight,
} from 'lucide-react';

function withTenant(path: string, tenantId: string) {
  return tenantId ? `${path}?tenantId=${encodeURIComponent(tenantId)}` : path;
}

const LIVE_STATUSES = ['initializing', 'qr_ready', 'authenticated'];

const stageConfig: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'جديد',          color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  contacted: { label: 'تم التواصل',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  interview: { label: 'مقابلة',        color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  offer:     { label: 'عرض عمل',       color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  accepted:  { label: 'مقبول',         color: '#059669', bg: 'rgba(5,150,105,0.1)'  },
  rejected:  { label: 'مرفوض',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

function statusHelp(status?: string) {
  switch (status) {
    case 'initializing': return 'جاري تجهيز جلسة واتساب. انتظر 10–30 ثانية...';
    case 'qr_ready':     return 'امسح QR من واتساب: الأجهزة المرتبطة ← ربط جهاز.';
    case 'authenticated':return 'تم المسح. ننتظر اكتمال الاتصال...';
    case 'ready':        return 'واتساب متصل وجاهز لإرسال رسائل المرشحين.';
    case 'auth_failure': return 'فشل الربط. قطع الاتصال وابدأ QR من جديد.';
    case 'disconnected': return 'واتساب غير متصل. اضغط بدء QR.';
    default:             return 'اضغط بدء QR لتجهيز رمز الربط.';
  }
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-soft)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-md)',
        background: accent ? `${accent}18` : 'var(--brand-primary-soft)',
        color: accent || 'var(--brand-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{value}</div>
      </div>
    </motion.div>
  );
}

export function HrOverviewPage() {
  const { token, user } = useAuth();
  const [tenantId, setTenantId] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function load(silent = false) {
    if (!token) return;
    if (!silent) { setLoading(true); setError(''); }
    try {
      const [ov, sess] = await Promise.all([
        apiRequest<any>(withTenant('/hr/overview', tenantId), {}, token),
        apiRequest<any>(`/whatsapp-sessions/${tenantId || user?.tenantId || 'current'}`, {}, token).catch(() => null),
      ]);
      setOverview(ov);
      setSession(sess);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل البيانات');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function startQr() {
    setActionLoading(true);
    try {
      const s = await apiRequest<any>('/whatsapp-sessions/start', { method: 'POST', body: JSON.stringify(tenantId ? { tenantId } : {}) }, token);
      setSession(s);
    } finally {
      setActionLoading(false);
      load(true);
    }
  }

  async function disconnectQr() {
    setActionLoading(true);
    try {
      const s = await apiRequest<any>('/whatsapp-sessions/disconnect', { method: 'POST', body: JSON.stringify(tenantId ? { tenantId } : {}) }, token);
      setSession(s);
    } finally {
      setActionLoading(false);
      load(true);
    }
  }

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (!token || !LIVE_STATUSES.includes(session?.status || '')) return;
    const t = setInterval(() => load(true), 2500);
    return () => clearInterval(t);
  }, [token, tenantId, session?.status]);

  const summary = overview?.summary || {};
  const stages: any[] = overview?.stages || [];
  const sessionStatus: string = session?.status || 'idle';
  const isConnected = sessionStatus === 'ready';
  const isLive = LIVE_STATUSES.includes(sessionStatus);

  const totalApps = stages.reduce((s: number, st: any) => s + (st.count || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)', background: 'var(--brand-primary-soft)', padding: '0.2rem 0.75rem', borderRadius: 'var(--radius-full)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HR Hub</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>باقة التوظيف الذكي</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>إدارة الوظائف والمرشحين وربط واتساب الشركة من مكان واحد.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'super_admin' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={tenantId}
                onChange={e => setTenantId(e.target.value)}
                placeholder="Tenant ID..."
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', width: 200 }}
              />
              <button onClick={() => load()} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>تحميل</button>
            </div>
          )}
          <button
            onClick={() => load()}
            disabled={loading}
            style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', color: '#dc2626', fontSize: '0.9rem' }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <KpiCard icon={<Briefcase size={22} />} label="الوظائف المفتوحة" value={summary.openJobs ?? 0} />
        <KpiCard icon={<FileText size={22} />} label="طلبات التقديم" value={summary.applications ?? 0} accent="#10B981" />
        <KpiCard icon={<Users size={22} />} label="المرشحون" value={summary.candidates ?? 0} accent="#f59e0b" />
        <KpiCard icon={<UserCheck size={22} />} label="الموظفون" value={summary.employees ?? 0} accent="#10b981" />
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* WhatsApp Card */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>ربط واتساب الشركة</h2>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700,
              background: isConnected ? 'rgba(16,185,129,0.1)' : isLive ? 'rgba(245,158,11,0.1)' : 'rgba(156,163,175,0.1)',
              color: isConnected ? '#10b981' : isLive ? '#f59e0b' : '#9ca3af',
            }}>
              {isConnected ? <Wifi size={12} /> : isLive ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <WifiOff size={12} />}
              {sessionStatus}
            </span>
          </div>

          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
            {session?.qrDataUrl ? (
              <div style={{ padding: '1rem', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)' }}>
                <img src={session.qrDataUrl} alt="QR" style={{ width: 200, height: 200, display: 'block' }} />
              </div>
            ) : (
              <div style={{
                width: 200, height: 200, borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-main)', border: '2px dashed var(--border-medium)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                color: 'var(--text-muted)',
              }}>
                <QrCode size={48} strokeWidth={1} />
                <span style={{ fontSize: '0.75rem', textAlign: 'center', padding: '0 1rem' }}>{statusHelp(sessionStatus)}</span>
              </div>
            )}

            {session?.qrDataUrl && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>{statusHelp(sessionStatus)}</p>
            )}

            {session?.lastDisconnectReason && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: '#dc2626', width: '100%', textAlign: 'center' }}>
                آخر قطع: {session.lastDisconnectReason}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={startQr}
                disabled={isLive || actionLoading}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-md)', border: 'none',
                  background: isLive || actionLoading ? 'var(--border-medium)' : 'var(--brand-primary)',
                  color: isLive || actionLoading ? 'var(--text-muted)' : '#fff',
                  cursor: isLive || actionLoading ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                {isLive ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> جاري التجهيز...</> : <><QrCode size={14} /> بدء QR</>}
              </button>
              <button
                onClick={disconnectQr}
                disabled={actionLoading}
                style={{
                  padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)', background: 'transparent',
                  cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Unplug size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Candidate Stages */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>مراحل المرشحين</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>توزيع {totalApps} طلب على مراحل التوظيف</p>
            </div>
            <TrendingUp size={20} color="var(--brand-primary)" />
          </div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Users size={40} strokeWidth={1} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                <p style={{ fontSize: '0.9rem' }}>لا توجد طلبات بعد</p>
              </div>
            ) : stages.map((st: any) => {
              const cfg = stageConfig[st.stage] || { label: st.stage, color: '#064E3B', bg: 'rgba(6, 78, 59,0.1)' };
              const pct = totalApps > 0 ? Math.round((st.count / totalApps) * 100) : 0;
              return (
                <div key={st.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pct}%</span>
                      <span style={{ fontWeight: 700, color: cfg.color, fontSize: '0.9rem' }}>{st.count}</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--border-soft)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick action */}
          {isConnected && (
            <div style={{ margin: '0 1.5rem 1.5rem', padding: '1rem 1.25rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle size={18} color="#10b981" />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981' }}>واتساب متصل</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>يمكنك الآن إرسال رسائل للمرشحين عبر صندوق الوارد.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
