import { useEffect, useState } from 'react';

/** True on phone-sized screens; kept in sync with the same breakpoint the CSS uses. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

/**
 * Publishes the on-screen keyboard height as the CSS variable `--kb`.
 *
 * On phones the keyboard covers the bottom of the page instead of resizing it, which is
 * what makes web chat apps feel wrong — the composer disappears under the keyboard. The
 * visual viewport reports the covered height, and the composer pads itself by it.
 */
export function useKeyboardInset(enabled = true) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;

    const apply = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--kb', `${Math.round(inset)}px`);
    };

    apply();
    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    return () => {
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
      document.documentElement.style.setProperty('--kb', '0px');
    };
  }, [enabled]);
}

/** Short haptic tick where the device supports it. Silently ignored elsewhere (iOS). */
export function haptic(pattern: number | number[] = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // vibration blocked or unsupported
  }
}
