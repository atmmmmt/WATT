import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * The VAYRO character inside the app.
 *
 * Same artwork as the landing page (`public/mascot/*.webp`), animated with a gentle float
 * and a cross-fade between poses. Used for empty states, the welcome moment, and as the
 * avatar for AI replies — places where a still illustration would feel dead.
 */

export type MascotPose =
  | 'idle' | 'front' | 'wave' | 'thumbs' | 'working'
  | 'phone' | 'pointing' | 'walking' | 'celebrate';

/**
 * Native height of each pose on the delivered character sheet. The mascot is never drawn
 * larger than this — upscaling the small action poses is what looked pixelated.
 */
const NATIVE_HEIGHT: Record<MascotPose, number> = {
  idle: 370, front: 363, wave: 180, thumbs: 179, working: 181,
  phone: 179, pointing: 181, walking: 177, celebrate: 166,
};

export type MascotFace =
  | 'face-happy' | 'face-wink' | 'face-excited'
  | 'face-thinking' | 'face-confident' | 'face-love' | 'face-convinced';

export function Mascot({
  pose = 'idle',
  size = 180,
  float = true,
  alt = '',
}: {
  pose?: MascotPose;
  size?: number;
  float?: boolean;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(pose);
  const previous = useRef(pose);

  useEffect(() => {
    previous.current = current;
    setCurrent(pose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);

  if (failed) return null;

  const height = Math.min(size, Math.round(NATIVE_HEIGHT[current] * 0.75));

  return (
    <motion.img
      key={current}
      src={`/mascot/${current}.webp`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      height={height}
      style={{ height, width: 'auto', display: 'block', filter: 'drop-shadow(0 14px 18px rgba(6,78,59,0.22))' }}
      initial={{ opacity: 0, scale: 0.94, y: 6 }}
      animate={
        float
          ? { opacity: 1, scale: 1, y: [0, -9, 0] }
          : { opacity: 1, scale: 1, y: 0 }
      }
      transition={
        float
          ? { opacity: { duration: 0.35 }, scale: { duration: 0.35 }, y: { duration: 4.4, repeat: Infinity, ease: 'easeInOut' } }
          : { duration: 0.3 }
      }
      onError={() => setFailed(true)}
    />
  );
}

/** Just the head — small enough to sit beside a message as an avatar. */
export function MascotFaceAvatar({ face = 'face-happy', size = 34 }: { face?: MascotFace; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`/mascot/${face}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

/** Empty-state block: character + message, used where a list has nothing to show yet. */
export function MascotEmptyState({
  title,
  description,
  pose = 'idle',
  size = 170,
}: {
  title: string;
  description?: string;
  pose?: MascotPose;
  size?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', padding: '2rem 1.5rem', textAlign: 'center' }}>
      <Mascot pose={pose} size={size} />
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.6 }}>{description}</p>
      )}
    </div>
  );
}
