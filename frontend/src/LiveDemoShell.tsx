import { MouseEvent } from 'react';
import { LiveDemo } from './LiveDemo';

/**
 * The public demo is mounted as a dedicated experience. React Router links inside the
 * demo update the URL, but the outer entrypoint is intentionally selected only once at
 * boot time. Force full-document navigation for links that leave the demo so "Back to
 * site" and the final CTA always land on the real landing page.
 */
export function LiveDemoShell() {
  function handleNavigationCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest<HTMLAnchorElement>(
      'a.demo-brand, a.demo-nav-link, a.demo-final-button',
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
      <LiveDemo />
    </div>
  );
}
