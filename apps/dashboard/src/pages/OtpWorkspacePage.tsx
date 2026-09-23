import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, apiRequest } from '../lib/api';

type ProviderType = 'mock' | 'whatsapp_web' | 'twilio';

interface TenantRow {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  contactEmail: string;
  subscription?: {
    planName: string;
    price: number;
    currency: string;
    endsAt: string;
    maxMonthlyOtp: number;
  } | null;
  provider?: {
    providerType: ProviderType;
    status: string;
  } | null;
  whatsappSession?: {
    status: string;
    phoneNumber?: string | null;
    displayName?: string | null;
    lastReadyAt?: string | null;
    qrDataUrl?: string | null;
  } | null;
}

interface ApiKeyRow {
  _id?: string;
  id?: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
}

function providerLabel(providerType?: string) {
  switch (providerType) {
    case 'whatsapp_web':
      return 'واتساب مباشر عبر QR';
    case 'twilio':
      return 'مزود رسمي خارجي';
    default:
      return 'وضع تجريبي';
  }
}

function sessionLabel(status?: string) {
  switch (status) {
    case 'ready':
      return 'جاهز';
    case 'qr_ready':
      return 'بانتظار المسح';
    case 'authenticated':
    case 'initializing':
      return 'جاري التجهيز';
    case 'disconnected':
      return 'مفصول';
    case 'auth_failure':
      return 'فشل اعتماد';
    default:
      return 'غير مربوط';
  }
}

export function OtpWorkspacePage() {
  const { token } = useAuth();
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [latestRawKey, setLatestRawKey] = useState('');

  async function load() {
    if (!token) return;
    const [tenants, apiKeys] = await Promise.all([
      apiRequest<TenantRow[]>('/tenants', {}, token),
      apiRequest<ApiKeyRow[]>('/api-keys', {}, token),
    ]);
    setTenant(tenants[0] || null);
    setKeys(apiKeys);
  }

  useEffect(() => {
    load().catch((error) => console.error(error));
  }, [token]);

  async function refreshSession() {
    if (!token || !tenant) return;
    setBusy('refresh');
    try {
      const session = await apiRequest<any>(
        `/whatsapp-sessions/${tenant.id || tenant._id}`,
        {},
        token,
      );
      setTenant((current) => (current ? { ...current, whatsappSession: session } : current));
    } finally {
      setBusy(null);
    }
  }

  async function startQr() {
    if (!token) return;
    setBusy('start');
    try {
      const session = await apiRequest<any>(
        '/whatsapp-sessions/start',
        { method: 'POST' },
        token,
      );
      setTenant((current) => (current ? { ...current, whatsappSession: session } : current));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!token) return;
    setBusy('disconnect');
    try {
      const session = await apiRequest<any>(
        '/whatsapp-sessions/disconnect',
        { method: 'POST' },
        token,
      );
      setTenant((current) => (current ? { ...current, whatsappSession: session } : current));
    } finally {
      setBusy(null);
    }
  }

  async function issueApiKey() {
    if (!token || !tenant) return;
    setBusy('key');
    try {
      const result = await apiRequest<any>(
        '/api-keys',
        {
          method: 'POST',
          body: JSON.stringify({
            name: `Client Key ${new Date().toISOString().slice(0, 10)}`,
            scopes: ['otp:send', 'otp:verify', 'whatsapp:session'],
          }),
        },
        token,
      );
      setLatestRawKey(result.rawKey);
      setNotice('تم إصدار API Key جديد. يظهر المفتاح الكامل مرة واحدة فقط.');
      setTimeout(() => setNotice(''), 4000);
      await load();
    } finally {
      setBusy(null);
    }
  }

  const sessionStatus = tenant?.whatsappSession?.status || 'idle';
  const docsUrl = `${API_BASE_URL.replace(/\/$/, '')}/docs`;

  const metrics = useMemo(
    () => [
      {
        label: 'الخطة الحالية',
        value: tenant?.subscription?.planName || 'غير مفعلة',
      },
      {
        label: 'مزود الإرسال',
        value: providerLabel(tenant?.provider?.providerType),
      },
      {
        label: 'حالة واتساب',
        value: sessionLabel(sessionStatus),
      },
      {
        label: 'الحصة الشهرية',
        value: String(tenant?.subscription?.maxMonthlyOtp || 0),
      },
    ],
    [tenant, sessionStatus],
  );

  function copyText(text: string, successMessage: string) {
    navigator.clipboard.writeText(text).then(() => {
      setNotice(successMessage);
      setTimeout(() => setNotice(''), 2500);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-stack"
      dir="rtl"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">بوابة العميل</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>تشغيل خدمة WhatsApp OTP</h1>
        </div>
        <button className="btn-secondary" onClick={load} disabled={busy === 'refresh'}>
          <RefreshCw size={18} className={busy === 'refresh' ? 'animate-spin' : ''} />
          تحديث البيانات
        </button>
      </header>

      {notice ? (
        <div className="card" style={{ background: '#ecfdf3', border: '1px solid #86efac', color: '#166534' }}>
          {notice}
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {metrics.map((item) => (
          <article key={item.label} className="card">
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.value}</div>
          </article>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '1.5rem' }}>
        <article className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>ربط رقم واتساب OTP</h3>
            <span
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                background: sessionStatus === 'ready' ? '#ecfdf3' : '#eff6ff',
                color: sessionStatus === 'ready' ? '#166534' : '#1d4ed8',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {sessionStatus === 'ready' ? <Wifi size={14} /> : <WifiOff size={14} />}
              {sessionLabel(sessionStatus)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '1.25rem', alignItems: 'center' }}>
            <div
              style={{
                minHeight: '240px',
                background: 'var(--bg-main)',
                border: '1px dashed var(--border-medium)',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
            >
              {tenant?.whatsappSession?.qrDataUrl ? (
                <img
                  src={tenant.whatsappSession.qrDataUrl}
                  alt="OTP QR"
                  style={{ width: '220px', height: '220px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <QrCode size={54} style={{ marginBottom: '0.75rem' }} />
                  <div>ابدأ جلسة QR ليظهر الرمز هنا</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-soft)' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>طريقة الربط الصحيحة</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  <div>1. اضغط بدء جلسة QR.</div>
                  <div>2. افتح واتساب على الهاتف المطلوب للإرسال.</div>
                  <div>3. الأجهزة المرتبطة ← ربط جهاز.</div>
                  <div>4. امسح الرمز مباشرة قبل أن يتبدل.</div>
                  <div>5. انتظر حتى تصبح الحالة "جاهز".</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={startQr} disabled={busy === 'start'}>
                  <QrCode size={18} /> {busy === 'start' ? 'جاري البدء...' : 'بدء جلسة QR'}
                </button>
                <button className="btn-secondary" onClick={refreshSession} disabled={busy === 'refresh'}>
                  <RefreshCw size={18} /> تحديث الحالة
                </button>
                <button className="btn-ghost" onClick={disconnect} disabled={busy === 'disconnect'}>
                  <Smartphone size={18} /> قطع الاتصال
                </button>
              </div>

              {tenant?.whatsappSession?.phoneNumber ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  الرقم الحالي: <span className="ltr">{tenant.whatsappSession.phoneNumber}</span>
                </div>
              ) : null}
            </div>
          </div>
        </article>

      </div>
    </motion.div>
  );
}
