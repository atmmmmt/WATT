import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Server } from 'lucide-react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SidebarLayout } from './components/SidebarLayout';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';

// Every page used to ship in one 1.8MB bundle that had to download before anything
// rendered — painful on a phone. Each route now loads on demand; only the login screen
// and the shell are in the first download.
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const SetPasswordPage = lazy(() => import('./pages/SetPasswordPage').then(m => ({ default: m.SetPasswordPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ServerStatusPage = lazy(() => import('./pages/ServerStatusPage').then(m => ({ default: m.ServerStatusPage })));
const OtpLogsPage = lazy(() => import('./pages/OtpLogsPage').then(m => ({ default: m.OtpLogsPage })));
const HrOverviewPage = lazy(() => import('./pages/HrOverviewPage').then(m => ({ default: m.HrOverviewPage })));
const HrJobsPage = lazy(() => import('./pages/HrJobsPage').then(m => ({ default: m.HrJobsPage })));
const HrInboxPage = lazy(() => import('./pages/HrInboxPage').then(m => ({ default: m.HrInboxPage })));
const HrTemplatesPage = lazy(() => import('./pages/HrTemplatesPage').then(m => ({ default: m.HrTemplatesPage })));
const HrReportsPage = lazy(() => import('./pages/HrReportsPage').then(m => ({ default: m.HrReportsPage })));
const PublicApplyPage = lazy(() => import('./pages/PublicApplyPage').then(m => ({ default: m.PublicApplyPage })));
const SupportConnectionPage = lazy(() => import('./pages/SupportConnectionPage').then(m => ({ default: m.SupportConnectionPage })));
const SupportInboxPage = lazy(() => import('./pages/SupportInboxPage').then(m => ({ default: m.SupportInboxPage })));
const SupportEmployeesPage = lazy(() => import('./pages/SupportEmployeesPage').then(m => ({ default: m.SupportEmployeesPage })));
const SupportReportsPage = lazy(() => import('./pages/SupportReportsPage').then(m => ({ default: m.SupportReportsPage })));
const SupportSettingsPage = lazy(() => import('./pages/SupportSettingsPage').then(m => ({ default: m.SupportSettingsPage })));
const DoctorRelayLinksPage = lazy(() => import('./pages/DoctorRelayLinksPage').then(m => ({ default: m.DoctorRelayLinksPage })));
const TenantsPage = lazy(() => import('./pages/TenantsPage').then(m => ({ default: m.TenantsPage })));
const PackagesPage = lazy(() => import('./pages/PackagesPage').then(m => ({ default: m.PackagesPage })));
const FinancePage = lazy(() => import('./pages/FinancePage').then(m => ({ default: m.FinancePage })));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage').then(m => ({ default: m.ApiKeysPage })));
const OtpTemplatesPage = lazy(() => import('./pages/OtpTemplatesPage').then(m => ({ default: m.OtpTemplatesPage })));
const OtpWorkspacePage = lazy(() => import('./pages/OtpWorkspacePage').then(m => ({ default: m.OtpWorkspacePage })));
const TenantHomePage = lazy(() => import('./pages/TenantHomePage').then(m => ({ default: m.TenantHomePage })));
const LandingEditorPage = lazy(() => import('./pages/LandingEditorPage').then(m => ({ default: m.LandingEditorPage })));
const LandingOrdersPage = lazy(() => import('./pages/LandingOrdersPage').then(m => ({ default: m.LandingOrdersPage })));

function PageLoader() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', minHeight: '50vh' }}>
      <div
        className="animate-spin"
        style={{ width: 28, height: 28, border: '3px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}
      />
    </div>
  );
}

function HomePage() {
  const { user } = useAuth();

  if (user?.role === 'hr_manager') {
    return <Navigate to="/hr" replace />;
  }

  if (user?.role === 'recruiter') {
    return <Navigate to="/hr/inbox" replace />;
  }

  if (user?.role === 'tenant_admin') {
    return <Navigate to="/home" replace />;
  }

  if (user?.role === 'admin') {
    return <Navigate to="/support/inbox" replace />;
  }

  if (user?.role === 'supervisor' || user?.role === 'agent') {
    return <Navigate to="/support/inbox" replace />;
  }

  return <DashboardPage />;
}

/**
 * Keep infrastructure navigation owned by the routed shell instead of by a
 * one-off server patch. This intentionally portals into the existing sidebar
 * nav so the entry survives every production rebuild / auto deploy.
 */
function ServerStatusSidebarLink() {
  const { user } = useAuth();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setTarget(null);
      return;
    }

    let cancelled = false;
    const findNav = () => {
      if (cancelled) return;
      const nav = document.querySelector<HTMLElement>('.sidebar .nav-group');
      if (nav) setTarget(nav);
      else window.requestAnimationFrame(findNav);
    };
    findNav();
    return () => { cancelled = true; };
  }, [user?.role]);

  if (user?.role !== 'super_admin' || !target) return null;

  return createPortal(
    <div data-vayro-server-status-nav="true">
      <div className="nav-group-label">النظام</div>
      <NavLink
        to="/server-status"
        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
      >
        <Server size={18} />
        <span>حالة السيرفر</span>
      </NavLink>
    </div>,
    target,
  );
}

/** Page-to-page transition: a short fade + lift, like a native app pushing a screen. */
function RouteTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  // The inbox owns the whole screen and has its own gestures — don't animate over it.
  const isInbox = location.pathname.startsWith('/support/inbox');

  if (prefersReducedMotion || isInbox) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function AppShell() {
  return (
    <SidebarLayout>
      <ServerStatusSidebarLink />
      <Suspense fallback={<PageLoader />}>
        <RouteTransition>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/server-status" element={<ServerStatusPage />} />
          <Route path="/tenants" element={<TenantsPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/landing-editor" element={<LandingEditorPage />} />
          <Route path="/landing-orders" element={<LandingOrdersPage />} />
          <Route path="/home" element={<TenantHomePage />} />
          <Route path="/otp/workspace" element={<OtpWorkspacePage />} />
          <Route path="/otp/templates" element={<OtpTemplatesPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/otp-logs" element={<OtpLogsPage />} />
          <Route path="/hr" element={<HrOverviewPage />} />
          <Route path="/hr/jobs" element={<HrJobsPage />} />
          <Route path="/hr/inbox" element={<HrInboxPage />} />
          <Route path="/hr/templates" element={<HrTemplatesPage />} />
          <Route path="/hr/reports" element={<HrReportsPage />} />
          <Route path="/support/connection" element={<SupportConnectionPage />} />
          <Route path="/support/inbox" element={<SupportInboxPage />} />
          <Route path="/support/employees" element={<SupportEmployeesPage />} />
          <Route path="/support/reports" element={<SupportReportsPage />} />
          <Route path="/support/settings" element={<SupportSettingsPage />} />
          <Route path="/doctor-relay/links" element={<DoctorRelayLinksPage />} />
        </Routes>
        </RouteTransition>
      </Suspense>
    </SidebarLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/reset-password" element={<SetPasswordPage />} />
          <Route path="/apply/:jobSlug" element={<PublicApplyPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<AppShell />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
