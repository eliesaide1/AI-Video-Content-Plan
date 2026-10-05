import { Caption, SceneFrame, useEntrance } from './_shared';
import { theme } from '../theme';

interface Props {
  accent: string;
  headline: string;
  courseTitle: string;
  narration: string;
}

/** Closing card: what the course is, and the call to action. */
export function OutroScene({ accent, headline, courseTitle, narration }: Props) {
  const title = useEntrance(2);
  const cta = useEntrance(12);

  return (
    <SceneFrame accent={accent}>
      <div
        style={{
          opacity: title.opacity,
          transform: `translateY(${title.translateY}px)`,
          fontSize: 54,
          fontWeight: 700,
          color: theme.colors.dim,
          lineHeight: 1.25,
          marginBottom: 46,
        }}
      >
        {courseTitle}
      </div>

      <div
        style={{
          opacity: cta.opacity,
          transform: `translateY(${cta.translateY}px)`,
          alignSelf: 'flex-start',
          backgroundColor: accent,
          color: theme.colors.bg,
          fontSize: 76,
          fontWeight: 800,
          padding: '34px 56px',
          borderRadius: 24,
        }}
      >
        {headline}
      </div>

      <Caption text={narration} />
    </SceneFrame>
  );
}
