import { Caption, Eyebrow, SceneFrame, useEntrance } from './_shared';
import { theme } from '../theme';

interface Props {
  label: string;
  accent: string;
  steps: string[];
  narration: string;
}

/**
 * A left-to-right pipeline, one step at a time.
 *
 * Chosen automatically when the AI's on-screen text contains arrows
 * ("hash -> sign -> zip"): that phrasing IS a pipeline, so the renderer draws
 * one rather than printing the arrows as text.
 */
export function PipelineScene({ label, accent, steps, narration }: Props) {
  return (
    <SceneFrame accent={accent}>
      <Eyebrow label={label} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {steps.map((step, index) => (
          <PipelineStep key={step} step={step} index={index} accent={accent} />
        ))}
      </div>
      <Caption text={narration} />
    </SceneFrame>
  );
}

function PipelineStep({ step, index, accent }: { step: string; index: number; accent: string }) {
  // Each step lands a third of a second after the one before it.
  const { opacity, translateY } = useEntrance(6 + index * 10);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 30,
        backgroundColor: theme.colors.bgLift,
        border: `3px solid ${accent}55`,
        borderRadius: 26,
        padding: '34px 42px',
      }}
    >
      <span
        style={{
          width: 70,
          height: 70,
          borderRadius: '50%',
          backgroundColor: accent,
          color: theme.colors.bg,
          fontSize: 38,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {index + 1}
      </span>
      <span style={{ fontSize: 68, fontWeight: 700, fontFamily: theme.font.mono }}>{step}</span>
    </div>
  );
}
