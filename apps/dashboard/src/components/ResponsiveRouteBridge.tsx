import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, UserRound } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { haptic } from '../lib/mobile';

type HrView = 'list' | 'thread' | 'profile';

function routeSlug(pathname: string) {
  if (pathname === '/') return 'dashboard';
  return pathname.replace(/^\/+/, '').replace(/\/+$/, '').replaceAll('/', '-') || 'dashboard';
}

/**
 * Mobile-only bridge for pages that were originally authored as desktop workspaces.
 * It also stamps the active route on <body> so responsive CSS can provide targeted,
 * maintainable polish without coupling every page to viewport checks.
 */
export function ResponsiveRouteBridge() {
  const location = useLocation();
  const [topbarBrand, setTopbarBrand] = useState<HTMLElement | null>(null);
  const [topbarActions, setTopbarActions] = useState<HTMLElement | null>(null);
  const [hrView, setHrView] = useState<HrView>('list');
  const isHrInbox = location.pathname === '/hr/inbox';

  useEffect(() => {
    document.body.dataset.vayroRoute = routeSlug(location.pathname);
    return () => {
      delete document.body.dataset.vayroRoute;
    };
  }, [location.pathname]);

  useEffect(() => {
    setHrView('list');
    document.body.dataset.hrMobileView = 'list';
  }, [location.pathname]);

  useEffect(() => {
    document.body.dataset.hrMobileView = hrView;
    document.body.classList.toggle('hr-inbox-open', isHrInbox && hrView !== 'list');
    return () => document.body.classList.remove('hr-inbox-open');
  }, [hrView, isHrInbox]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    if (!media.matches) {
      setTopbarBrand(null);
      setTopbarActions(null);
      return;
    }

    let frame = 0;
    const find = () => {
      const brand = document.querySelector<HTMLElement>('.mobile-topbar-brand');
      const actions = document.querySelector<HTMLElement>('.mobile-topbar-actions');
      if (brand && actions) {
        setTopbarBrand(brand);
        setTopbarActions(actions);
        return;
      }
      frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  // HR Inbox was authored as three fixed desktop panes. On phones we keep the existing
  // data/state, but turn those panes into native-like screens without duplicating logic.
  useEffect(() => {
    if (!isHrInbox) return;
    const media = window.matchMedia('(max-width: 768px)');
    if (!media.matches) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    let frame = 0;

    const wire = () => {
      if (disposed) return;
      const content = document.querySelector<HTMLElement>('.content-area');
      const shell = content?.querySelector<HTMLElement>('div[style*="height: calc(100vh - 64px)"]');
      if (!shell || shell.children.length < 3) {
        frame = requestAnimationFrame(wire);
        return;
      }

      shell.classList.add('hr-mobile-shell');
      const candidates = shell.children[0] as HTMLElement;
      const thread = shell.children[1] as HTMLElement;
      const profile = shell.children[2] as HTMLElement;
      candidates.classList.add('hr-mobile-candidates');
      thread.classList.add('hr-mobile-thread');
      profile.classList.add('hr-mobile-profile');

      const onCandidateClick = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const row = target.closest<HTMLElement>('.hr-mobile-candidates > div:last-child > div');
        if (!row || !candidates.contains(row)) return;
        // Empty/loading states are not interactive candidates.
        if (!row.getAttribute('style')?.includes('cursor: pointer')) return;
        haptic();
        setHrView('thread');
      };
      candidates.addEventListener('click', onCandidateClick, true);
      cleanup = () => candidates.removeEventListener('click', onCandidateClick, true);
    };

    wire();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [isHrInbox]);

  const showHrBack = isHrInbox && hrView !== 'list' && topbarBrand;
  const showHrProfile = isHrInbox && hrView === 'thread' && topbarActions;

  const hrBack = useMemo(() => (
    <button
      type="button"
      className="mobile-global-back hr-mobile-back"
      onClick={() => {
        haptic();
        setHrView((view) => view === 'profile' ? 'thread' : 'list');
      }}
      aria-label="رجوع"
      title="رجوع"
    >
      <ChevronRight size={22} />
    </button>
  ), []);

  const hrProfile = useMemo(() => (
    <button
      type="button"
      className="mobile-icon-btn hr-mobile-profile-btn"
      onClick={() => {
        haptic();
        setHrView('profile');
      }}
      aria-label="تفاصيل المرشح"
      title="تفاصيل المرشح"
    >
      <UserRound size={19} />
    </button>
  ), []);

  return (
    <>
      {showHrBack && createPortal(hrBack, topbarBrand!)}
      {showHrProfile && createPortal(hrProfile, topbarActions!)}
    </>
  );
}
