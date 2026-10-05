/**
 * One visual language for every video.
 *
 * The spec is explicit that AI must NOT design each scene: the AI chooses the
 * scene type and supplies the words, and these tokens plus the scene
 * components decide how it looks. That is what keeps a channel's videos
 * recognisably the same.
 */
export const theme = {
  colors: {
    bg: '#0f1115',
    bgLift: '#171a21',
    text: '#f2f5fa',
    dim: '#9aa4b4',
    accent: '#4f8cff',
    warning: '#e8b341',
    success: '#35c389',
    danger: '#f05d5e',
  },
  font: {
    family: '"SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    mono: '"SF Mono", Menlo, monospace',
  },
  fps: 30,
  width: 1080,
  height: 1920,
} as const;

/** Accent per beat, so each stage of the teaser reads differently. */
export const beatAccent: Record<string, string> = {
  hook: theme.colors.accent,
  problem: theme.colors.danger,
  idea: theme.colors.warning,
  outcome: theme.colors.success,
  'call-to-action': theme.colors.accent,
};
