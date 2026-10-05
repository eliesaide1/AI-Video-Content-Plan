import { SceneFrame, useEntrance } from './_shared';
import { theme } from '../theme';
import type { Packaging } from '../types';

/**
 * The opening card: the same title and thumbnail punches the viewer would have
 * clicked on. Discovery writes them, so the video starts on the promise it was
 * sold with instead of a generic intro.
 */
export function TitleCardScene({ packaging }: { packaging: Packaging }) {
  const chips = packaging.thumbnailText
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  const chipsIn = useEntrance(2);
  const titleIn = useEntrance(10);
  const hookIn = useEntrance(22);

  return (
    <SceneFrame accent={theme.colors.accent}>
      <div
        style={{
          opacity: chipsIn.opacity,
          transform: `translateY(${chipsIn.translateY}px)`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 56,
        }}
      >
        {chips.map((chip) => (
          <span
            key={chip}
            style={{
              backgroundColor: theme.colors.warning,
              color: theme.colors.bg,
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: 1,
              padding: '16px 26px',
              borderRadius: 14,
            }}
          >
            {chip}
          </span>
        ))}
      </div>

      {packaging.titleArabic ? (
        <div
          dir="auto"
          lang="ar"
          style={{
            opacity: titleIn.opacity,
            transform: `translateY(${titleIn.translateY}px)`,
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 1.35,
            marginBottom: 26,
          }}
        >
          {packaging.titleArabic}
        </div>
      ) : null}

      <div
        style={{
          opacity: titleIn.opacity,
          transform: `translateY(${titleIn.translateY}px)`,
          fontSize: 46,
          fontWeight: 600,
          color: theme.colors.dim,
          lineHeight: 1.3,
        }}
      >
        {packaging.titleEnglish}
      </div>

      {packaging.hookLine ? (
        <div
          style={{
            position: 'absolute',
            left: 110,
            right: 110,
            bottom: 150,
            opacity: hookIn.opacity,
            fontSize: 38,
            lineHeight: 1.45,
            color: theme.colors.text,
            borderLeft: `5px solid ${theme.colors.accent}`,
            paddingLeft: 26,
          }}
        >
          {packaging.hookLine}
        </div>
      ) : null}
    </SceneFrame>
  );
}
