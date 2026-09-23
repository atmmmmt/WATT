import { useEffect, useRef, useState } from 'react';

/**
 * VAYRO's mascot — the official 3D character, animated in the browser.
 *
 * Every pose is a still render from the character sheet (`public/mascot/*.webp`), so the
 * "animation" is built from four layers that together read as a living character:
 *   1. idle float + breathing, with a ground shadow that shrinks as it rises
 *   2. a parallax tilt toward the pointer, which gives the flat render depth
 *   3. cross-fades between poses (never a hard swap)
 *   4. an ambient loop that occasionally plays a pose, plus reactions to hover/tap
 *
 * All artwork is the project's own; nothing is loaded from a third party.
 */

export type MascotPose =
  | 'idle' | 'front' | 'wave' | 'thumbs' | 'working'
  | 'phone' | 'pointing' | 'walking' | 'celebrate';

const AMBIENT_POSES: MascotPose[] = ['wave'];

const POSE_SOURCE: Record<MascotPose, string> = {
  idle: '/mascot/idle.webp',
  front: '/mascot/front.webp',
  wave: '/mascot/hero-wave.webp',
  thumbs: '/mascot/thumbs.webp',
  working: '/mascot/working.webp',
  phone: '/mascot/phone.webp',
  pointing: '/mascot/pointing.webp',
  walking: '/mascot/walking.webp',
  celebrate: '/mascot/celebrate.webp',
};

/**
 * Native pixel height of each pose as delivered on the character sheet. Displaying a
 * pose larger than this is what made the mascot look pixelated, so the component clamps
 * to it. Replace the files with higher-resolution exports and raise these numbers.
 */
const NATIVE_HEIGHT: Record<MascotPose, number> = {
  idle: 370, front: 363, wave: 1024, thumbs: 179, working: 181,
  phone: 179, pointing: 181, walking: 177, celebrate: 166,
};

/** The tallest size a pose can be shown at while staying sharp on 2x screens. */
function maxSharpHeight(pose: MascotPose) {
  return Math.round(NATIVE_HEIGHT[pose] * 0.75);
}

interface MascotProps {
  /** The pose it returns to between reactions. */
  pose?: MascotPose;
  /** Rendered height in px; the width follows the artwork. */
  size?: number;
  /** Play a friendly pose now and then while idling. */
  ambient?: boolean;
  /** React to hover (desktop) and tap (touch). */
  interactive?: boolean;
  className?: string;
  alt?: string;
  /** Load immediately when the mascot is visible above the fold. */
  priority?: boolean;
}

export function Mascot({
  pose = 'idle',
  size = 260,
  ambient = true,
  interactive = true,
  className = '',
  alt = 'مساعد VAYRO',
  priority = false,
}: MascotProps) {
  const [active, setActive] = useState<MascotPose>(pose);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const revertRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setActive(pose), [pose]);

  /** Shows a pose, then returns to the resting one. */
  const playPose = (next: MascotPose, holdMs = 2200) => {
    if (revertRef.current) clearTimeout(revertRef.current);
    setActive(next);
    revertRef.current = setTimeout(() => setActive(pose), holdMs);
  };

  // Ambient life: a short greeting every ~9-15s, paused when the tab is hidden so it
  // never animates (or burns battery) in the background.
  useEffect(() => {
    if (!ambient) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!document.hidden) {
          playPose(AMBIENT_POSES[Math.floor(Math.random() * AMBIENT_POSES.length)]);
        }
        schedule();
      }, 9000 + Math.random() * 6000);
    };
    schedule();
    return () => clearTimeout(timer);
    // playPose closes over `pose`, which is stable for a mounted mascot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, pose]);

  // Pointer parallax — a few degrees only; more makes a flat render look skewed.
  useEffect(() => {
    if (!interactive) return;
    const el = wrapRef.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
        const dy = (event.clientY - (rect.top + rect.height / 2)) / window.innerHeight;
        el.style.setProperty('--tilt-y', `${Math.max(-10, Math.min(10, dx * 20))}deg`);
        el.style.setProperty('--tilt-x', `${Math.max(-7, Math.min(7, -dy * 14))}deg`);
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [interactive]);

  useEffect(() => () => { if (revertRef.current) clearTimeout(revertRef.current); }, []);

  if (failed) return null;

  // Both layers stay mounted so the browser keeps the decoded frames and the cross-fade
  // has nothing to load mid-transition.
  const poses: MascotPose[] = Array.from(new Set([pose, active]));
  // Never blow a pose up past its delivered resolution.
  const height = Math.min(size, maxSharpHeight(pose));

  return (
    <div
      ref={wrapRef}
      className={`mascot${interactive ? ' is-interactive' : ''} ${className}`}
      style={{ height }}
      onPointerEnter={interactive ? () => playPose('wave') : undefined}
      onClick={interactive ? () => playPose('wave', 1800) : undefined}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
    >
      <div className="mascot-shadow" aria-hidden="true" />
      <div className="mascot-stage">
        {poses.map((name) => (
          <img
            key={name}
            src={POSE_SOURCE[name]}
            alt=""
            className={`mascot-img${name === active ? ' is-active' : ''}`}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onError={() => { if (name === 'idle') setFailed(true); }}
          />
        ))}
      </div>
    </div>
  );
}

/** Mascot with a speech bubble — for the hero and the CTA band. */
export function MascotGreeting({
  message,
  size = 220,
  pose = 'idle',
}: {
  message: string;
  size?: number;
  pose?: MascotPose;
}) {
  return (
    <div className="mascot-greeting">
      <Mascot size={size} pose={pose} />
      <div className="mascot-bubble">
        <span>{message}</span>
      </div>
    </div>
  );
}
