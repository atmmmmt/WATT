import { NavLink } from 'react-router-dom';
import { PropsWithChildren, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  LayoutDashboard, MessageSquare, Users, Settings, LogOut, Zap, BarChart3,
  Clock, History as LucideHistory, ShieldCheck, Briefcase, MessagesSquare,
  Network, Package, Wallet, Bell, AlertCircle, Info, Globe2, ClipboardList,
  Sun, Moon, ChevronDown, Download, X, LayoutGrid, WifiOff, RefreshCw, Share, PlusSquare,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { can, Permission } from '../lib/permissions';
import { haptic } from '../lib/mobile';
import { VayroLogo, VayroMark } from './VayroLogo';
import {
  canInstallApp, onInstallAvailabilityChange, promptInstall, isStandalone, isIosSafari, onUpdateReady,
} from '../lib/pwa';

// Short labels for the mobile tab bar — the full sidebar labels don't fit under an icon.
const TAB_LABELS: Record<string, string> = {
  '/support/inbox': 'الوارد',
  '/home': 'الرئيسية',
  '/': 'الرئيسية',
  '/hr/inbox': 'المتقدمين',
  '/hr': 'التوظيف',
  '/tenants': 'العملاء',
  '/otp-logs': 'سجل OTP',
  '/support/reports': 'التحليلات',
  '/finance': 'المالية',
  '/doctor-relay/links': 'التوجيه',
};
const TAB_PRIORITY = Object.keys(TAB_LABELS);

function readFlag(key: string) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key: string) {
  try { localStorage.setItem(key, '1'); } catch { /* storage unavailable */ }
}

/* ── Theme hook ─────────────────────────────────────────────── */
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('vayro-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vayro-theme', theme);
    // Keep the phone's status bar in step with the in-app theme.
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) =>
      meta.setAttribute('content', theme === 'dark' ? '#0F2E27' : '#FFFFFF'),
    );
  }, [theme]);

  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}

/* ── Helpers ────────────────────────────────────────────────── */
function roleLabel(role?: string) {
  const map: Record<string, string> = {
    super_admin: 'مدير المنصة',
    tenant_admin: 'مدير الشركة',
    hr_manager: 'مدير التوظيف',
    recruiter: 'موظف توظيف',
    admin: 'مدير الدعم',
    supervisor: 'مشرف فريق',
    agent: 'موظف دعم',
  };
  return map[role || ''] || 'مستخدم';
}

