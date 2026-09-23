import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Briefcase,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  DollarSign,
  FileText,
  History as LucideHistory,
  Key,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  TrendingUp,
  Users,
  Wifi,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { exportFinanceReportPdf } from '../lib/export-finance-report-pdf';
import { useNavigate } from 'react-router-dom';

const PIE_COLORS = ['#064E3B', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#10B981'];

type WorkspacePayload = {
  summary: {
    totalRevenue: number;
    salesCount: number;
    activeSubscriptions: number;
    tenants: number;
    otpThisMonth: number;
    apiKeys: number;
  };
  charts: {
    revenue: Array<{ label: string; revenue: number; sales: number }>;
    plans: Array<{ plan: string; count: number; revenue: number }>;
    otp: Array<{ label: string; sent: number; verified: number }>;
    otpStatuses: Array<{ status: string; count: number }>;
  };
  workflow: {
    tenants: Array<{
      _id: string;
      name: string;
      slug: string;
      createdAt?: string;
      subscription?: {
        planName: string;
        price: number;
        currency: string;
        endsAt: string;
      } | null;
      provider?: {
        providerType: string;
        status: string;
      } | null;
      whatsappSession?: {
        status: string;
        phoneNumber: string | null;
        displayName: string | null;
        lastReadyAt: string | null;
      } | null;
    }>;
    recentOtpLogs: Array<{
      _id: string;
      phoneNumber: string;
      purpose: string;
      status: string;
      createdAt: string;
    }>;
  };
};

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function percentage(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function growthRate(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function formatTrend(current: number, previous: number, suffix: string) {
  if (!previous && !current) {
    return `لا توجد بيانات ${suffix}`;
  }

  if (!previous && current > 0) {
    return `بدأت البيانات هذا ${suffix}`;
  }

  const rate = growthRate(current, previous);
  const direction = rate >= 0 ? 'ارتفاع' : 'انخفاض';
  return `${direction} ${percentage(Math.abs(rate))} عن ${suffix}`;
}

function statusLabel(status: string) {
  switch (status) {
    case 'verified':
      return 'تم التحقق';
    case 'sent':
      return 'أُرسل';
    case 'failed':
      return 'فشل';
    case 'expired':
      return 'انتهت الصلاحية';
    case 'locked':
      return 'مقفول';
    case 'pending':
      return 'قيد المعالجة';
    case 'superseded':
      return 'تم استبداله';
    default:
      return status;
  }
}

function sessionStatusLabel(status: string) {
  switch (status) {
    case 'ready':
      return 'جاهز';
    case 'qr_ready':
      return 'بانتظار المسح';
    case 'authenticated':
      return 'تمت المصادقة';
    case 'initializing':
      return 'جارٍ الإعداد';
    case 'auth_failure':
      return 'فشل التوثيق';
    case 'disconnected':
      return 'غير متصل';
    default:
      return status || 'غير متصل';
  }
}

export function DashboardPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  async function loadWorkspace() {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const payload = await apiRequest<WorkspacePayload>(
        '/dashboard/workspace',
        {},
        token,
      );
      setWorkspace(payload);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [token]);

  const metrics = useMemo(() => {
    const tenants = workspace?.workflow?.tenants || [];
    const revenueSeries = workspace?.charts?.revenue || [];
    const otpSeries = workspace?.charts?.otp || [];
    const otpStatuses = workspace?.charts?.otpStatuses || [];
    const totalRevenue = Number(workspace?.summary?.totalRevenue || 0);
    const salesCount = Number(workspace?.summary?.salesCount || 0);
    const activeSubscriptions = Number(
      workspace?.summary?.activeSubscriptions || 0,
    );
    const apiKeys = Number(workspace?.summary?.apiKeys || 0);
    const otpThisMonth = Number(workspace?.summary?.otpThisMonth || 0);

    const activeClients = tenants.filter((tenant) => Boolean(tenant.subscription)).length;
    const whatsappWebTenants = tenants.filter(
      (tenant) => tenant.provider?.providerType === 'whatsapp_web',
    );
    const readySessions = whatsappWebTenants.filter(
      (tenant) => tenant.whatsappSession?.status === 'ready',
    ).length;
    const waitingQrSessions = whatsappWebTenants.filter(
      (tenant) => tenant.whatsappSession?.status === 'qr_ready',
    ).length;
    const disconnectedSessions = whatsappWebTenants.filter((tenant) =>
      ['disconnected', 'auth_failure'].includes(tenant.whatsappSession?.status || ''),
    ).length;

    const totalOtpRequests = otpStatuses.reduce(
      (sum, item) => sum + Number(item.count || 0),
      0,
    );
    const verifiedOtpRequests =
      otpStatuses.find((item) => item.status === 'verified')?.count || 0;
    const failedOtpRequests =
      otpStatuses.find((item) => item.status === 'failed')?.count || 0;
    const otpVerificationRate = totalOtpRequests
      ? (verifiedOtpRequests / totalOtpRequests) * 100
      : 0;

    const latestRevenue = revenueSeries[revenueSeries.length - 1]?.revenue || 0;
    const previousRevenue = revenueSeries[revenueSeries.length - 2]?.revenue || 0;
    const latestOtpVolume = otpSeries[otpSeries.length - 1]?.sent || 0;
    const previousOtpVolume = otpSeries[otpSeries.length - 2]?.sent || 0;

    return {
      totalRevenue,
      salesCount,
      activeSubscriptions,
      apiKeys,
      otpThisMonth,
      activeClients,
      whatsappWebTenants: whatsappWebTenants.length,
      readySessions,
      waitingQrSessions,
      disconnectedSessions,
      totalOtpRequests,
      verifiedOtpRequests,
      failedOtpRequests,
      otpVerificationRate,
      averageSaleValue: salesCount ? totalRevenue / salesCount : 0,
      revenueTrend: formatTrend(latestRevenue, previousRevenue, 'الشهر السابق'),
      otpTrend: formatTrend(latestOtpVolume, previousOtpVolume, 'الشهر السابق'),
      revenueSeries,
      otpStatuses,
      latestTenantId: tenants[0]?._id || null,
    };
  }, [workspace]);

  const kpis = useMemo(
    () => [
      {
        label: 'إجمالي الإيرادات المسجلة',
        value: money(metrics.totalRevenue),
        icon: <DollarSign />,
        detail: metrics.revenueTrend,
        color: '#064E3B',
      },
      {
        label: 'الاشتراكات النشطة',
        value: metrics.activeSubscriptions,
        icon: <Users />,
        detail: `${metrics.activeClients} عميل لديهم اشتراك فعّال الآن`,
        color: '#10b981',
      },
      {
        label: 'طلبات OTP هذا الشهر',
        value: metrics.otpThisMonth,
        icon: <MessageSquare />,
        detail: metrics.otpTrend,
        color: '#3b82f6',
      },
      {
        label: 'نسبة التحقق من OTP',
        value: percentage(metrics.otpVerificationRate),
        icon: <CheckCircle />,
        detail: `تم التحقق من ${metrics.verifiedOtpRequests} من أصل ${metrics.totalOtpRequests}`,
        color: '#f59e0b',
      },
    ],
    [metrics],
  );

  const otpStatusChart = useMemo(
    () =>
      (metrics.otpStatuses || []).map((item) => ({
        ...item,
        label: statusLabel(item.status),
      })),
    [metrics.otpStatuses],
  );

  const quickExportFinanceReport = () => {
    exportFinanceReportPdf({
      monthName: new Date().toLocaleString('ar-SY', { month: 'long' }),
      year: String(new Date().getFullYear()),
      totalRevenue: metrics.totalRevenue,
      totalWithdrawals: 0,
      netProfit: metrics.totalRevenue,
      transactions: [],
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-stack"
      dir="rtl"
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2rem',
          background: '#064E3B',
          borderRadius: 'var(--radius-xl)',
          color: 'white',
          boxShadow: '0 20px 40px rgba(6, 78, 59, 0.15)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            لوحة المؤشرات الرئيسية
          </h1>
          <p style={{ opacity: 0.9, fontSize: '1rem' }}>
            الأرقام الظاهرة هنا تُسحب الآن من البيانات الفعلية: العملاء،
            الاشتراكات، مفاتيح API، وسجل OTP.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn-secondary"
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
            }}
            onClick={loadWorkspace}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> تحديث
            البيانات
          </button>
          <button
            className="btn-primary"
            style={{ background: 'white', color: 'var(--brand-primary)' }}
            onClick={() => navigate('/tenants')}
          >
            <Plus size={20} /> إضافة عميل جديد
          </button>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.08 }}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem',
                }}
              >
                {kpi.label}
              </p>
              <h3 style={{ fontSize: '1.85rem', fontWeight: 800 }}>{kpi.value}</h3>
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                {kpi.detail}
              </div>
            </div>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: `${kpi.color}15`,
                color: kpi.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {kpi.icon}
            </div>
          </motion.div>
        ))}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1.4fr 1.1fr',
          gap: '1.5rem',
        }}
      >
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            ملخص المبيعات والتشغيل
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                padding: '1rem 1.1rem',
                background: '#f0fdf4',
                borderRadius: '16px',
                border: '1px solid #dcfce7',
              }}
            >
              <p style={{ fontSize: '0.8rem', color: '#166534', marginBottom: '0.35rem' }}>
                متوسط قيمة الاشتراك
              </p>
              <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>
                {money(metrics.averageSaleValue)}
              </h4>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--bg-main)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  مفاتيح API
                </p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{metrics.apiKeys}</h4>
              </div>
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--bg-main)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  عمليات البيع
                </p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{metrics.salesCount}</h4>
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                background: 'var(--bg-main)',
                borderRadius: '16px',
                border: '1px solid var(--border-soft)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.65rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  مزودات واتساب مباشر
                </span>
                <span className="badge badge-success">{metrics.whatsappWebTenants}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  الجلسات الجاهزة
                </span>
                <span className="badge badge-success">{metrics.readySessions}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                تطور الإيرادات الفعلية
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                يعتمد هذا الرسم على الاشتراكات المسجلة فقط.
              </p>
            </div>
            <span className="badge badge-success">{metrics.revenueTrend}</span>
          </div>
          <div style={{ height: '300px' }}>
            {metrics.revenueSeries.length ? (
              <ResponsiveContainer>
                <AreaChart data={metrics.revenueSeries}>
                  <defs>
                    <linearGradient id="dashboardRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border-soft)"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--brand-primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dashboardRevenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                لا توجد بيانات إيرادات بعد.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                أكثر الباقات مبيعاً
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                من واقع الاشتراكات الموجودة في قاعدة البيانات.
              </p>
            </div>
            <BarChart3 size={18} color="var(--brand-primary)" />
          </div>
          <div style={{ height: '300px' }}>
            {workspace?.charts?.plans?.length ? (
              <ResponsiveContainer>
                <BarChart data={workspace.charts.plans}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border-soft)"
                  />
                  <XAxis
                    dataKey="plan"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="var(--brand-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                لا توجد باقات مباعة بعد.
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1.5rem',
        }}
      >
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <Briefcase size={20} color="var(--brand-primary)" />
            <h4 style={{ fontWeight: 700 }}>أحدث العملاء المفعّلين</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(workspace?.workflow?.tenants || []).slice(0, 5).map((tenant) => (
              <div
                key={tenant._id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 0.95rem',
                  borderRadius: '14px',
                  border: '1px solid var(--border-soft)',
                  background: 'var(--bg-main)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{tenant.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {tenant.subscription?.planName || 'بدون اشتراك نشط'}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="badge badge-success">
                    {tenant.whatsappSession?.status
                      ? sessionStatusLabel(tenant.whatsappSession.status)
                      : 'بدون جلسة'}
                  </div>
                </div>
              </div>
            ))}
            {!workspace?.workflow?.tenants?.length && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                لا يوجد عملاء بعد.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <Activity size={20} color="#3b82f6" />
            <h4 style={{ fontWeight: 700 }}>توزيع حالات OTP</h4>
          </div>
          <div style={{ height: '260px' }}>
            {otpStatusChart.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={otpStatusChart}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {otpStatusChart.map((entry, index) => (
                      <Cell
                        key={`${entry.status}-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                لا يوجد سجل OTP بعد.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {otpStatusChart.map((item, index) => (
              <div
                key={item.status}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: PIE_COLORS[index % PIE_COLORS.length],
                    }}
                  />
                  <span>{item.label}</span>
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <Wifi size={20} color="#10b981" />
            <h4 style={{ fontWeight: 700 }}>حالة الربط والبنية</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                padding: '1rem',
                borderRadius: '14px',
                border: '1px solid #dcfce7',
                background: '#f0fdf4',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                }}
              >
                <span>الجلسات الجاهزة</span>
                <strong>{metrics.readySessions}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#166534' }}>
                من أصل {metrics.whatsappWebTenants} عميل يعتمدون على واتساب مباشر.
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '14px',
                border: '1px solid #fef3c7',
                background: '#fffbeb',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                }}
              >
                <span>بانتظار مسح QR</span>
                <strong>{metrics.waitingQrSessions}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
                هذه الحسابات لن ترسل OTP حتى يتم المسح.
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '14px',
                border: '1px solid #fee2e2',
                background: '#fef2f2',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                }}
              >
                <span>جلسات تحتاج مراجعة</span>
                <strong>{metrics.disconnectedSessions}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#991b1b' }}>
                غير متصلة أو فشل توثيقها.
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '14px',
                border: '1px solid var(--border-soft)',
                background: 'var(--bg-main)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                }}
              >
                <span>الطلبات الفاشلة</span>
                <strong>{metrics.failedOtpRequests}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                العدد محسوب من سجل OTP الفعلي.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>إجراءات سريعة</h3>
          <button
            className="btn-ghost"
            style={{ fontSize: '0.9rem', color: 'var(--brand-primary)' }}
            onClick={() => navigate('/tenants')}
          >
            إدارة العملاء والاشتراكات <ChevronLeft size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
            gap: '1px',
            background: 'var(--border-soft)',
          }}
        >
          <button
            className="btn-secondary"
            style={{ borderRadius: 0, padding: '1.25rem', justifyContent: 'space-between', background: 'var(--bg-card)' }}
            onClick={quickExportFinanceReport}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileText size={18} /> تصدير تقرير الإيرادات
            </span>
            <ChevronLeft size={16} />
          </button>

          <button
            className="btn-secondary"
            style={{ borderRadius: 0, padding: '1.25rem', justifyContent: 'space-between', background: 'var(--bg-card)' }}
            onClick={() => setShowTestModal(true)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Smartphone size={18} /> اختبار إرسال OTP
            </span>
            <ChevronLeft size={16} />
          </button>

          <button
            className="btn-secondary"
            style={{ borderRadius: 0, padding: '1.25rem', justifyContent: 'space-between', background: 'var(--bg-card)' }}
            onClick={() => navigate('/otp-logs')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Key size={18} /> مراجعة سجل OTP
            </span>
            <ChevronLeft size={16} />
          </button>

          <button
            className="btn-secondary"
            style={{ borderRadius: 0, padding: '1.25rem', justifyContent: 'space-between', background: 'var(--bg-card)' }}
            onClick={() => navigate('/tenants')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Users size={18} /> إضافة عميل جديد
            </span>
            <ChevronLeft size={16} />
          </button>

          <button
            className="btn-secondary"
            style={{ borderRadius: 0, padding: '1.25rem', justifyContent: 'space-between', background: 'var(--bg-card)' }}
            onClick={() => navigate('/finance')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CreditCard size={18} /> الإدارة المالية
            </span>
            <ChevronLeft size={16} />
          </button>
        </div>
      </section>

      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <LucideHistory size={20} color="var(--brand-primary)" />
            <h4 style={{ fontWeight: 700 }}>آخر عمليات OTP الفعلية</h4>
          </div>
          <button className="btn-ghost" style={{ fontSize: '0.85rem' }} onClick={() => navigate('/otp-logs')}>
            عرض السجل الكامل
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-soft)',
                  textAlign: 'right',
                }}
              >
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  الرقم
                </th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  الغرض
                </th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  الحالة
                </th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  التوقيت
                </th>
              </tr>
            </thead>
            <tbody>
              {(workspace?.workflow?.recentOtpLogs || []).slice(0, 8).map((log) => (
                <tr
                  key={log._id}
                  style={{ borderBottom: '1px solid var(--border-soft)' }}
                >
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{log.phoneNumber}</td>
                  <td style={{ padding: '1rem' }}>{log.purpose}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      className={`badge ${
                        log.status === 'verified'
                          ? 'badge-success'
                          : log.status === 'failed'
                            ? 'badge-danger'
                            : 'badge-warning'
                      }`}
                    >
                      {statusLabel(log.status)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {new Date(log.createdAt).toLocaleString('ar-SY')}
                  </td>
                </tr>
              ))}
              {!workspace?.workflow?.recentOtpLogs?.length && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    لا توجد عمليات OTP مسجلة حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>

      <AnimatePresence>
        {showTestModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card"
              style={{ width: '460px', padding: 0 }}
            >
              <div
                style={{
                  padding: '1.5rem',
                  background: '#064E3B',
                  color: 'white',
                  borderRadius: '20px 20px 0 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                    اختبار إرسال OTP
                  </h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    يتم الإرسال من خلال بيانات النظام الحقيقية، وليس قيمة وهمية.
                  </p>
                </div>
                <Smartphone size={28} opacity={0.8} />
              </div>

              <form
                style={{
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  const phoneNumber = String(formData.get('phone') || '').trim();
                  const tenantId = metrics.latestTenantId;

                  if (!phoneNumber) {
                    return;
                  }

                  if (!tenantId) {
                    alert('لا يوجد عميل متاح للاختبار حالياً.');
                    return;
                  }

                  setBusy('test');
                  try {
                    await apiRequest(
                      '/dashboard/test/send',
                      {
                        method: 'POST',
                        body: JSON.stringify({
                          tenantId,
                          phoneNumber,
                          purpose: 'login',
                        }),
                      },
                      token,
                    );
                    alert(`تم إرسال رسالة OTP تجريبية إلى ${phoneNumber} بنجاح.`);
                    setShowTestModal(false);
                  } catch (error: any) {
                    alert(error?.message || 'فشل إرسال رسالة OTP التجريبية.');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <div className="input-group">
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                    }}
                  >
                    رقم الهاتف مع رمز الدولة
                  </label>
                  <input
                    name="phone"
                    placeholder="+963911000000"
                    required
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                </div>

                <div
                  style={{
                    padding: '1rem',
                    background: '#fffbeb',
                    borderRadius: '12px',
                    border: '1px solid #fde68a',
                    fontSize: '0.8rem',
                    color: '#92400e',
                  }}
                >
                  سيتم الإرسال من أول عميل متاح في النظام إذا كنت داخل بحساب الإدارة
                  العامة. إذا أردت اختبار عميل محدد، افتح سجله أو لوحة تشغيله أولاً.
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled={busy === 'test'}
                  >
                    {busy === 'test' ? 'جارٍ الإرسال...' : 'إرسال رسالة تجريبية'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowTestModal(false)}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
