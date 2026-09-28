import { MouseEvent, useEffect, useState } from 'react';
import { LiveDemo } from './LiveDemo';
import { MobileLiveDemo } from './MobileLiveDemo';

/**
 * The public demo has a dedicated phone-first experience. Desktop keeps the rich
 * showcase while phones get a guided, touch-first flow that explains what to do.
 * Links leaving the demo use full-document navigation because the entrypoint is
 * selected once at boot time.
 */
export function LiveDemoShell() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => setMobile(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  function handleNavigationCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest<HTMLAnchorElement>(
      'a.demo-brand, a.demo-nav-link, a.demo-final-button, a.mlive-back, a.mlive-cta a',
    );

    if (!anchor) return;
    const href = anchor.href;
    if (!href) return;

    event.preventDefault();
    event.stopPropagation();
    window.location.assign(href);
  }

  return (
    <div onClickCapture={handleNavigationCapture}>
      {mobile ? <MobileLiveDemo /> : <LiveDemo />}
    </div>
  );
}