function initials(name?: string) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function avatarColor(name?: string) {
  // Distinct hues that still sit comfortably beside the emerald brand.
  const colors = ['#064E3B', '#0E7490', '#B45309', '#9333EA', '#BE123C', '#1D4ED8'];
  if (!name) return colors[0];
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

interface NotificationItem {
  id: string; text: string; time: string; type: 'alert' | 'info';
}

/* ── Component ──────────────────────────────────────────────── */
export function SidebarLayout({ children }: PropsWithChildren) {
  const { user, token, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(canInstallApp());
  const installed = isStandalone();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const iosSafari = isIosSafari();
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const sheetTouchStart = useRef<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setCanInstall(canInstallApp());
    return onInstallAvailabilityChange(setCanInstall);
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const offUpdate = onUpdateReady(() => setUpdateReady(true));
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      offUpdate();
    };
  }, []);

  // iOS has no install prompt: explain "Add to Home Screen" once, a few seconds in.
  useEffect(() => {
    if (!iosSafari || installed || readFlag('vayro-ios-hint')) return;
    const timer = setTimeout(() => setIosHintOpen(true), 4000);
    return () => clearTimeout(timer);
  }, [iosSafari, installed]);

  const closeIosHint = () => {
    writeFlag('vayro-ios-hint');
    setIosHintOpen(false);
  };

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!token || user?.role !== 'super_admin') return;
    apiRequest<any[]>('/tenants', {}, token).then(tenants => {
      const alerts: NotificationItem[] = [];
      tenants.forEach(t => {
        if (t.subscription?.endsAt) {
          const d = Math.ceil((new Date(t.subscription.endsAt).getTime() - Date.now()) / 86400000);
          if (d < 0) alerts.push({ id: `exp-${t.id||t._id}`, text: `اشتراك "${t.name}" منتهي منذ ${Math.abs(d)} يوم`, time: 'عاجل', type: 'alert' });
          else if (d <= 14) alerts.push({ id: `warn-${t.id||t._id}`, text: `اشتراك "${t.name}" ينتهي خلال ${d} يوم`, time: 'تذكير', type: 'alert' });
        }
      });
      if (!alerts.length) alerts.push({ id: 'ok', text: 'جميع اشتراكات العملاء سارية', time: 'الآن', type: 'info' });
      setNotifications(alerts);
    }).catch(() => {});
  }, [token, user]);

  const isSuperAdmin   = user?.role === 'super_admin';
  const isTenantAdmin  = user?.role === 'tenant_admin';
  const products       = user?.enabledProducts ?? [];
  const hasOtp         = isSuperAdmin || products.includes('otp');
  const hasHr          = isSuperAdmin || products.includes('hr');
  const hasSupport     = isSuperAdmin || products.includes('support');
  const hasDoctorRelay = isSuperAdmin || products.includes('doctor_relay');
  const hrRoles        = ['super_admin', 'tenant_admin', 'hr_manager', 'recruiter'];
  const supportRoles   = ['super_admin', 'tenant_admin', 'admin', 'supervisor', 'agent'];
  const canUseHr       = hasHr    && hrRoles.includes(user?.role || '');
  const canUseSupport  = hasSupport && supportRoles.includes(user?.role || '');
  const canManageConn  = hasSupport && ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const canManageEmp   = hasSupport && ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const canViewReports = hasSupport && ['super_admin', 'tenant_admin', 'admin', 'supervisor'].includes(user?.role || '');
  const canManageSet   = hasSupport && ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const canUseDoctorRelay = hasDoctorRelay && can(user, Permission.ROUTING_LINKS_VIEW);
  const alertCount     = notifications.filter(n => n.type === 'alert').length;
  const avatarBg       = avatarColor(user?.name);

  type NavItem = { to: string; label: string; icon: React.ReactNode; };
  type NavGroup = { label?: string; items: NavItem[] };

  const groups: NavGroup[] = [
    ...(isTenantAdmin ? [{
      label: 'الرئيسية',
      items: [
        { to: '/home', label: 'لوحة التحكم', icon: <LayoutDashboard size={18} /> },
        ...(hasOtp ? [{ to: '/otp-logs', label: 'سجل OTP', icon: <Clock size={18} /> }] : []),
      ],
    }] : []),
    ...(isSuperAdmin ? [{
      label: 'إدارة المنصة',
      items: [
        { to: '/', label: 'نظرة عامة', icon: <LayoutDashboard size={18} /> },
        { to: '/tenants', label: 'العملاء', icon: <Users size={18} /> },
        { to: '/packages', label: 'الباقات والأسعار', icon: <Package size={18} /> },
        { to: '/landing-editor', label: 'صفحة الهبوط', icon: <Globe2 size={18} /> },
        { to: '/landing-orders', label: 'طلبات الهبوط', icon: <ClipboardList size={18} /> },
        { to: '/finance', label: 'المالية والسحوبات', icon: <Wallet size={18} /> },
        { to: '/otp-logs', label: 'سجل OTP', icon: <Clock size={18} /> },
      ],
    }] : []),
    ...(canUseHr ? [{
      label: 'التوظيف',
      items: [
        { to: '/hr', label: 'إدارة التوظيف', icon: <Briefcase size={18} /> },
        { to: '/hr/jobs', label: 'الوظائف النشطة', icon: <Zap size={18} /> },
        { to: '/hr/inbox', label: 'صندوق التوظيف', icon: <MessageSquare size={18} /> },
        { to: '/hr/templates', label: 'قوالب الردود', icon: <LucideHistory size={18} /> },
        { to: '/hr/reports', label: 'تقارير التوظيف', icon: <BarChart3 size={18} /> },
      ],
    }] : []),
    ...(canUseSupport ? [{
      label: 'الدعم والتواصل',
      items: [
        ...(canManageConn ? [{ to: '/support/connection', label: 'ربط واتساب', icon: <Network size={18} /> }] : []),
        { to: '/support/inbox', label: 'صندوق الوارد', icon: <MessagesSquare size={18} /> },
        ...(canManageEmp   ? [{ to: '/support/employees', label: 'فريق الدعم', icon: <Users size={18} /> }] : []),
        ...(canViewReports ? [{ to: '/support/reports', label: 'التحليلات', icon: <BarChart3 size={18} /> }] : []),
        ...(canManageSet   ? [{ to: '/support/settings', label: 'إعدادات النظام', icon: <Settings size={18} /> }] : []),
      ],
    }] : []),
    ...(canUseDoctorRelay ? [{
      label: 'توجيه الخصوصية',
      items: [
        { to: '/doctor-relay/links', label: 'روابط التوجيه', icon: <Network size={18} /> },
      ],
    }] : []),
  ];

  const allItems = groups.flatMap(g => g.items);
  const tabItems = TAB_PRIORITY
    .map(to => allItems.find(item => item.to === to))
    .filter((item): item is NavItem => !!item)
    .slice(0, 4);
  const matchesPath = (to: string) =>
    to === '/' || to === '/home'
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);
  const currentItem = [...allItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find(item => matchesPath(item.to));
  const pageTitle = currentItem?.label || 'VAYRO';
  const showInstall = (canInstall || iosSafari) && !installed;
  const handleInstall = () => {
    if (iosSafari) setIosHintOpen(true);
    else promptInstall();
  };

  return (
    <div className="app-shell" dir="rtl">

      {/* ── Mobile top bar (only < 768px) ───────────────────── */}
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <VayroMark size={34} />
          <div style={{ minWidth: 0 }}>
            <div className="mobile-topbar-kicker">VAYRO</div>
            <div className="mobile-topbar-title">{pageTitle}</div>
          </div>
        </div>
        <div className="mobile-topbar-actions">
          <button className="mobile-icon-btn" onClick={toggleTheme} aria-label="تبديل المظهر">
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="mobile-avatar"
            style={{ background: avatarBg }}
            onClick={() => setMobileNavOpen(true)}
            aria-label="الحساب والقائمة"
          >
            {initials(user?.name)}
          </button>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ───────────────────────────── */}
      <nav className="mobile-tabbar" aria-label="التنقل الرئيسي">
        {tabItems.map(item => {
          const active = matchesPath(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => haptic()}
              className={({ isActive }) => isActive ? 'tab-item active' : 'tab-item'}
            >
              <span className="tab-icon">
                {/* One pill slides between tabs instead of fading in and out. */}
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--brand-primary-soft)' }}
                  />
                )}
                <span style={{ position: 'relative', display: 'flex' }}>{item.icon}</span>
              </span>
              <span className="tab-label">{TAB_LABELS[item.to] || item.label}</span>
            </NavLink>
          );
        })}
        <button
          className={mobileNavOpen ? 'tab-item active' : 'tab-item'}
          onClick={() => { haptic(); setMobileNavOpen(true); }}
        >
          <span className="tab-icon"><LayoutGrid size={18} /></span>
          <span className="tab-label">المزيد</span>
        </button>
      </nav>

      {/* Drawer overlay */}
      {mobileNavOpen && <div className="sidebar-overlay" onClick={() => setMobileNavOpen(false)} />}

      {/* ── Sidebar (bottom sheet on mobile) ────────────────── */}
      <aside
        className={mobileNavOpen ? 'sidebar open' : 'sidebar'}
        // Swipe the sheet down to dismiss it, like a native bottom sheet.
        onTouchStart={(e) => { sheetTouchStart.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          const start = sheetTouchStart.current;
          sheetTouchStart.current = null;
          if (start !== null && e.changedTouches[0].clientY - start > 70) {
            haptic();
            setMobileNavOpen(false);
          }
        }}
      >
        <div className="sidebar-inner">
          <div className="sheet-grabber" aria-hidden="true" />
          <button className="mobile-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="إغلاق">
            <X size={20} />
          </button>

          {/* Brand */}
          <div className="sidebar-brand">
            <VayroMark size={38} />
            <div style={{ minWidth: 0 }}>
              <VayroLogo height={22} />
              <div className="brand-tagline">تواصل أذكى لأعمال أكبر</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="nav-group">
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.label && <div className="nav-group-label">{group.label}</div>}
                {group.items.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/' || link.to === '/home'}
                    className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">

            {/* Notification bell — super_admin only */}
            {isSuperAdmin && (
              <div style={{ position: 'relative', marginBottom: '0.35rem' }}>
                <button
                  className="nav-link btn-ghost"
                  onClick={() => setShowNotif(v => !v)}
                  style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid transparent', height: 'auto' }}
                >
                  <Bell size={17} />
                  <span style={{ flex: 1, textAlign: 'right' }}>الإشعارات</span>
                  {alertCount > 0 && (
                    <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '99px', fontWeight: 800 }}>
                      {alertCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotif && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      style={{
                        position: 'absolute', bottom: '110%', left: 0, right: 0,
                        background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-soft)',
                        zIndex: 200, overflow: 'hidden',
                      }}
                    >
                      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-soft)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        التنبيهات
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {notifications.map(n => (
                          <div key={n.id} style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-soft)', fontSize: '0.78rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            {n.type === 'alert'
                              ? <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                              : <Info size={14} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />}
                            <span style={{ color: n.type === 'alert' ? 'var(--danger)' : 'var(--text-main)' }}>{n.text}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Install app (PWA) — shows only when installable and not already installed */}
            {showInstall && (
              <button
                onClick={handleInstall}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.35rem',
                  background: 'var(--brand-primary)', border: '1px solid var(--brand-primary)',
                  cursor: 'pointer', transition: 'all var(--t-fast)', color: '#fff',
                  fontSize: '0.83rem', fontWeight: 600,
                }}
              >
                <Download size={16} /> تثبيت التطبيق
              </button>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.35rem',
                background: 'var(--bg-main)', border: '1px solid var(--border-soft)',
                cursor: 'pointer', transition: 'all var(--t-fast)', color: 'var(--text-main)',
                fontSize: '0.83rem', fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.background = 'var(--brand-primary-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-main)'; }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'الوضع المضيء' : 'الوضع الداكن'}
              </span>
              {/* Toggle pill */}
              <div style={{
                width: 36, height: 20, borderRadius: 99, position: 'relative',
                background: theme === 'dark' ? 'var(--brand-primary)' : 'var(--border-medium)',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 2,
                  right: theme === 'dark' ? 2 : 'auto',
                  left: theme === 'dark' ? 'auto' : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </button>

            {/* Profile */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem',
                  padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-main)', border: '1px solid var(--border-soft)',
                  cursor: 'pointer', transition: 'all var(--t-fast)',
                  marginTop: '0.5rem',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-brand)'; e.currentTarget.style.background = 'var(--brand-primary-soft)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-main)'; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', background: avatarBg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {initials(user?.name)}
                </div>
                <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                  <div style={{ fontSize: '0.83rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {roleLabel(user?.role)}
                  </div>
                </div>
                <ChevronDown size={14} color="var(--text-faint)" style={{ transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform var(--t-fast)', flexShrink: 0 }} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    style={{
                      position: 'absolute', bottom: '110%', left: 0, right: 0,
                      background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-soft)',
                      zIndex: 200, overflow: 'hidden', padding: '0.35rem',
                    }}
                  >
                    <button
                      className="btn-ghost"
                      onClick={logout}
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 0.75rem', color: 'var(--danger)', height: 'auto' }}
                    >
                      <LogOut size={15} />
                      <span>تسجيل الخروج</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="content-area" style={{ padding: 0 }}>
        {children}
      </main>

      {/* ── PWA status: offline, new version, iOS install ───── */}
      {!online && (
        <div className="pwa-offline" role="status">
          <WifiOff size={15} />
          <span>لا يوجد اتصال — سيتم التحديث تلقائياً عند عودة الإنترنت</span>
        </div>
      )}

      {updateReady && (
        <div className="pwa-toast" role="status">
          <RefreshCw size={17} />
          <span>نسخة جديدة من التطبيق جاهزة</span>
          <button onClick={() => window.location.reload()}>تحديث</button>
        </div>
      )}

      <AnimatePresence>
        {iosHintOpen && (
          <>
            <motion.div
              className="sidebar-overlay ios-hint-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeIosHint}
            />
            <motion.div
              className="ios-install-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="sheet-grabber" aria-hidden="true" />
              <img src="/icons/icon-192.png" alt="" className="ios-install-icon" />
              <h3>ثبّت VAYRO على الشاشة الرئيسية</h3>
              <p>تجربة تطبيق كاملة، بملء الشاشة وبدون شريط المتصفح.</p>
              <ol>
                <li><span className="ios-step"><Share size={16} /></span> اضغط زر المشاركة في الأسفل</li>
                <li><span className="ios-step"><PlusSquare size={16} /></span> اختر «إضافة إلى الشاشة الرئيسية»</li>
              </ol>
              <button className="btn-primary" style={{ width: '100%' }} onClick={closeIosHint}>فهمت</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
