import { Play, Sparkles } from 'lucide-react';

const labels: Record<string, string> = {
  ar: 'جرّب VAYRO مباشرة',
  en: 'Try VAYRO live',
  tr: 'VAYRO’yu canlı deneyin',
  fr: 'Essayez VAYRO en direct',
};

export function LiveDemoLauncher() {
  const language = window.location.pathname.split('/').filter(Boolean)[0] || 'ar';
  const lang = labels[language] ? language : 'ar';

  return (
    <a className="live-demo-launcher" href={`/${lang}/demo`} aria-label={labels[lang]}>
      <span className="live-demo-launcher-pulse"><i /></span>
      <span className="live-demo-launcher-copy">
        <small><Sparkles size={12} /> LIVE EXPERIENCE</small>
        <strong>{labels[lang]}</strong>
      </span>
      <span className="live-demo-launcher-play"><Play size={17} fill="currentColor" /></span>
    </a>
  );
}
