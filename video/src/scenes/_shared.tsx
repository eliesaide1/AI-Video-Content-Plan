import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** Fade + rise entrance used by every scene, so timing feels consistent. */
export function useEntrance(delayFrames = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Lower damping so elements arrive with a little overshoot instead of
  // easing politely into place — the difference between motion and a fade.
  const progress = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 110 },
  });
  return {
    opacity: interpolate(progress, [0, 0.6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    translateY: interpolate(progress, [0, 1], [52, 0]),
    /** Slight scale-up on arrival, for things that should feel like they land. */
    scale: interpolate(progress, [0, 1], [0.94, 1]),
  };
}

/** Counts a number up as the scene opens, so a figure arrives rather than appears. */
export function useCountUp(target: string, delayFrames = 0): string {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const digits = /^[^\d]*(\d[\d,.]*)(.*)$/.exec(target);
  if (!digits) return target;

  const [, numberPart, suffix] = digits;
  const prefix = target.slice(0, target.indexOf(numberPart));
  const value = Number(numberPart.replace(/,/g, ''));
  if (!Number.isFinite(value)) return target;

  const progress = spring({ frame: frame - delayFrames, fps, config: { damping: 200 } });
  const current = Math.round(value * progress);
  return `${prefix}${current.toLocaleString()}${suffix}`;
}

/**
 * Slow continuous drift across the whole scene.
 *
 * Without it every scene is a static card that happens to fade in, and the
 * result reads as a slide deck. A gentle push-in keeps the frame alive for the
 * seconds the viewer spends on it, the way a camera never sits perfectly
 * still.
 */
function useDrift() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = durationInFrames > 0 ? frame / durationInFrames : 0;
  return {
    scale: interpolate(progress, [0, 1], [1, 1.045]),
    translateY: interpolate(progress, [0, 1], [10, -10]),
  };
}

/** Two accent blooms sliding slowly behind the content. */
function LivingBackground({ accent }: { accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${48 + Math.sin(t * 0.45) * 14}% ${
            26 + Math.cos(t * 0.35) * 9
          }%, ${accent}30, transparent 58%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${62 + Math.cos(t * 0.3) * 16}% ${
            74 + Math.sin(t * 0.25) * 10
          }%, ${accent}1c, transparent 55%)`,
        }}
      />
    </AbsoluteFill>
  );
}

export function SceneFrame({ accent, children }: { accent: string; children: ReactNode }) {
  const drift = useDrift();

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg, overflow: 'hidden' }}>
      <LivingBackground accent={accent} />

      <AbsoluteFill
        style={{
          fontFamily: theme.font.family,
          color: theme.colors.text,
          padding: 110,
          // The caption is absolutely positioned at the bottom, so content has
          // to stop above it or a dense scene collides with the narration.
          paddingBottom: 380,
          justifyContent: 'center',
          transform: `scale(${drift.scale}) translateY(${drift.translateY}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Eyebrow({ label, accent }: { label: string; accent: string }) {
  const { opacity, translateY } = useEntrance(0);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        color: accent,
        fontSize: 34,
        fontWeight: 800,
        letterSpacing: 6,
        textTransform: 'uppercase',
        marginBottom: 38,
      }}
    >
      {label}
    </div>
  );
}

/**
 * The narration, burned in as a caption.
 *
 * V1 has no audio (voice generation is a later phase), so the spoken line has
 * to be readable or the video says nothing. When narration audio arrives this
 * becomes an optional subtitle track.
 */
export function Caption({ text }: { text: string }) {
  const { opacity } = useEntrance(8);
  return (
    <div
      style={{
        position: 'absolute',
        left: 110,
        right: 110,
        bottom: 120,
        opacity: opacity * 0.92,
        fontSize: 34,
        lineHeight: 1.45,
        color: theme.colors.dim,
        borderLeft: `5px solid ${theme.colors.bgLift}`,
        paddingLeft: 26,
      }}
    >
      {text}
    </div>
  );
}

/** Thin progress bar: how far through the teaser the viewer is. */
export function ProgressBar({ accent }: { accent: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 10,
        backgroundColor: theme.colors.bgLift,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${(frame / durationInFrames) * 100}%`,
          backgroundColor: accent,
        }}
      />
    </div>
  );
}
