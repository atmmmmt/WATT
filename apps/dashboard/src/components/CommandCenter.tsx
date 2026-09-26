import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  Command,
  FileText,
  Globe2,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Network,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { can, Permission } from '../lib/permissions';
import { haptic } from '../lib/mobile';

type CommandItem = {
  path: string;
  title: string;
  subtitle: string;
  group: string;
  keywords: string;
  icon: LucideIcon;
  visible: boolean;
};

const RECENT_KEY = 'vayro-command-recent-v1';

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function writeRecent(paths: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(paths.slice(0, 5))); } catch { /* ignore storage errors */ }
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('ar')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

export function CommandCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentPaths, setRecentPaths] = useState<string[]>(readRecent);

  const role = user?.role || '';
  const products = user?.enabledProducts || [];
  const isSuper = role === 'super_admin';
  const isTenant = role === 'tenant_admin';
  const hasOtp = isSuper || products.includes('otp');
  const hasHr = isSuper || products.includes('hr');
  const hasSupport = isSuper || products.includes('support');
  const hasRelay = isSuper || products.includes('doctor_relay');
  const hrRole = ['super_admin', 'tenant_admin', 'hr_manager', 'recruiter'].includes(role);
  const supportRole = ['super_admin', 'tenant_admin', 'admin', 'supervisor', 'agent'].includes(role);
  const supportManager = ['super_admin', 'tenant_admin', 'admin'].includes(role);
  const supportReports = ['super_admin', 'tenant_admin', 'admin', 'supervisor'].includes(role);

  const items = useMemo<CommandItem[]>(() => [
    { path: '/', title: 'نظرة عامة', subtitle: 'ملخص المنصة والأرقام الرئيسية', group: 'المنصة', keywords: 'dashboard overview home رئيسية احصائيات', icon: LayoutDashboard, visible: isSuper },
    { path: '/home', title: 'لوحة التحكم', subtitle: 'الرئيسية الخاصة بشركتك', group: 'الرئيسية', keywords: 'home dashboard رئيسية', icon: LayoutDashboard, visible: isTenant },
    { path: '/tenants', title: 'العملاء', subtitle: 'إدارة الشركات والاشتراكات', group: 'إدارة المنصة', keywords: 'customers tenants clients شركات زبائن', icon: Users, visible: isSuper },
    { path: '/packages', title: 'الباقات والأسعار', subtitle: 'الخدمات والتسعير المتاح للعملاء', group: 'إدارة المنصة', keywords: 'plans pricing packages اسعار باقات', icon: Package, visible: isSuper },
    { path: '/finance', title: 'المالية والسحوبات', subtitle: 'الإيرادات والحركة المالية', group: 'إدارة المنصة', keywords: 'finance money revenue مالية ارباح سحوبات', icon: Wallet, visible: isSuper },
    { path: '/landing-editor', title: 'صفحة الهبوط', subtitle: 'تعديل محتوى موقع VAYRO', group: 'إدارة المنصة', keywords: 'landing website موقع صفحة الهبوط', icon: Globe2, visible: isSuper },
    { path: '/landing-orders', title: 'طلبات الموقع', subtitle: 'طلبات العملاء القادمة من صفحة الهبوط', group: 'إدارة المنصة', keywords: 'orders leads طلبات موقع', icon: FileText, visible: isSuper },
    { path: '/server-status', title: 'حالة السيرفر', subtitle: 'الموارد والأداء والحالة التشغيلية', group: 'النظام', keywords: 'server cpu ram memory status سيرفر حالة اداء', icon: Activity, visible: isSuper },

    { path: '/otp/workspace', title: 'OTP Workspace', subtitle: 'إعداد وتشغيل خدمة رموز التحقق', group: 'OTP', keywords: 'otp workspace تحقق رمز api', icon: KeyRound, visible: hasOtp && ['super_admin', 'tenant_admin'].includes(role) },
    { path: '/otp-logs', title: 'سجل OTP', subtitle: 'الرسائل والمحاولات الأخيرة', group: 'OTP', keywords: 'otp logs history سجل رسائل', icon: Clock3, visible: hasOtp && ['super_admin', 'tenant_admin'].includes(role) },
    { path: '/otp/templates', title: 'قوالب OTP', subtitle: 'قوالب رسائل التحقق', group: 'OTP', keywords: 'otp templates قوالب رسائل', icon: FileText, visible: hasOtp && ['super_admin', 'tenant_admin'].includes(role) },
    { path: '/api-keys', title: 'مفاتيح API', subtitle: 'إدارة مفاتيح الربط للمطورين', group: 'OTP', keywords: 'api keys developer مفتاح مطور', icon: KeyRound, visible: hasOtp && ['super_admin', 'tenant_admin'].includes(role) },

    { path: '/support/inbox', title: 'صندوق الوارد', subtitle: 'محادثات العملاء وفريق الدعم', group: 'الدعم', keywords: 'inbox whatsapp chat messages صندوق وارد محادثات', icon: MessageSquare, visible: hasSupport && supportRole },
    { path: '/support/connection', title: 'ربط واتساب', subtitle: 'اتصال رقم الشركة وجلسة واتساب', group: 'الدعم', keywords: 'whatsapp qr connect اتصال ربط واتساب', icon: Network, visible: hasSupport && supportManager },
    { path: '/support/employees', title: 'فريق الدعم', subtitle: 'الموظفون والصلاحيات', group: 'الدعم', keywords: 'employees agents team موظفين فريق', icon: Users, visible: hasSupport && supportManager },
    { path: '/support/reports', title: 'تحليلات الدعم', subtitle: 'الأداء والردود والمحادثات', group: 'الدعم', keywords: 'reports analytics تقارير تحليلات دعم', icon: BarChart3, visible: hasSupport && supportReports },
    { path: '/support/settings', title: 'إعدادات الدعم', subtitle: 'إعدادات صندوق الوارد والتشغيل', group: 'الدعم', keywords: 'settings support اعدادات دعم', icon: Settings, visible: hasSupport && supportManager },

    { path: '/hr', title: 'إدارة التوظيف', subtitle: 'نظرة عامة على رحلة المرشحين', group: 'التوظيف', keywords: 'hr recruiting توظيف مرشحين', icon: BriefcaseBusiness, visible: hasHr && hrRole },
    { path: '/hr/jobs', title: 'الوظائف النشطة', subtitle: 'إدارة الوظائف وفرص التقديم', group: 'التوظيف', keywords: 'jobs careers وظائف شاغرة', icon: BriefcaseBusiness, visible: hasHr && hrRole },
    { path: '/hr/inbox', title: 'صندوق التوظيف', subtitle: 'محادثات المرشحين والمتابعة', group: 'التوظيف', keywords: 'hr inbox candidates مرشحين محادثات', icon: MessageSquare, visible: hasHr && hrRole },
    { path: '/hr/templates', title: 'قوالب التوظيف', subtitle: 'ردود ورسائل جاهزة للمرشحين', group: 'التوظيف', keywords: 'hr templates قوالب ردود', icon: FileText, visible: hasHr && hrRole },
    { path: '/hr/reports', title: 'تقارير التوظيف', subtitle: 'مؤشرات التوظيف والأداء', group: 'التوظيف', keywords: 'hr reports analytics تقارير توظيف', icon: BarChart3, visible: hasHr && hrRole },

    { path: '/doctor-relay/links', title: 'روابط الخصوصية', subtitle: 'توجيه التواصل بين الأطراف بخصوصية', group: 'الخصوصية', keywords: 'privacy relay doctor links خصوصية توجيه دكتور', icon: ShieldCheck, visible: hasRelay && can(user, Permission.ROUTING_LINKS_VIEW) },
  ].filter(item => item.visible), [hasHr, hasOtp, hasRelay, hasSupport, hrRole, isSuper, isTenant, role, supportManager, supportReports, supportRole, user]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(value => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const matched = items
      .slice()
      .sort((a, b) => b.path.length - a.path.length)
      .find(item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)));
    if (!matched) return;
    setRecentPaths(previous => {
      const next = [matched.path, ...previous.filter(path => path !== matched.path)].slice(0, 5);
      writeRecent(next);
      return next;
    });
  }, [items, location.pathname]);

  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return items;
    return items.filter(item => normalizeSearch(`${item.title} ${item.subtitle} ${item.group} ${item.keywords}`).includes(normalized));
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const recent = recentPaths.map(path => items.find(item => item.path === path)).filter((item): item is CommandItem => !!item);
  const displayItems = query ? filtered : [...recent, ...items.filter(item => !recent.some(recentItem => recentItem.path === item.path))];

  const go = (item: CommandItem) => {
    haptic();
    setOpen(false);
    navigate(item.path);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, displayItems.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && displayItems[activeIndex]) {
      event.preventDefault();
      go(displayItems[activeIndex]);
    }
  };

  return (
    <>
      <button className="vayro-command-launcher" onClick={() => setOpen(true)} aria-label="فتح البحث السريع">
        <Search size={18} />
        <span>بحث سريع</span>
        <kbd>⌘ K</kbd>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="vayro-command-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}
          >
            <motion.section
              className="vayro-command-panel"
              role="dialog"
              aria-modal="true"
              aria-label="مركز أوامر VAYRO"
              initial={{ opacity: 0, y: -14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="vayro-command-head">
                <div className="vayro-command-brand"><Sparkles size={17} /><span>VAYRO Command</span></div>
                <button onClick={() => setOpen(false)} aria-label="إغلاق"><X size={18} /></button>
              </header>

              <div className="vayro-command-search">
                <Search size={20} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="ابحث عن صفحة، خدمة أو إجراء..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd>ESC</kbd>
              </div>

              <div className="vayro-command-body">
                {!query && recent.length ? <div className="vayro-command-section-label">الأخيرة</div> : null}
                {displayItems.length ? displayItems.map((item, index) => {
                  const Icon = item.icon;
                  const showSection = !query && recent.length > 0 && index === recent.length;
                  return (
                    <div key={item.path}>
                      {showSection ? <div className="vayro-command-section-label">كل الأقسام</div> : null}
                      <button
                        className={`vayro-command-item ${index === activeIndex ? 'is-active' : ''}`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(item)}
                      >
                        <span className="vayro-command-icon"><Icon size={19} /></span>
                        <span className="vayro-command-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                        <span className="vayro-command-group">{item.group}</span>
                      </button>
                    </div>
                  );
                }) : (
                  <div className="vayro-command-empty">
                    <Search size={30} />
                    <strong>ما لقينا نتيجة</strong>
                    <span>جرّب كلمة ثانية مثل “واتساب”، “OTP” أو “العملاء”.</span>
                  </div>
                )}
              </div>

              <footer className="vayro-command-footer">
                <span><kbd>↑</kbd><kbd>↓</kbd> تنقّل</span>
                <span><kbd>↵</kbd> فتح</span>
                <span className="vayro-command-powered"><Command size={13} /> VAYRO</span>
              </footer>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
