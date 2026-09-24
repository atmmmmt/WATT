import { useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, Database, HardDrive, MemoryStick, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type ServerMetrics = {
  generatedAt: string;
  host: {
    hostname: string;
    platform: string;
    architecture: string;
    cpuCores: number;
    uptimeSeconds: number;
    loadAverage: number[];
  };
  cpu: { percent: number };
  memory: { totalBytes: number; usedBytes: number; freeBytes: number; percent: number };
  disk: { totalBytes: number; usedBytes: number; freeBytes: number; percent: number };
  process: {
    pid: number;
    uptimeSeconds: number;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    nodeVersion: string;
  };
  health: {
    level: 'healthy' | 'warning' | 'critical';
    thresholds: { warningPercent: number; criticalPercent: number };
  };
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days} يوم ${hours} ساعة`;
  if (hours) return `${hours} ساعة ${minutes} دقيقة`;
  return `${minutes} دقيقة`;
}

function meterColor(value: number) {
  if (value >= 90) return '#ef4444';
  if (value >= 75) return '#f59e0b';
  return '#10b981';
}

function MetricCard({
  title,
  value,
  detail,
  percent,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  percent?: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="card" style={{ minHeight: 170 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{title}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{value}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>{detail}</div>
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' }}>
          {icon}
        </div>
      </div>
      {typeof percent === 'number' && (
        <div style={{ marginTop: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 6, color: 'var(--text-muted)' }}>
            <span>الاستخدام</span>
            <strong>{percent.toFixed(1)}%</strong>
          </div>
          <div style={{ height: 8, background: 'var(--border-soft)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', borderRadius: 999, background: meterColor(percent), transition: 'width 250ms ease' }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ServerStatusPage() {
  const { token, user } = useAuth();
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token || user?.role !== 'super_admin') return;
    try {
      const data = await apiRequest<ServerMetrics>('/dashboard/server/metrics', {}, token);
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة حالة السيرفر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, [token, user?.role]);

  const health = useMemo(() => {
    if (!metrics) return { label: 'جار القياس', color: '#6b7280' };
    if (metrics.health.level === 'critical') return { label: 'ضغط مرتفع جداً', color: '#ef4444' };
    if (metrics.health.level === 'warning') return { label: 'يحتاج مراقبة', color: '#f59e0b' };
    return { label: 'السيرفر بحالة جيدة', color: '#10b981' };
  }, [metrics]);

  if (user?.role !== 'super_admin') {
    return <div className="page-stack"><div className="card">هذه الصفحة متاحة لمدير المنصة فقط.</div></div>;
  }

  return (
    <div className="page-stack" dir="rtl">
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Server size={24} color="var(--brand-primary)" />
            <h1 style={{ fontSize: '1.7rem' }}>حالة السيرفر</h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>مراقبة مباشرة لموارد VAYRO. تتحدث البيانات تلقائياً كل 10 ثواني.</p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </header>

      {error && <div className="auth-alert error">{error}</div>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <MetricCard title="المعالج CPU" value={`${metrics?.cpu.percent?.toFixed(1) ?? '—'}%`} detail={`${metrics?.host.cpuCores ?? '—'} vCPU / Load ${metrics?.host.loadAverage?.[0] ?? '—'}`} percent={metrics?.cpu.percent} icon={<Cpu size={22} />} />
        <MetricCard title="الذاكرة RAM" value={metrics ? formatBytes(metrics.memory.usedBytes) : '—'} detail={metrics ? `من ${formatBytes(metrics.memory.totalBytes)} — متاح ${formatBytes(metrics.memory.freeBytes)}` : 'جار القراءة'} percent={metrics?.memory.percent} icon={<MemoryStick size={22} />} />
        <MetricCard title="التخزين" value={metrics ? formatBytes(metrics.disk.usedBytes) : '—'} detail={metrics ? `من ${formatBytes(metrics.disk.totalBytes)} — متاح ${formatBytes(metrics.disk.freeBytes)}` : 'جار القراءة'} percent={metrics?.disk.percent} icon={<HardDrive size={22} />} />
        <MetricCard title="استهلاك API" value={metrics ? formatBytes(metrics.process.rssBytes) : '—'} detail={metrics ? `Heap ${formatBytes(metrics.process.heapUsedBytes)} / ${formatBytes(metrics.process.heapTotalBytes)}` : 'جار القراءة'} icon={<Activity size={22} />} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>معلومات التشغيل</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>اسم السيرفر</span><strong style={{ display: 'block' }}>{metrics?.host.hostname || '—'}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>مدة تشغيل السيرفر</span><strong style={{ display: 'block' }}>{metrics ? formatUptime(metrics.host.uptimeSeconds) : '—'}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>مدة تشغيل API</span><strong style={{ display: 'block' }}>{metrics ? formatUptime(metrics.process.uptimeSeconds) : '—'}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Node.js</span><strong style={{ display: 'block' }}>{metrics?.process.nodeVersion || '—'}</strong></div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
            <ShieldCheck size={22} color={health.color} />
            <h3>صحة المنصة</h3>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: health.color, marginBottom: '0.6rem' }}>{health.label}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            نعتبر 75% بداية تنبيه، و90% مستوى حرج. إذا بقي RAM أو CPU فوق 75% لفترة طويلة وقتها نفكر بالترقية، مو قبل.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <Database size={16} /> آخر تحديث: {metrics?.generatedAt ? new Date(metrics.generatedAt).toLocaleTimeString('ar-SY') : '—'}
          </div>
        </div>
      </section>
    </div>
  );
}
