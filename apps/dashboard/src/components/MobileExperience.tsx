import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, BellRing, ChevronRight, Download, ShieldCheck, Sparkles, WifiOff, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Mascot } from './Mascot';
import {
  canInstallApp,
  isIosSafari,
  isStandalone,
  onInstallAvailabilityChange,
  promptInstall,
} from '../lib/pwa';
import { haptic } from '../lib/mobile';

type NotificationPermissionState = NotificationPermission | 'unsupported';

function isPhoneViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

function readFlag(key: string) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

function writeFlag(key: string) {
  try { localStorage.setItem(key, '1'); } catch { /* ignore storage failures */ }
}

function notificationState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function MobileExperience() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(isPhoneViewport);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(notificationState);
  const [canInstall, setCanInstall] = useState(canInstallApp());
  const [topbarBrand, setTopbarBrand] = useState<HTMLElement | null>(null);
  const [topbarActions, setTopbarActions] = useState<HTMLElement | null>(null);
  const installed = isStandalone();
  const iosSafari = isIosSafari();

  const userKey = String((user as any)?.id || (user as any)?._id || user?.email || user?.name || 'user');
  const welcomeKey = `vayro-mobile-welcome-v3:${userKey}`;

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    setCanInstall(canInstallApp());
    return onInstallAvailabilityChange(setCanInstall);
  }, []);

  useEffect(() => {
    if (!mobile || !user || readFlag(welcomeKey)) return;
    const timer = window.setTimeout(() => setWelcomeOpen(true), 450);
    return () => window.clearTimeout(timer);
  }, [mobile, user, welcomeKey]);

  // The mobile shell is rendered by SidebarLayout. Portals let this layer enhance it
  // without duplicating navigation logic in every individual page.
  useEffect(() => {
    if (!mobile) {
      setTopbarBrand(null);
      setTopbarActions(null);
      return;
    }
    let raf = 0;
    const find = () => {
      const brand = document.querySelector<HTMLElement>('.mobile-topbar-brand');
      const actions = document.querySelector<HTMLElement>('.mobile-topbar-actions');
      if (brand && actions) {
        setTopbarBrand(brand);
        setTopbarActions(actions);
        return;
      }
      raf = window.requestAnimationFrame(find);
    };
    find();
    return () => window.cancelAnimationFrame(raf);
  }, [mobile, location.pathname]);

  // Warm the route chunks people are most likely to open next. The service worker then
  // keeps those immutable Vite assets cached, making the installed PWA feel instant.
  useEffect(() => {
    if (!user) return;
    const products = user.enabledProducts || [];
    const run = () => {
      if (user.role === 'super_admin') {
        void import('../pages/DashboardPage');
        void import('../pages/TenantsPage');
      } else {
        void import('../pages/TenantHomePage');
      }
      if (user.role === 'super_admin' || products.includes('support')) {
        void import('../pages/SupportInboxPage');
      }
      if (user.role === 'super_admin' || products.includes('hr')) {
        void import('../pages/HrInboxPage');
      }
      if (user.role === 'super_admin' || products.includes('otp')) {
        void import('../pages/OtpLogsPage');
      }
    };
    const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(run, { timeout: 2500 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 900);
    return () => window.clearTimeout(id);
  }, [user]);

  const mainPaths = useMemo(() => new Set([
    '/', '/home', '/support/inbox', '/hr', '/hr/inbox', '/tenants', '/otp-logs',
    '/support/reports', '/finance', '/doctor-relay/links',
  ]), []);
  const showGlobalBack = mobile && !mainPaths.has(location.pathname);

  const defaultHome = () => {
    if (user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'agent') return '/support/inbox';
    if (user?.role === 'hr_manager') return '/hr';
    if (user?.role === 'recruiter') return '/hr/inbox';
    if (user?.role === 'tenant_admin') return '/home';
    return '/';
  };

  const goBack = () => {
    haptic();
    if (window.history.length > 1) navigate(-1);
    else navigate(defaultHome(), { replace: true });
  };

  const enableNotifications = async () => {
    haptic();
    if (!('Notification' in window)) {
      setNotifPermission('unsupported');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
    } catch {
      setNotifPermission(Notification.permission);
    }
  };

  const installApp = async () => {
    haptic();
    if (iosSafari) {
      // SidebarLayout already owns the detailed iOS install sheet. The onboarding text
      // below explains the same native Share → Add to Home Screen path without fake UI.
      return;
    }
    await promptInstall();
    setCanInstall(canInstallApp());
  };

  const finishWelcome = () => {
    writeFlag(welcomeKey);
    setWelcomeOpen(false);
    setWelcomeStep(0);
  };

  const nextWelcome = () => {
    haptic();
    if (welcomeStep >= 2) finishWelcome();
    else setWelcomeStep((s) => s + 1);
  };

  const notificationButton = notifPermission === 'default' ? (
    <button className="mobile-notification-btn" onClick={enableNotifications} aria-label="تفعيل الإشعارات" title="تفعيل الإشعارات">
      <Bell size={18} />
      <span className="mobile-notification-dot" />
    </button>
  ) : notifPermission === 'granted' ? (
    <button className="mobile-notification-btn is-enabled" aria-label="الإشعارات مفعلة" title="الإشعارات مفعلة">
      <BellRing size={18} />
    </button>
  ) : null;

  return (
    <>
      {topbarBrand && showGlobalBack && createPortal(
        <button className="mobile-global-back" onClick={goBack} aria-label="رجوع">
          <ChevronRight size={22} />
        </button>,
        topbarBrand,
      )}

      {topbarActions && notificationButton && createPortal(notificationButton, topbarActions)}

      {welcomeOpen && mobile && createPortal(
        <div className="mobile-welcome-overlay" role="dialog" aria-modal="true" aria-label="مرحباً بك في VAYRO">
          <div className="mobile-welcome-sheet">
            <button className="mobile-welcome-close" onClick={finishWelcome} aria-label="إغلاق"><X size={19} /></button>

            <div className="mobile-welcome-progress" aria-hidden="true">
              {[0, 1, 2].map((i) => <span key={i} className={i <= welcomeStep ? 'active' : ''} />)}
            </div>

            {welcomeStep === 0 && (
              <div className="mobile-welcome-content">
                <Mascot pose="idle" size={132} />
                <span className="mobile-welcome-kicker"><Sparkles size={14} /> VAYRO MOBILE</span>
                <h2>أهلاً {user?.name ? `، ${user.name}` : 'بك'} 👋</h2>
                <p>جهزنا لك تجربة موبايل أقرب لتطبيق حقيقي: تنقل سريع، شاشات كاملة، دعم للوضع دون اتصال، وتحديثات تلقائية.</p>
              </div>
            )}

            {welcomeStep === 1 && (
              <div className="mobile-welcome-content">
                <div className="mobile-welcome-feature-icon"><BellRing size={32} /></div>
                <span className="mobile-welcome-kicker">إشعارات الرسائل</span>
                <h2>لا تفوّت رسالة عميل</h2>
                <p>فعّل الإشعارات حتى ينبهك VAYRO عند وصول رسائل جديدة أثناء استخدام التطبيق أو وجوده بالخلفية.</p>
                {notifPermission === 'default' && (
                  <button className="mobile-welcome-secondary" onClick={enableNotifications}><Bell size={17} /> تفعيل الإشعارات</button>
                )}
                {notifPermission === 'granted' && <div className="mobile-welcome-success"><ShieldCheck size={17} /> الإشعارات مفعّلة</div>}
                {notifPermission === 'denied' && <div className="mobile-welcome-muted">الإشعارات موقوفة من إعدادات المتصفح ويمكن تفعيلها لاحقاً.</div>}
              </div>
            )}

            {welcomeStep === 2 && (
              <div className="mobile-welcome-content">
                <div className="mobile-welcome-feature-icon"><Download size={32} /></div>
                <span className="mobile-welcome-kicker">تطبيق أسرع</span>
                <h2>{installed ? 'VAYRO جاهز كتطبيق' : 'ثبّت VAYRO على جهازك'}</h2>
                <p>
                  {installed
                    ? 'النسخة المثبتة تستخدم كاش آمن للواجهة والملفات الثابتة، بينما البيانات الحية تبقى دائماً من السيرفر.'
                    : iosSafari
                      ? 'على iPhone: اضغط مشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية». بعدها يفتح VAYRO بملء الشاشة.'
                      : 'ثبّت التطبيق لتفتح VAYRO بملء الشاشة وتستفيد من تحميل أسرع وواجهة أقرب للتطبيقات الأصلية.'}
                </p>
                {!installed && canInstall && !iosSafari && (
                  <button className="mobile-welcome-secondary" onClick={installApp}><Download size={17} /> تثبيت الآن</button>
                )}
                <div className="mobile-welcome-cache-note"><WifiOff size={16} /> لا نخزّن بيانات العملاء أو الرسائل الحية كنسخ قديمة؛ الكاش مخصص للواجهة والملفات الثابتة.</div>
              </div>
            )}

            <button className="mobile-welcome-primary" onClick={nextWelcome}>
              {welcomeStep >= 2 ? 'ابدأ استخدام VAYRO' : 'متابعة'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
