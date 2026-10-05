import { AbsoluteFill } from 'remotion';
import { SceneFrame, useEntrance } from './scenes/_shared';
import { theme } from './theme';
import type { KitTask, ProductionKit, SegmentProps } from './kitTypes';

/**
 * Short cards to cut into a screen recording.
 *
 * The presenter records themselves using the tool; these cover the parts a
 * screen recording cannot show well — the opening title, the running
 * scoreboard of tests, and the closing question. Rendered separately so they
 * drop straight onto an editing timeline.
 */
export function Segments({ kit, segment }: SegmentProps) {
  if (segment === 'intro') return <Intro kit={kit} />;
  if (segment === 'scoreboard') return <Scoreboard kit={kit} />;
  return <Outro kit={kit} />;
}

function Intro({ kit }: { kit: ProductionKit }) {
  const chips = useEntrance(2);
  const title = useEntrance(10);
  const chipList = kit.thumbnailText.split('|').map((c) => c.trim()).filter(Boolean);

  return (
    <SceneFrame accent={theme.colors.accent}>
      <div
        style={{
          opacity: chips.opacity,
          transform: `translateY(${chips.translateY}px)`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 46,
        }}
      >
        {chipList.map((chip) => (
          <span
            key={chip}
            dir="auto"
            style={{
              backgroundColor: theme.colors.warning,
              color: theme.colors.bg,
              fontSize: 38,
              fontWeight: 900,
              padding: '14px 24px',
              borderRadius: 12,
            }}
          >
            {chip}
          </span>
        ))}
      </div>

      <h1
        dir="auto"
        lang="ar"
        style={{
          opacity: title.opacity,
          transform: `translateY(${title.translateY}px)`,
          margin: 0,
          fontSize: 86,
          lineHeight: 1.4,
          fontWeight: 800,
        }}
      >
        {kit.titleArabic}
      </h1>

      <p style={{ opacity: title.opacity, fontSize: 40, color: theme.colors.dim, marginTop: 28 }}>
        {kit.titleEnglish}
      </p>
    </SceneFrame>
  );
}

/** The running test list — the spine of the video, shown as a checklist. */
function Scoreboard({ kit }: { kit: ProductionKit }) {
  return (
    <SceneFrame accent={theme.colors.success}>
      <h2
        dir="auto"
        style={{ margin: '0 0 40px', fontSize: 62, fontWeight: 800 }}
      >
        {kit.tasks.length} اختبارات
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {kit.tasks.map((task, index) => (
          <Row key={index} task={task} index={index} />
        ))}
      </div>
    </SceneFrame>
  );
}

function Row({ task, index }: { task: KitTask; index: number }) {
  const { opacity, translateY } = useEntrance(4 + index * 8);
  return (
    <div
      dir="auto"
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        gap: 20,
        alignItems: 'flex-start',
        backgroundColor: theme.colors.bgLift,
        border: `3px solid ${theme.colors.border ?? '#2a2f39'}`,
        borderRadius: 16,
        padding: '18px 24px',
        fontSize: 34,
        lineHeight: 1.35,
      }}
    >
      <span style={{ color: theme.colors.success, flexShrink: 0, fontWeight: 800 }}>✓</span>
      <span>{task.ask}</span>
    </div>
  );
}

function Outro({ kit }: { kit: ProductionKit }) {
  const question = useEntrance(2);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      <SceneFrame accent={theme.colors.accent}>
        <div
          dir="auto"
          style={{
            opacity: question.opacity,
            transform: `translateY(${question.translateY}px)`,
            fontSize: 70,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {kit.verdictQuestion}
        </div>
      </SceneFrame>
    </AbsoluteFill>
  );
}
