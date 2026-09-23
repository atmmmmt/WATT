import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { createSupportSocket } from '../lib/support-socket';
import { motion, AnimatePresence } from 'framer-motion';

// ── Module-level session cache (persists across navigations) ──────────────────
interface SessionCache { data: any; fetchedAt: number; tenantId: string; }
let _sessionCache: SessionCache | null = null;
const CACHE_TTL_MS = 30_000; // 30 ثانية — يجدد بالخلفية تلقائياً

function getCached(tenantId: string): any | null {
  if (!_sessionCache || _sessionCache.tenantId !== tenantId) return null;
  if (Date.now() - _sessionCache.fetchedAt > CACHE_TTL_MS) return null;
  return _sessionCache.data;
}
function setCached(tenantId: string, data: any) {
  _sessionCache = { data, fetchedAt: Date.now(), tenantId };
}
// ─────────────────────────────────────────────────────────────────────────────
import { 
  Smartphone, 
  QrCode, 
  ShieldCheck, 
  Link, 
  RefreshCw, 
  XCircle, 
  CheckCircle2, 
  Info, 
  HelpCircle,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';

function sessionStatusLabel(status?: string) {
  switch (status) {
    case 'qr_ready': return 'QR Ready';
    case 'authenticated': return 'Authenticated';
    case 'ready': return 'Connected';
    case 'disconnected': return 'Disconnected';
    case 'auth_failure': return 'Auth Failure';
    case 'initializing': return 'Initializing';
    default: return 'Waiting';
  }
}

function statusColor(status?: string) {
  if (status === 'ready') return 'var(--status-success)';
  if (status === 'disconnected' || status === 'auth_failure') return 'var(--status-error)';
  if (status === 'qr_ready' || status === 'initializing') return 'var(--brand-primary)';
  return 'var(--text-muted)';
}

function statusBg(status?: string) {
  if (status === 'ready') return 'rgba(16, 185, 129, 0.1)';
  if (status === 'disconnected' || status === 'auth_failure') return 'rgba(239, 68, 68, 0.1)';
  if (status === 'qr_ready' || status === 'initializing') return 'rgba(6, 78, 59, 0.1)';
  return 'rgba(0, 0, 0, 0.05)';
}

export function SupportConnectionPage() {
  const { token, user } = useAuth();
  const tenantId = user?.tenantId ?? '';

  // استخدم الـ cache كقيمة ابتدائية — لا loading إذا الكاش موجود
  const [session, setSession] = useState<any>(() => getCached(tenantId));
  const [loading, setLoading] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load(quiet = true) {
    if (!token || !tenantId) return;
    // إذا في كاش صالح وهو تحديث صامت → جدد بالخلفية بدون spinner
    const cached = getCached(tenantId);
    if (cached && quiet) {
      setBackgroundRefreshing(true);
      try {
        const data = await apiRequest<any>(`/whatsapp-sessions/${tenantId}`, {}, token);
        setCached(tenantId, data);
        setSession(data);
      } catch { /* تجاهل أخطاء التحديث الخلفي */ } finally {
        setBackgroundRefreshing(false);
      }
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const data = await apiRequest<any>(`/whatsapp-sessions/${tenantId}`, {}, token);
      setCached(tenantId, data);
      setSession(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function syncHistory() {
    if (!token || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiRequest<any>('/api/support/sync-history', { method: 'POST' }, token);
      setSyncResult(result);
    } catch (err: any) {
      setError('فشلت المزامنة: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  function updateSession(data: any) {
    setCached(tenantId, data);
    setSession(data);
  }

  async function startQr() {
    if (!token) return;
    try {
      setLoading(true);
      console.log('[WA] Calling /whatsapp-sessions/start ...');
      const data = await apiRequest<any>('/whatsapp-sessions/start', { method: 'POST' }, token);
      console.log('[WA] startQr response:', data);
      updateSession(data);
    } catch (err: any) {
      console.error('[WA] startQr error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    if (!token) return;
    try {
      setLoading(true);
      console.log('[WA] Calling /whatsapp-sessions/disconnect ...');
      const data = await apiRequest<any>('/whatsapp-sessions/disconnect', { method: 'POST' }, token);
      console.log('[WA] disconnect response:', data);
      updateSession(data);
    } catch (err: any) {
      console.error('[WA] disconnect error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    console.log('[WA] session state:', session);
  }, [session]);

  useEffect(() => { load(); }, [token, tenantId]);

  useEffect(() => {
    if (!token) return;
    const socket = createSupportSocket(token);
    socket.on('whatsapp:qr', (p) => updateSession(p));
    socket.on('whatsapp:connected', (p) => {
      updateSession(p);
      // Auto-sync history when WhatsApp connects
      setTimeout(() => syncHistory(), 3000);
    });
    socket.on('whatsapp:disconnected', (p) => updateSession(p));
    return () => { socket.disconnect(); };
  }, [token]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-stack"
      dir="rtl"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <p className="eyebrow">جهاز الاتصال</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>ربط واتساب الشركة</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {backgroundRefreshing && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <RefreshCw size={12} className="animate-spin" />
              يجدد...
            </span>
          )}
          <button className="btn-secondary" onClick={() => load(false)} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            تحديث الحالة
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        <article className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem' }}>
          <div style={{ 
            padding: '0.5rem 1.25rem', 
            borderRadius: 'var(--radius-full)', 
            background: statusBg(session?.status), 
            color: statusColor(session?.status),
            fontWeight: 700,
            fontSize: '0.8rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {session?.status === 'ready' ? <Wifi size={16} /> : <WifiOff size={16} />}
            {sessionStatusLabel(session?.status)}
          </div>

          <AnimatePresence mode="wait">
            {session?.qrDataUrl ? (
              <motion.div 
                key="qr"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', marginBottom: '2rem' }}
              >
                <img src={session.qrDataUrl} alt="QR" style={{ width: '240px', height: '240px' }} />
              </motion.div>
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ width: '240px', height: '240px', background: 'var(--bg-main)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border-medium)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', color: 'var(--text-muted)' }}
              >
                {session?.status === 'ready' ? (
                  <CheckCircle2 size={64} color="var(--status-success)" />
                ) : (
                  <QrCode size={64} strokeWidth={1} />
                )}
                <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  {session?.status === 'ready' ? 'الرقم متصل حالياً' : 'بانتظار رمز QR'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {session?.status === 'ready' ? `متصل: ${session.phoneNumber}` : 'ربط جهاز جديد'}
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', marginBottom: '2rem', fontSize: '0.95rem' }}>
            {session?.status === 'ready' 
              ? 'الجهاز متصل ويعمل بكفاءة. يمكنك استقبال وإرسال الرسائل الآن.' 
              : 'افتح واتساب على هاتفك > الأجهزة المرتبطة > ربط جهاز، ثم امسح الرمز أعلاه.'}
          </p>

          <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['initializing', 'qr_ready', 'authenticated'].includes(session?.status) ? (
              <button className="btn-primary" disabled style={{ padding: '0.75rem 2.5rem', opacity: 0.6 }}>
                <RefreshCw size={16} className="animate-spin" /> جاري التحميل...
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={startQr}
                disabled={loading}
                style={{ padding: '0.75rem 2.5rem' }}
              >
                {loading ? <><RefreshCw size={16} className="animate-spin" /> جاري...</> : 'بدء جلسة ربط'}
              </button>
            )}
            {/* زر قطع الاتصال يظهر دائماً ما عدا لما ما في جلسة أصلاً */}
            {session?.status && session.status !== 'idle' && (
              <button className="btn-ghost" onClick={disconnect} disabled={loading} style={{ color: 'var(--status-error)' }}>
                <XCircle size={18} /> قطع الاتصال
              </button>
            )}
          </div>

          {session?.status === 'ready' && (
            <div style={{ width: '100%', marginTop: '1.5rem', borderTop: '1px solid var(--border-soft)', paddingTop: '1.5rem' }}>
              <button
                className="btn-primary"
                onClick={syncHistory}
                disabled={syncing}
                style={{ width: '100%', justifyContent: 'center', background: '#10b981', fontSize: '1rem', padding: '0.85rem' }}
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'جاري مزامنة المحادثات...' : 'مزامنة المحادثات الآن'}
              </button>
              {syncResult && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.9rem', color: '#065f46', textAlign: 'center' }}>
                  ✅ تمت المزامنة — {syncResult.importedConversations} محادثة جديدة، {syncResult.importedMessages} رسالة من أصل {syncResult.scannedChats} محادثة
                </div>
              )}
              <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                يجلب آخر 100 محادثة من هاتفك ويضيفها لصندوق الوارد
              </p>
            </div>
          )}
        </article>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <article className="card" style={{ background: 'var(--brand-primary)', color: 'white' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '10px' }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>اتصال آمن ومستقر</h4>
                <p style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                  يتم تشفير جميع المحادثات والبيانات. نحن نستخدم تقنية ربط الأجهزة الرسمية لضمان استمرارية الخدمة.
                </p>
              </div>
            </div>
          </article>

          <article className="card">
            <h4 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} color="var(--brand-primary)" />
              كيف يعمل الربط؟
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>1</div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>امسح الرمز</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>استخدم هاتفك لمسح الرمز الظاهر أمامك.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>2</div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>انتظر المزامنة</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>سيقوم النظام بمزامنة المحادثات السابقة تلقائياً.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>3</div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>ابدأ الدعم</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>يمكن لفريقك الآن الرد على العملاء من لوحة التحكم.</p>
                </div>
              </div>
            </div>
          </article>

          <article className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Clock size={18} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem' }}>آخر مزامنة</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>قبل 5 دقائق</span>
          </article>
        </div>
      </div>
    </motion.div>
  );
}
