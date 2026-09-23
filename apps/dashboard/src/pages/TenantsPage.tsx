import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  DollarSign,
  FileJson,
  FileText,
  Package,
  Plus,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, apiRequest } from '../lib/api';
import { exportClientPackagePdf } from '../lib/export-client-package-pdf';

type TenantProduct = 'otp' | 'support' | 'hr' | 'doctor_relay';
type ProviderType = 'mock' | 'whatsapp_web' | 'twilio';
type OtpTemplateKey = 'login' | 'register' | 'forgotPassword';

type PresetPlan = {
  id: string;
  name: string;
  price: number;
  quota: number;
  duration: number;
  products: TenantProduct[];
};

const PRESET_PLANS: PresetPlan[] = [
  {
    id: 'otp',
    name: 'خدمة واتساب OTP',
    price: 49,
    quota: 1000,
    duration: 12,
    products: ['otp'],
  },
  {
    id: 'support',
    name: 'صندوق الدعم المشترك',
    price: 149,
    quota: 5000,
    duration: 12,
    products: ['support'],
  },
  {
    id: 'hr',
    name: 'منصة التوظيف',
    price: 149,
    quota: 5000,
    duration: 12,
    products: ['hr'],
  },
  {
    id: 'doctor_relay',
    name: 'توجيه الأطباء (خصوصية)',
    price: 199,
    quota: 5000,
    duration: 12,
    products: ['doctor_relay'],
  },
  {
    id: 'support_doctor_relay',
    name: 'صندوق الدعم + توجيه الأطباء',
    price: 299,
    quota: 5000,
    duration: 12,
    products: ['support', 'doctor_relay'],
  },
  {
    id: 'all',
    name: 'الباقة الشاملة',
    price: 299,
    quota: 25000,
    duration: 12,
    products: ['otp', 'support', 'hr', 'doctor_relay'],
  },
];

const DEFAULT_OTP_TEMPLATES: Record<OtpTemplateKey, string> = {
  login:
    'رمز تسجيل الدخول الخاص بك هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  register:
    'رمز تأكيد إنشاء الحساب هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  forgotPassword:
    'رمز إعادة تعيين كلمة المرور هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
};

const OTP_TEMPLATE_LABELS: Record<OtpTemplateKey, string> = {
  login: 'رسالة تسجيل الدخول',
  register: 'رسالة تأكيد إنشاء الحساب',
  forgotPassword: 'رسالة نسيان كلمة المرور',
};

interface Tenant {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: string;
  allowedOrigins: string[];
  enabledProducts?: TenantProduct[];
  createdAt: string;
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
  } | null;
}

function buildSubscriptionEndLabel(months: number) {
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + months);
  return endsAt.toLocaleDateString('ar-SY');
}

