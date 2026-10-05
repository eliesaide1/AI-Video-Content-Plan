import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
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
export function Segments({ kit, segment, audioSrc }: SegmentProps) {
  return (
    <AbsoluteFill>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      {segment === 'intro' ? <Intro kit={kit} /> : null}
      {segment === 'scoreboard' ? <Scoreboard kit={kit} /> : null}
      {segment === 'outro' ? <Outro kit={kit} /> : null}
    </AbsoluteFill>
  );
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
          <Row key={index} task={task} index={index} total={kit.tasks.length} />
        ))}
      </div>
    </SceneFrame>
  );
}

function Row({ task, index, total }: { task: KitTask; index: number; total: number }) {
  const { opacity, translateY, scale } = useEntrance(4 + index * 8);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // A highlight walks down the list, so the viewer's eye is led through it
  // rather than handed a static block of text.
  const slot = durationInFrames / total;
  const distance = Math.abs(frame - (index + 0.6) * slot) / slot;
  const active = interpolate(distance, [0, 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      dir="auto"
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale + active * 0.02})`,
        display: 'flex',
        gap: 20,
        alignItems: 'flex-start',
        backgroundColor: theme.colors.bgLift,
        border: `3px solid ${
          active > 0.4 ? theme.colors.success : theme.colors.border ?? '#2a2f39'
        }`,
        boxShadow: active > 0.4 ? `0 0 ${active * 40}px ${theme.colors.success}33` : 'none',
        borderRadius: 16,
        padding: '18px 24px',
        fontSize: 34,
        lineHeight: 1.35,
      }}
    >
      <span
        style={{
          color: theme.colors.success,
          flexShrink: 0,
          fontWeight: 800,
          transform: `scale(${1 + active * 0.35})`,
        }}
      >
        ✓
      </span>
      <span style={{ opacity: 0.6 + active * 0.4 }}>{task.ask}</span>
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
