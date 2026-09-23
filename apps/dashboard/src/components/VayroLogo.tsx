/**
 * VAYRO brand marks, drawn as vectors so they stay crisp at any size and follow the
 * theme (the wordmark flips to white on dark surfaces).
 *
 * - <VayroMark />: the "V" with the orange brand dot — used as the app/square mark.
 * - <VayroLogo />: mark + wordmark, optionally with the tagline underneath.
 */

import { useEffect, useState } from 'react';

const ORANGE = '#F59E0B';

export function VayroMark({ size = 36, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: onDark ? 'transparent' : 'var(--brand-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 512 512" width={size * 0.62} height={size * 0.62} aria-hidden="true">
        <path
          d="M128 150 L186 150 L256 322 L326 150 L384 150 L288 386 L224 386 Z"
          fill={onDark ? 'var(--brand-primary)' : '#FFFFFF'}
        />
        <circle cx="256" cy="228" r="34" fill={ORANGE} />
      </svg>
    </span>
  );
}

export function VayroLogo({
  height = 26,
  withTagline = false,
  color,
}: {
  height?: number;
  withTagline?: boolean;
  color?: string;
}) {
  const textColor = color || 'var(--brand-primary)';
  const [officialLogoFailed, setOfficialLogoFailed] = useState(false);
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );

  // The delivered wordmark is dark green, so dark surfaces get the white version.
  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() =>
      setIsDark(target.getAttribute('data-theme') === 'dark'),
    );
    observer.observe(target, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // The official artwork, with the drawn wordmark below as a fallback if it is missing.
  if (!officialLogoFailed) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <img
          src={isDark ? '/brand/vayro-logo-white.png' : '/brand/vayro-logo.png'}
          alt="VAYRO"
          height={height}
          style={{ height, width: 'auto', display: 'block' }}
          onError={() => setOfficialLogoFailed(true)}
        />
        {withTagline && (
          <span style={{ fontSize: height * 0.26, letterSpacing: '0.18em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            تواصل أذكى لأعمال أكبر
          </span>
        )}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <svg
        viewBox="0 0 300 64"
        height={height}
        role="img"
        aria-label="VAYRO"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <text
          x="0"
          y="50"
          fill={textColor}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: '54px',
            letterSpacing: '2px',
          }}
        >
          VAYRO
        </text>
        {/* The brand dot sits in the notch of the A, as in the identity sheet. */}
        <circle cx="74" cy="44" r="7" fill={ORANGE} />
      </svg>
      {withTagline && (
        <span
          style={{
            fontSize: height * 0.26,
            letterSpacing: '0.18em',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          تواصل أذكى لأعمال أكبر
        </span>
      )}
    </span>
  );
}