function getConnectionStatus(tenant: Tenant) {
  switch (tenant.whatsappSession?.status) {
    case 'ready':
      return { label: 'جاهز', color: '#10b981' };
    case 'qr_ready':
      return { label: 'بانتظار QR', color: '#f59e0b' };
    case 'initializing':
    case 'authenticated':
      return { label: 'قيد الربط', color: '#3b82f6' };
    case 'disconnected':
    case 'auth_failure':
      return { label: 'منقطع', color: '#dc2626' };
    default:
      return { label: 'غير مربوط', color: 'var(--text-muted)' };
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeOtpTemplates(
  templates: Record<OtpTemplateKey, string>,
): Partial<Record<OtpTemplateKey, string>> {
  return (Object.entries(templates) as [OtpTemplateKey, string][])
    .reduce((acc, [key, value]) => {
      const normalized = value.trim();
      if (normalized) {
        acc[key] = normalized;
      }
      return acc;
    }, {} as Partial<Record<OtpTemplateKey, string>>);
}

function buildEffectiveOtpTemplates(
  templates?: Partial<Record<OtpTemplateKey, string>> | null,
): Record<OtpTemplateKey, string> {
  return {
    login: templates?.login?.trim() || DEFAULT_OTP_TEMPLATES.login,
    register: templates?.register?.trim() || DEFAULT_OTP_TEMPLATES.register,
    forgotPassword:
      templates?.forgotPassword?.trim() || DEFAULT_OTP_TEMPLATES.forgotPassword,
  };
}

export function TenantsPage() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingProductsTenant, setEditingProductsTenant] = useState<Tenant | null>(null);
  const [editingProductsSelection, setEditingProductsSelection] = useState<TenantProduct[]>([]);
  const [savingProducts, setSavingProducts] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    adminName: '',
    adminEmail: '',
    selectedPlanId: 'otp',
    planName: 'خدمة واتساب OTP',
    price: '49',
    currency: 'USD',
    durationMonths: '12',
    maxMonthlyOtp: '1000',
    providerType: 'whatsapp_web' as ProviderType,
    enabledProducts: ['otp'] as TenantProduct[],
    otpTemplates: { ...DEFAULT_OTP_TEMPLATES },
  });

  const otpSelected = form.enabledProducts.includes('otp');

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const result = await apiRequest<Tenant[]>('/tenants', {}, token);
      setTenants(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function handleQuickOnboarding(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setBusy(true);
    try {
      const tenantResponse = await apiRequest<any>(
        '/tenants',
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            contactEmail: form.contactEmail,
            enabledProducts: form.enabledProducts,
            adminName: form.adminName || form.name,
            adminEmail: form.adminEmail || form.contactEmail,
            otpTemplates: otpSelected ? normalizeOtpTemplates(form.otpTemplates) : undefined,
          }),
        },
        token,
      );

      const tenantId = tenantResponse.tenant?.id || tenantResponse.tenant?._id;

      await apiRequest(
        '/subscriptions',
        {
          method: 'POST',
          body: JSON.stringify({
            tenantId,
            planName: form.planName,
            price: Number(form.price),
            currency: form.currency,
            durationMonths: Number(form.durationMonths),
            maxMonthlyOtp: Number(form.maxMonthlyOtp),
          }),
        },
        token,
      );

      await apiRequest(
        '/providers',
        {
          method: 'POST',
          body: JSON.stringify({
            tenantId,
            providerType: form.providerType,
            status: 'active',
            config: {},
          }),
        },
        token,
      );

      if (form.enabledProducts.includes('otp')) {
        const effectiveOtpTemplates = buildEffectiveOtpTemplates(
          normalizeOtpTemplates(form.otpTemplates),
        );
        const createdApiKey = await apiRequest<any>(
          '/api-keys',
          {
            method: 'POST',
            body: JSON.stringify({
              tenantId,
              name: 'Initial Key',
              scopes: ['otp:send', 'otp:verify', 'whatsapp:session'],
            }),
          },
          token,
        );

        await exportClientPackagePdf({
          type: 'api',
          tenantName: form.name,
          tenantId,
          contactEmail: form.contactEmail,
          planName: form.planName,
          subscriptionEnd: buildSubscriptionEndLabel(Number(form.durationMonths)),
          monthlyQuota: Number(form.maxMonthlyOtp),
          priceLabel: `$${Number(form.price) || 0}`,
          providerType: form.providerType,
          apiBaseUrl: createdApiKey.setupPackage.apiBaseUrl,
          dashboardUrl: window.location.origin,
          portalEmail: form.adminEmail || form.contactEmail,
          portalPassword: '(سيصل إيميل لتعيين كلمة المرور)',
          otpTemplates: effectiveOtpTemplates,
          portalRoleLabel: 'مدير الشركة / بوابة العميل',
          rawKey: createdApiKey.rawKey,
          sendEndpoint: createdApiKey.setupPackage.endpoints.sendOtp,
          verifyEndpoint: createdApiKey.setupPackage.endpoints.verifyOtp,
          sessionStartEndpoint: createdApiKey.setupPackage.endpoints.sessionStart,
          sessionStatusEndpoint: createdApiKey.setupPackage.endpoints.sessionStatus,
          sessionDisconnectEndpoint:
            createdApiKey.setupPackage.endpoints.sessionDisconnect,
        });
      }

      setShowAddModal(false);
      setForm({
        name: '',
        slug: '',
        contactEmail: '',
        adminName: '',
        adminEmail: '',
        selectedPlanId: 'otp',
        planName: 'خدمة واتساب OTP',
        price: '49',
        currency: 'USD',
        durationMonths: '12',
        maxMonthlyOtp: '1000',
        providerType: 'whatsapp_web',
        enabledProducts: ['otp'],
        otpTemplates: { ...DEFAULT_OTP_TEMPLATES },
      });
      await loadData();
    } catch (error) {
      alert(`تعذر إنشاء العميل: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadGuides(tenant: Tenant) {
    if (!token) return;

    const tenantId = tenant.id || tenant._id || '';
    if (!tenantId) return;

    try {
      const setupPackage = await apiRequest<any>(
        `/tenants/${tenantId}/setup-package`,
        {},
        token,
      );

      const enabledProducts =
        setupPackage.tenant?.enabledProducts || tenant.enabledProducts || ['otp'];

      const common = {
        tenantName: tenant.name,
        tenantId,
        contactEmail: tenant.contactEmail,
        planName: tenant.subscription?.planName || 'خدمة واتساب OTP',
        subscriptionEnd: tenant.subscription?.endsAt
          ? new Date(tenant.subscription.endsAt).toLocaleDateString('ar-SY')
          : '---',
        monthlyQuota: tenant.subscription?.maxMonthlyOtp || 0,
        priceLabel: `$${tenant.subscription?.price || 0}`,
        providerType:
          setupPackage.provider?.providerType ||
          tenant.provider?.providerType ||
          'mock',
        apiBaseUrl: API_BASE_URL,
        dashboardUrl: setupPackage.portal?.dashboardUrl || window.location.origin,
        portalEmail: setupPackage.portal?.loginEmail || tenant.contactEmail,
        otpTemplates: setupPackage.otpTemplates?.effective,
        portalRoleLabel:
          setupPackage.portal?.role === 'tenant_admin'
            ? 'مدير الشركة / بوابة العميل'
            : setupPackage.portal?.role || 'مدير الشركة / بوابة العميل',
      };

      if (enabledProducts.includes('otp')) {
        const confirmed = window.confirm(
          'سيتم إصدار API Key جديد للتسليم لأن المفتاح الخام لا يمكن استرجاعه بعد إنشائه. هل تريد المتابعة؟',
        );

        if (!confirmed) {
          return;
        }

        const createdApiKey = await apiRequest<any>(
          '/api-keys',
          {
            method: 'POST',
            body: JSON.stringify({
              tenantId,
              name: `Delivery Key ${new Date().toISOString().slice(0, 10)}`,
              scopes: ['otp:send', 'otp:verify', 'whatsapp:session'],
            }),
          },
          token,
        );

        await exportClientPackagePdf({
          ...common,
          type: 'api',
          rawKey: createdApiKey.rawKey,
          apiBaseUrl: createdApiKey.setupPackage.apiBaseUrl,
          sendEndpoint: createdApiKey.setupPackage.endpoints.sendOtp,
          verifyEndpoint: createdApiKey.setupPackage.endpoints.verifyOtp,
          sessionStartEndpoint: createdApiKey.setupPackage.endpoints.sessionStart,
          sessionStatusEndpoint: createdApiKey.setupPackage.endpoints.sessionStatus,
          sessionDisconnectEndpoint:
            createdApiKey.setupPackage.endpoints.sessionDisconnect,
        });
      }

      if (enabledProducts.includes('support')) {
        await exportClientPackagePdf({ ...common, type: 'support' });
      }

      if (enabledProducts.includes('hr')) {
        await exportClientPackagePdf({ ...common, type: 'hr' });
      }
    } catch (error) {
      alert(`تعذر تجهيز ملف التسليم: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  }

  async function handleDownloadSetupJson(tenant: Tenant) {
    if (!token) return;
    const tenantId = tenant.id || tenant._id || '';
    if (!tenantId) return;

    try {
      const setupPackage = await apiRequest<any>(
        `/tenants/${tenantId}/setup-package`,
        {},
        token,
      );
      downloadJson(`${tenant.slug}-setup.json`, setupPackage);
    } catch (error) {
      alert(`تعذر تحميل ملف الإعداد: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  }

  async function handleDeleteTenant(tenant: Tenant) {
    if (!token) return;
    const tenantId = tenant.id || tenant._id;
    if (!tenantId) return;

    const confirmed = window.confirm(
      `سيتم حذف العميل "${tenant.name}" مع كل بياناته نهائياً. هل تريد المتابعة؟`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await apiRequest(`/tenants/${tenantId}`, { method: 'DELETE' }, token);
      setTenants((current) =>
        current.filter((item) => (item.id || item._id) !== tenantId),
      );
    } catch (error) {
      alert(`تعذر حذف العميل: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setBusy(false);
    }
  }

  function openEditProducts(tenant: Tenant) {
    setEditingProductsTenant(tenant);
    setEditingProductsSelection(tenant.enabledProducts || []);
  }

  function toggleEditingProduct(product: TenantProduct) {
    setEditingProductsSelection((current) =>
      current.includes(product)
        ? current.filter((item) => item !== product)
        : [...current, product],
    );
  }

  async function saveEditingProducts() {
    if (!token || !editingProductsTenant) return;
    const tenantId = editingProductsTenant.id || editingProductsTenant._id;
    if (!tenantId) return;

    setSavingProducts(true);
    try {
      await apiRequest(
        `/tenants/${tenantId}/products`,
        { method: 'PATCH', body: JSON.stringify({ enabledProducts: editingProductsSelection }) },
        token,
      );
      setTenants((current) =>
        current.map((item) =>
          (item.id || item._id) === tenantId
            ? { ...item, enabledProducts: editingProductsSelection }
            : item,
        ),
      );
      setEditingProductsTenant(null);
    } catch (error) {
      alert(`تعذر تحديث المنتجات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setSavingProducts(false);
    }
  }

  const stats = useMemo(() => {
    const totalRevenue = tenants.reduce(
      (acc, tenant) => acc + (tenant.subscription?.price || 0),
      0,
    );

    return [
      {
        label: 'إجمالي الإيرادات',
        value: `$${totalRevenue.toLocaleString()}`,
        icon: <DollarSign />,
        color: '#064E3B',
      },
      {
        label: 'العملاء النشطون',
        value: tenants.length,
        icon: <Users />,
        color: '#10b981',
      },
      {
        label: 'متوسط العائد/عميل',
        value: `$${Math.round(totalRevenue / (tenants.length || 1)).toLocaleString()}`,
        icon: <TrendingUp />,
        color: '#3b82f6',
      },
      {
        label: 'حصة OTP الشهرية',
        value: tenants
          .reduce((acc, tenant) => acc + (tenant.subscription?.maxMonthlyOtp || 0), 0)
          .toLocaleString(),
        icon: <Zap />,
        color: '#f59e0b',
      },
    ];
  }, [tenants]);

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-stack"
      dir="rtl"
    >
      <header
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            إدارة العملاء والاشتراكات
          </p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>العملاء والاشتراكات</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={20} /> إضافة عميل جديد
        </button>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {stats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.08 }}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: `${item.color}15`,
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {item.label}
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{item.value}</h3>
            </div>
          </motion.div>
        ))}
      </section>

      <div
        className="card"
        style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', width: '360px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              right: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            placeholder="ابحث عن عميل..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              paddingRight: '2.75rem',
              background: 'var(--bg-main)',
              border: 'none',
            }}
          />
        </div>
        <button className="btn-secondary" onClick={loadData}>
          <Settings size={18} /> تحديث البيانات
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {loading ? (
          <p>جاري التحميل...</p>
        ) : (
          filteredTenants.map((tenant, index) => {
            const connectionStatus = getConnectionStatus(tenant);
            return (
              <motion.div
                key={tenant.id || tenant._id}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.04 }}
                className="card"
                style={{ padding: 0, overflow: 'hidden' }}
              >
                <div
                  style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-soft)',
                    background: 'var(--bg-main)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: 'white',
                          border: '1px solid var(--border-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          color: '#064E3B',
                        }}
                      >
                        {tenant.name[0]}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 700 }}>{tenant.name}</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {tenant.slug}.vayro.com
                        </p>
                      </div>
                    </div>
                    <span
                      className={`badge badge-${tenant.status === 'active' ? 'success' : 'warning'}`}
                    >
                      {tenant.status === 'active' ? 'نشط' : 'مراجعة'}
                    </span>
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
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        قيمة الاشتراك
                      </p>
                      <p style={{ fontWeight: 700, color: '#064E3B' }}>
                        ${tenant.subscription?.price || 0}
                      </p>
                    </div>
                    <div
                      style={{
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        حالة الربط
                      </p>
                      <p
                        style={{
                          fontWeight: 700,
                          color: connectionStatus.color,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <CheckCircle2 size={14} /> {connectionStatus.label}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.85rem' }}>
                    <Package size={14} /> الباقة: {tenant.subscription?.planName || 'غير مفعلة'}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <Calendar size={14} /> ينتهي:{' '}
                    {tenant.subscription?.endsAt
                      ? new Date(tenant.subscription.endsAt).toLocaleDateString('ar-SY')
                      : '---'}
                  </div>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: '0.8rem' }}
                      onClick={() => handleDownloadGuides(tenant)}
                    >
                      <FileText size={16} /> ملفات الإعداد والدليل
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ border: '1px solid var(--border-soft)' }}
                      title="تحميل ملف الإعداد JSON"
                      onClick={() => handleDownloadSetupJson(tenant)}
                    >
                      <FileJson size={16} />
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ border: '1px solid var(--border-soft)' }}
                      title="تعديل المنتجات المفعّلة"
                      onClick={() => openEditProducts(tenant)}
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      className="btn-ghost"
                      style={{
                        border: '1px solid rgba(220, 38, 38, 0.18)',
                        color: '#dc2626',
                      }}
                      onClick={() => handleDeleteTenant(tenant)}
                      disabled={busy}
                      title="حذف العميل"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showAddModal ? (
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
              className="card"
              style={{
                width: 'min(1120px, calc(100vw - 48px))',
                maxHeight: '92vh',
                padding: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '1.5rem', background: '#064E3B', color: 'white' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  إعداد عميل جديد
                </h2>
              </div>

              <form
                onSubmit={handleQuickOnboarding}
                style={{
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  maxHeight: 'calc(92vh - 88px)',
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
                >
                  <input
                    placeholder="اسم العميل"
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    required
                  />
                  <input
                    placeholder="Slug"
                    value={form.slug}
                    onChange={(event) =>
                      setForm({ ...form, slug: event.target.value })
                    }
                    required
                  />
                </div>

                <input
                  placeholder="البريد الإلكتروني"
                  value={form.contactEmail}
                  onChange={(event) =>
                    setForm({ ...form, contactEmail: event.target.value })
                  }
                  required
                />

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                  }}
                >
                  <input
                    placeholder="اسم مدير العميل"
                    value={form.adminName}
                    onChange={(event) =>
                      setForm({ ...form, adminName: event.target.value })
                    }
                  />
                  <input
                    placeholder="بريد دخول العميل"
                    value={form.adminEmail}
                    onChange={(event) =>
                      setForm({ ...form, adminEmail: event.target.value })
                    }
                    required
                  />
                </div>

                <div style={{ padding: '0.75rem 1rem', background: 'rgba(6, 78, 59,0.06)', borderRadius: '10px', border: '1px dashed #064E3B', fontSize: '0.85rem', color: '#064E3B' }}>
                  📧 سيصل العميل إيميل ترحيب لتعيين كلمة المرور بنفسه
                </div>

                <div
                  style={{
                    padding: '1.25rem',
                    background: 'var(--bg-main)',
                    borderRadius: '12px',
                    border: '1px dashed #064E3B',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      display: 'block',
                    }}
                  >
                    اختر الخدمة المطلوبة
                  </label>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: otpSelected
                        ? '1.05fr 1.35fr'
                        : '1fr',
                      gap: '1rem',
                      alignItems: 'start',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gap: '1rem',
                      }}
                    >
                      <div className="input-group">
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            marginBottom: '0.25rem',
                          }}
                        >
                          الباقة الجاهزة
                        </label>
                        <select
                          value={form.selectedPlanId}
                          onChange={(event) => {
                            const selectedPlan = PRESET_PLANS.find(
                              (item) => item.id === event.target.value,
                            );
                            if (!selectedPlan) return;

                            setForm({
                              ...form,
                              selectedPlanId: selectedPlan.id,
                              planName: selectedPlan.name,
                              price: String(selectedPlan.price),
                              durationMonths: String(selectedPlan.duration),
                              maxMonthlyOtp: String(selectedPlan.quota),
                              enabledProducts: selectedPlan.products,
                              providerType:
                                selectedPlan.products.includes('otp')
                                  ? 'whatsapp_web'
                                  : form.providerType,
                            });
                          }}
                        >
                          {PRESET_PLANS.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 0.85fr)',
                          gap: '1rem',
                        }}
                      >
                        <input
                          placeholder="اسم الباقة"
                          value={form.planName}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              selectedPlanId: 'custom',
                              planName: event.target.value,
                            })
                          }
                        />
                        <input
                          placeholder="السعر"
                          value={form.price}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              selectedPlanId: 'custom',
                              price: event.target.value,
                            })
                          }
                        />
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: otpSelected
                            ? 'repeat(3, minmax(0, 1fr))'
                            : 'repeat(2, minmax(0, 1fr))',
                          gap: '1rem',
                        }}
                      >
                        <div className="input-group">
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              marginBottom: '0.25rem',
                            }}
                          >
                            مدة الاشتراك
                          </label>
                          <select
                            value={form.durationMonths}
                            onChange={(event) =>
                              setForm({ ...form, durationMonths: event.target.value })
                            }
                          >
                            <option value="1">شهر واحد</option>
                            <option value="6">6 أشهر</option>
                            <option value="12">سنة واحدة</option>
                            <option value="24">سنتين</option>
                            <option value="60">5 سنوات</option>
                          </select>
                        </div>

                        {otpSelected ? (
                          <div className="input-group">
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)',
                                marginBottom: '0.25rem',
                              }}
                            >
                              الحصة الشهرية
                            </label>
                            <input
                              placeholder="الحصة الشهرية"
                              value={form.maxMonthlyOtp}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  selectedPlanId: 'custom',
                                  maxMonthlyOtp: event.target.value,
                                })
                              }
                            />
                          </div>
                        ) : null}

                        <div className="input-group">
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              marginBottom: '0.25rem',
                            }}
                          >
                            مزود الخدمة
                          </label>
                          <select
                            value={form.providerType}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                providerType: event.target.value as ProviderType,
                              })
                            }
                          >
                            <option value="whatsapp_web">واتساب مباشر عبر QR</option>
                            <option value="twilio">Twilio SMS</option>
                            <option value="mock">وضع تجريبي</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {otpSelected ? (
                      <div
                        style={{
                          display: 'grid',
                          gap: '1rem',
                        }}
                      >
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.8,
                        }}
                      >
                        هذه الرسائل تُثبت من طرفك عند تجهيز العميل. وجود{' '}
                        <span className="ltr">{'{{code}}'}</span> داخل كل رسالة إلزامي لأنه
                        المكان الذي سيظهر فيه رمز التحقق الفعلي.
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: '1rem',
                        }}
                      >
                        {(Object.entries(OTP_TEMPLATE_LABELS) as [OtpTemplateKey, string][]).map(
                          ([key, label]) => (
                            <div
                              key={key}
                              className="input-group"
                              style={{
                                padding: '1rem',
                                borderRadius: '12px',
                                background: 'white',
                                border: '1px solid var(--border-soft)',
                              }}
                            >
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-muted)',
                                  marginBottom: '0.5rem',
                                }}
                              >
                                {label}
                              </label>
                              <textarea
                                value={form.otpTemplates[key]}
                                rows={5}
                                onChange={(event) =>
                                  setForm({
                                    ...form,
                                    otpTemplates: {
                                      ...form.otpTemplates,
                                      [key]: event.target.value,
                                    },
                                  })
                                }
                                placeholder={DEFAULT_OTP_TEMPLATES[key]}
                                style={{
                                  width: '100%',
                                  resize: 'vertical',
                                  minHeight: '150px',
                                }}
                              />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        minHeight: '100%',
                        padding: '2rem 1rem',
                        color: 'var(--text-muted)',
                        background: 'white',
                        borderRadius: '12px',
                        border: '1px solid var(--border-soft)',
                        textAlign: 'center',
                        lineHeight: 1.9,
                      }}
                    >
                      هذه الخدمة لا تحتاج قوالب OTP ثابتة، لذلك سيبقى هذا الجزء
                      فارغاً.
                    </div>
                  )}
                </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled={busy}
                  >
                    {busy ? 'جاري التفعيل...' : 'تفعيل الخدمة للعميل'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowAddModal(false)}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editingProductsTenant ? (
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
              className="card"
              style={{ width: 'min(420px, calc(100vw - 48px))', padding: '1.5rem' }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                تعديل منتجات {editingProductsTenant.name}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                فعّل أو ألغِ أي خدمة لهذا العميل بدون التأثير على باقي إعداداته.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {(
                  [
                    { value: 'otp' as TenantProduct, label: 'خدمة واتساب OTP' },
                    { value: 'support' as TenantProduct, label: 'صندوق الدعم المشترك' },
                    { value: 'hr' as TenantProduct, label: 'منصة التوظيف' },
                    { value: 'doctor_relay' as TenantProduct, label: 'توجيه الخصوصية (طبيب/عميل)' },
                  ]
                ).map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-soft)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editingProductsSelection.includes(option.value)}
                      onChange={() => toggleEditingProduct(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" style={{ flex: 1 }} disabled={savingProducts} onClick={saveEditingProducts}>
                  {savingProducts ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button className="btn-ghost" type="button" onClick={() => setEditingProductsTenant(null)}>
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
