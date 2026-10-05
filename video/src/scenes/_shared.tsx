import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** Fade + rise entrance used by every scene, so timing feels consistent. */
export function useEntrance(delayFrames = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 200, mass: 0.6 },
  });
  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    translateY: interpolate(progress, [0, 1], [40, 0]),
  };
}

export function SceneFrame({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.bg,
        fontFamily: theme.font.family,
        color: theme.colors.text,
        padding: 110,
        justifyContent: 'center',
      }}
    >
      {/* A soft wash of the beat's accent, so the colour reads without a hard block. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 28%, ${accent}26, transparent 62%)`,
        }}
      />
      {children}
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
        bottom: 150,
        opacity: opacity * 0.92,
        fontSize: 36,
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
