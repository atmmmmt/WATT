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
  MessageSquare,
  Briefcase,
  ShieldCheck,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, apiRequest } from '../lib/api';
import { exportClientPackagePdf } from '../lib/export-client-package-pdf';

type TenantProduct = 'otp' | 'support' | 'hr' | 'doctor_relay';
type ProviderType = 'mock' | 'whatsapp_web' | 'twilio';
type OtpTemplateKey = 'login' | 'register' | 'forgotPassword';

type ProductOption = {
  value: TenantProduct;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const PRODUCT_OPTIONS: ProductOption[] = [
  {
    value: 'otp',
    label: 'واتساب OTP',
    description: 'إرسال رموز التحقق وتأكيد الدخول والتسجيل عبر واتساب.',
    icon: <Zap size={20} />,
  },
  {
    value: 'support',
    label: 'الصندوق المشترك',
    description: 'صندوق واتساب موحد للفريق مع التعيين والردود والمتابعة.',
    icon: <MessageSquare size={20} />,
  },
  {
    value: 'hr',
    label: 'التوظيف',
    description: 'إدارة الوظائف والمتقدمين ومراسلتهم من داخل VAYRO.',
    icon: <Briefcase size={20} />,
  },
  {
    value: 'doctor_relay',
    label: 'الخصوصية / التوجيه',
    description: 'ربط طرفين عبر رقم VAYRO بدون كشف رقم أي طرف للطرف الآخر.',
    icon: <ShieldCheck size={20} />,
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

function createInitialForm() {
  return {
    name: '',
    slug: '',
    contactEmail: '',
    adminName: '',
    adminEmail: '',
    planName: 'خدمة واتساب OTP',
    price: '49',
    currency: 'USD',
    durationMonths: '12',
    maxMonthlyOtp: '1000',
    providerType: 'whatsapp_web' as ProviderType,
    enabledProducts: ['otp'] as TenantProduct[],
    otpTemplates: { ...DEFAULT_OTP_TEMPLATES },
  };
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
  return (Object.entries(templates) as [OtpTemplateKey, string][]).reduce(
    (acc, [key, value]) => {
      const normalized = value.trim();
      if (normalized) acc[key] = normalized;
      return acc;
    },
    {} as Partial<Record<OtpTemplateKey, string>>,
  );
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

function productLabel(product: TenantProduct) {
  return PRODUCT_OPTIONS.find((option) => option.value === product)?.label || product;
}

function autoPlanName(products: TenantProduct[]) {
  if (products.length === PRODUCT_OPTIONS.length) return 'الباقة الشاملة';
  if (!products.length) return 'باقة مخصصة';
  return products.map(productLabel).join(' + ');
}

export function TenantsPage() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resettingTenantId, setResettingTenantId] = useState<string | null>(null);
  const [editingProductsTenant, setEditingProductsTenant] = useState<Tenant | null>(null);
  const [editingProductsSelection, setEditingProductsSelection] = useState<TenantProduct[]>([]);
  const [savingProducts, setSavingProducts] = useState(false);
  const [form, setForm] = useState(createInitialForm);

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

  function toggleFormProduct(product: TenantProduct) {
    setForm((current) => {
      const enabledProducts = current.enabledProducts.includes(product)
        ? current.enabledProducts.filter((item) => item !== product)
        : [...current.enabledProducts, product];

      return {
        ...current,
        enabledProducts,
        planName: autoPlanName(enabledProducts),
        providerType: 'whatsapp_web',
        maxMonthlyOtp: enabledProducts.includes('otp') ? current.maxMonthlyOtp || '1000' : '0',
      };
    });
  }

  async function handleQuickOnboarding(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (!form.enabledProducts.length) {
      alert('اختر خدمة واحدة على الأقل للعميل.');
      return;
    }

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
            planName: form.planName || autoPlanName(form.enabledProducts),
            price: Number(form.price),
            currency: form.currency,
            durationMonths: Number(form.durationMonths),
            maxMonthlyOtp: otpSelected ? Number(form.maxMonthlyOtp) : 0,
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

      if (otpSelected) {
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
          sessionDisconnectEndpoint: createdApiKey.setupPackage.endpoints.sessionDisconnect,
        });
      }

      setShowAddModal(false);
      setForm(createInitialForm());
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
      const setupPackage = await apiRequest<any>(`/tenants/${tenantId}/setup-package`, {}, token);
      const enabledProducts = setupPackage.tenant?.enabledProducts || tenant.enabledProducts || ['otp'];
      const common = {
        tenantName: tenant.name,
        tenantId,
        contactEmail: tenant.contactEmail,
        planName: tenant.subscription?.planName || 'باقة VAYRO',
        subscriptionEnd: tenant.subscription?.endsAt
          ? new Date(tenant.subscription.endsAt).toLocaleDateString('ar-SY')
          : '---',
        monthlyQuota: tenant.subscription?.maxMonthlyOtp || 0,
        priceLabel: `$${tenant.subscription?.price || 0}`,
        providerType: setupPackage.provider?.providerType || tenant.provider?.providerType || 'mock',
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
        if (!confirmed) return;

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
          sessionDisconnectEndpoint: createdApiKey.setupPackage.endpoints.sessionDisconnect,
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
      const setupPackage = await apiRequest<any>(`/tenants/${tenantId}/setup-package`, {}, token);
      downloadJson(`${tenant.slug}-setup.json`, setupPackage);
    } catch (error) {
      alert(`تعذر تحميل ملف الإعداد: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  }

  async function handleSendPasswordReset(tenant: Tenant) {
    if (!token) return;
    const tenantId = tenant.id || tenant._id || '';
    if (!tenantId) return;

    const confirmed = window.confirm(
      `سيتم إرسال رابط آمن لإعادة تعيين كلمة المرور إلى مدير العميل "${tenant.name}". هل تريد المتابعة؟`,
    );
    if (!confirmed) return;

    setResettingTenantId(tenantId);
    try {
      const result = await apiRequest<{ success: boolean; email: string }>(
        `/tenants/${tenantId}/send-password-reset`,
        { method: 'POST' },
        token,
      );
      alert(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${result.email}`);
    } catch (error) {
      alert(
        `تعذر إرسال رابط إعادة التعيين: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
      );
    } finally {
      setResettingTenantId(null);
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
      setTenants((current) => current.filter((item) => (item.id || item._id) !== tenantId));
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
    if (!editingProductsSelection.length) {
      alert('اختر خدمة واحدة على الأقل.');
      return;
    }

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
    const totalRevenue = tenants.reduce((acc, tenant) => acc + (tenant.subscription?.price || 0), 0);
    return [
      { label: 'إجمالي الإيرادات', value: `$${totalRevenue.toLocaleString()}`, icon: <DollarSign />, color: '#064E3B' },
      { label: 'العملاء النشطون', value: tenants.length, icon: <Users />, color: '#10b981' },
      { label: 'متوسط العائد/عميل', value: `$${Math.round(totalRevenue / (tenants.length || 1)).toLocaleString()}`, icon: <TrendingUp />, color: '#3b82f6' },
      { label: 'حصة OTP الشهرية', value: tenants.reduce((acc, tenant) => acc + (tenant.subscription?.maxMonthlyOtp || 0), 0).toLocaleString(), icon: <Zap />, color: '#f59e0b' },
    ];
  }, [tenants]);

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase()),
  );

  const productCardStyle = (selected: boolean) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.8rem',
    padding: '1rem',
    borderRadius: '12px',
    border: selected ? '2px solid var(--brand-primary)' : '1px solid var(--border-soft)',
    background: selected ? 'rgba(6,78,59,0.06)' : 'white',
    cursor: 'pointer',
    transition: 'all .18s ease',
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-stack" dir="rtl">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إدارة العملاء والاشتراكات</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>العملاء والاشتراكات</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={20} /> إضافة عميل جديد
        </button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {stats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.06 }}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, color: item.color, display: 'grid', placeItems: 'center' }}>
              {item.icon}
            </div>
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.label}</p>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{item.value}</h3>
            </div>
          </motion.div>
        ))}
      </section>

      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', width: 'min(360px, 100%)' }}>
          <Search size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="ابحث عن عميل..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ paddingRight: '2.75rem', background: 'var(--bg-main)', border: 'none' }}
          />
        </div>
        <button className="btn-secondary" onClick={loadData}><Settings size={18} /> تحديث البيانات</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
        {loading ? <p>جاري التحميل...</p> : filteredTenants.map((tenant, index) => {
          const connectionStatus = getConnectionStatus(tenant);
          const products = tenant.enabledProducts || [];
          const tenantId = tenant.id || tenant._id || '';
          const resettingPassword = resettingTenantId === tenantId;
          return (
            <motion.div
              key={tenant.id || tenant._id}
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className="card"
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <div style={{ padding: '1.4rem', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: 'white', border: '1px solid var(--border-soft)', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#064E3B' }}>
                      {tenant.name[0]}
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 800 }}>{tenant.name}</h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{tenant.slug}.vayro.com</p>
                    </div>
                  </div>
                  <span className={`badge badge-${tenant.status === 'active' ? 'success' : 'warning'}`}>
                    {tenant.status === 'active' ? 'نشط' : 'مراجعة'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ background: 'white', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>قيمة الاشتراك</p>
                    <p style={{ fontWeight: 800, color: '#064E3B' }}>${tenant.subscription?.price || 0}</p>
                  </div>
                  <div style={{ background: 'white', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>حالة الربط</p>
                    <p style={{ fontWeight: 800, color: connectionStatus.color, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={14} /> {connectionStatus.label}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.84rem' }}><Package size={14} /> الباقة: {tenant.subscription?.planName || 'غير مفعلة'}</div>
                <div style={{ fontSize: '0.84rem' }}><Calendar size={14} /> ينتهي: {tenant.subscription?.endsAt ? new Date(tenant.subscription.endsAt).toLocaleDateString('ar-SY') : '---'}</div>
                <div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>الخدمات المفعلة</p>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {products.length ? products.map((product) => (
                      <span key={product} className="badge" style={{ background: 'rgba(6,78,59,.08)', color: 'var(--brand-primary)', border: '1px solid rgba(6,78,59,.12)' }}>
                        {productLabel(product)}
                      </span>
                    )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>لا توجد خدمات</span>}
                  </div>
                </div>

                <button
                  className="btn-secondary"
                  style={{ width: '100%', fontSize: '0.8rem', marginTop: '0.35rem' }}
                  onClick={() => handleSendPasswordReset(tenant)}
                  disabled={resettingPassword}
                >
                  <KeyRound size={16} />
                  {resettingPassword ? 'جاري إرسال الرابط...' : 'إرسال إعادة تعيين كلمة المرور'}
                </button>

                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => handleDownloadGuides(tenant)}>
                    <FileText size={16} /> ملفات الإعداد والدليل
                  </button>
                  <button className="btn-ghost" style={{ border: '1px solid var(--border-soft)' }} title="تحميل ملف الإعداد JSON" onClick={() => handleDownloadSetupJson(tenant)}><FileJson size={16} /></button>
                  <button className="btn-ghost" style={{ border: '1px solid var(--border-soft)' }} title="تعديل الخدمات المفعّلة" onClick={() => openEditProducts(tenant)}><Settings size={16} /></button>
                  <button className="btn-ghost" style={{ border: '1px solid rgba(220,38,38,.18)', color: '#dc2626' }} onClick={() => handleDeleteTenant(tenant)} disabled={busy} title="حذف العميل"><Trash2 size={16} /></button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ width: 'min(1120px, calc(100vw - 32px))', maxHeight: '94vh', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.35rem 1.5rem', background: '#064E3B', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>إعداد عميل جديد</h2>
                  <p style={{ opacity: .78, fontSize: '0.8rem', marginTop: '0.2rem' }}>اختر بالـ Checkbox الخدمات التي تريد فتحها لهذا العميل.</p>
                </div>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 0, color: 'white', cursor: 'pointer' }}><X size={21} /></button>
              </div>

              <form onSubmit={handleQuickOnboarding} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: 'calc(94vh - 82px)', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                  <input placeholder="اسم العميل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  <input placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
                  <input placeholder="البريد الإلكتروني" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required />
                  <input placeholder="اسم مدير العميل" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
                  <input placeholder="بريد دخول العميل" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required />
                </div>

                <div style={{ padding: '0.75rem 1rem', background: 'rgba(6,78,59,.06)', borderRadius: 10, border: '1px dashed #064E3B', fontSize: '0.84rem', color: '#064E3B' }}>
                  📧 سيصل العميل إيميل ترحيب لتعيين كلمة المرور بنفسه.
                </div>

                <section style={{ padding: '1.2rem', background: 'var(--bg-main)', borderRadius: 14, border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>الخدمات المفعلة للعميل</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>اختَر أي مجموعة من الخدمات. يمكن تعديلها لاحقاً من زر الإعدادات في بطاقة العميل.</p>
                    </div>
                    <span className="badge badge-success">{form.enabledProducts.length} محددة</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.8rem' }}>
                    {PRODUCT_OPTIONS.map((option) => {
                      const selected = form.enabledProducts.includes(option.value);
                      return (
                        <label key={option.value} style={productCardStyle(selected)}>
                          <input type="checkbox" checked={selected} onChange={() => toggleFormProduct(option.value)} style={{ marginTop: '0.2rem', width: 18, height: 18, accentColor: 'var(--brand-primary)' }} />
                          <div style={{ color: selected ? 'var(--brand-primary)' : 'var(--text-muted)', marginTop: '0.05rem' }}>{option.icon}</div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{option.label}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.65, marginTop: '0.15rem' }}>{option.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) repeat(3, minmax(0, .7fr))', gap: '1rem' }}>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>اسم الباقة / الاتفاق</label>
                    <input value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} placeholder="مثلاً: باقة العيادة" />
                  </div>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>السعر ($)</label>
                    <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>مدة الاشتراك</label>
                    <select value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })}>
                      <option value="1">شهر</option><option value="6">6 أشهر</option><option value="12">سنة</option><option value="24">سنتين</option><option value="60">5 سنوات</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>مزود واتساب</label>
                    <select value={form.providerType} onChange={(e) => setForm({ ...form, providerType: e.target.value as ProviderType })}>
                      <option value="whatsapp_web">واتساب مباشر عبر QR</option>
                      <option value="twilio">Twilio</option>
                      <option value="mock">تجريبي</option>
                    </select>
                  </div>
                </div>

                {otpSelected && (
                  <section className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem', alignItems: 'start' }}>
                      <div className="input-group">
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>حصة OTP الشهرية</label>
                        <input type="number" min="0" value={form.maxMonthlyOtp} onChange={(e) => setForm({ ...form, maxMonthlyOtp: e.target.value })} />
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.8 }}>
                        قوالب OTP تستخدم <span className="ltr">{'{{code}}'}</span> لإظهار رمز التحقق و <span className="ltr">{'{{expiresInMinutes}}'}</span> لمدة الصلاحية.
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.8rem', marginTop: '1rem' }}>
                      {(Object.entries(OTP_TEMPLATE_LABELS) as [OtpTemplateKey, string][]).map(([key, label]) => (
                        <div key={key} className="input-group" style={{ padding: '0.9rem', borderRadius: 12, background: 'var(--bg-main)', border: '1px solid var(--border-soft)' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{label}</label>
                          <textarea
                            value={form.otpTemplates[key]}
                            rows={5}
                            onChange={(e) => setForm({ ...form, otpTemplates: { ...form.otpTemplates, [key]: e.target.value } })}
                            style={{ width: '100%', resize: 'vertical', minHeight: 130 }}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={busy || !form.enabledProducts.length}>
                    {busy ? 'جاري إنشاء العميل...' : `إنشاء العميل وتفعيل ${form.enabledProducts.length} خدمة`}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setShowAddModal(false)}>إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProductsTenant && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ width: 'min(520px, calc(100vw - 32px))', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem' }}>خدمات {editingProductsTenant.name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>علّم على الخدمات التي تريد إظهارها وتفعيلها لهذا العميل.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
                {PRODUCT_OPTIONS.map((option) => {
                  const selected = editingProductsSelection.includes(option.value);
                  return (
                    <label key={option.value} style={productCardStyle(selected)}>
                      <input type="checkbox" checked={selected} onChange={() => toggleEditingProduct(option.value)} style={{ marginTop: '0.2rem', width: 18, height: 18, accentColor: 'var(--brand-primary)' }} />
                      <div style={{ color: selected ? 'var(--brand-primary)' : 'var(--text-muted)' }}>{option.icon}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{option.label}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '0.15rem' }}>{option.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" style={{ flex: 1 }} disabled={savingProducts || !editingProductsSelection.length} onClick={saveEditingProducts}>
                  {savingProducts ? 'جاري الحفظ...' : `حفظ (${editingProductsSelection.length})`}
                </button>
                <button className="btn-ghost" type="button" onClick={() => setEditingProductsTenant(null)}>إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
