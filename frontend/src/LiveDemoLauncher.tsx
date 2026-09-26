import { ArrowUpLeft, ArrowUpRight, Play } from 'lucide-react';
import './live-demo-launcher.css';

const labels: Record<string, { title: string; kicker: string }> = {
  ar: { title: 'جرّب VAYRO بنفسك', kicker: 'LIVE DEMO' },
  en: { title: 'Try VAYRO yourself', kicker: 'LIVE DEMO' },
  tr: { title: 'VAYRO’yu kendin deneyin', kicker: 'LIVE DEMO' },
  fr: { title: 'Essayez VAYRO vous-même', kicker: 'LIVE DEMO' },
};

let demoPrefetch: Promise<unknown> | null = null;

function prefetchDemo() {
  if (demoPrefetch) return;
  demoPrefetch = Promise.all([
    import('./LiveDemoShell'),
    import('./live-demo-v2.css'),
  ]).catch(() => {
    demoPrefetch = null;
  });
}

export function LiveDemoLauncher() {
  const language = window.location.pathname.split('/').filter(Boolean)[0] || 'ar';
  const lang = labels[language] ? language : 'ar';
  const isRtl = lang === 'ar';
  const DirectionIcon = isRtl ? ArrowUpLeft : ArrowUpRight;

  return (
    <a
      className="live-demo-launcher"
      href={`/${lang}/demo`}
      aria-label={labels[lang].title}
      onMouseEnter={prefetchDemo}
      onFocus={prefetchDemo}
      onTouchStart={prefetchDemo}
    >
      <span className="live-demo-launcher-play" aria-hidden="true">
        <Play size={17} fill="currentColor" />
      </span>
      <span className="live-demo-launcher-copy">
        <small><i />{labels[lang].kicker}</small>
        <strong>{labels[lang].title}</strong>
      </span>
      <DirectionIcon className="live-demo-launcher-arrow" size={17} aria-hidden="true" />
    </a>
  );
}
