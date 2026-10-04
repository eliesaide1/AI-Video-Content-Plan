interface Props {
  value: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

/** Maps backend statuses to a tone so every screen colours them identically. */
const TONE_BY_STATUS: Record<string, Props['tone']> = {
  candidate: 'info',
  approved: 'info',
  rejected: 'danger',
  researching: 'warning',
  researched: 'success',
  'course-generated': 'success',
  draft: 'neutral',
  planning: 'warning',
  planned: 'info',
  'generating-lessons': 'warning',
  ready: 'success',
  failed: 'danger',
  pending: 'neutral',
  generating: 'warning',
  generated: 'success',
  edited: 'info',
  queued: 'neutral',
  running: 'warning',
  completed: 'success',
};

export function VC_Badge({ value, tone }: Props) {
  const resolved = tone ?? TONE_BY_STATUS[value] ?? 'neutral';
  return <span className={`vc-badge vc-badge--${resolved}`}>{value.replace(/-/g, ' ')}</span>;
}

export default VC_Badge;
