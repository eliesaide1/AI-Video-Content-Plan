import { Caption, Eyebrow, SceneFrame, useEntrance } from './_shared';

interface Props {
  label: string;
  accent: string;
  headline: string;
  narration: string;
}

/**
 * The workhorse scene: one short line on screen, the spoken line underneath.
 * Used for hook, problem and outcome beats.
 */
export function StatementScene({ label, accent, headline, narration }: Props) {
  const { opacity, translateY } = useEntrance(4);

  return (
    <SceneFrame accent={accent}>
      <Eyebrow label={label} accent={accent} />
      <h1
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          margin: 0,
          fontSize: headline.length > 26 ? 108 : 132,
          lineHeight: 1.08,
          fontWeight: 800,
          letterSpacing: -2,
        }}
      >
        {headline}
      </h1>
      <Caption text={narration} />
    </SceneFrame>
  );
}
