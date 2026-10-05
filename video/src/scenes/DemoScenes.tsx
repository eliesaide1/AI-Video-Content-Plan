import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, Eyebrow, SceneFrame, useEntrance } from './_shared';
import { theme } from '../theme';
import type {
  CodeScene,
  ComparisonScene,
  CtaScene,
  OutcomeScene,
  ProblemScene,
  StakesScene,
  TerminalScene,
  TitleScene,
} from '../sceneTypes';

/* ------------------------------- title ------------------------------- */

export function DemoTitle({ scene }: { scene: TitleScene }) {
  const chips = useEntrance(2);
  const head = useEntrance(10);

  return (
    <SceneFrame accent={theme.colors.accent}>
      {scene.chips?.length ? (
        <div
          style={{
            opacity: chips.opacity,
            transform: `translateY(${chips.translateY}px)`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 52,
          }}
        >
          {scene.chips.map((chip) => (
            <span
              key={chip}
              style={{
                backgroundColor: theme.colors.warning,
                color: theme.colors.bg,
                fontSize: 36,
                fontWeight: 900,
                padding: '14px 22px',
                borderRadius: 12,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      <h1
        style={{
          opacity: head.opacity,
          transform: `translateY(${head.translateY}px)`,
          margin: 0,
          fontSize: 100,
          lineHeight: 1.1,
          fontWeight: 800,
          letterSpacing: -2,
        }}
      >
        {scene.headline}
      </h1>

      {scene.subhead ? (
        <p style={{ opacity: head.opacity, fontSize: 44, color: theme.colors.dim, marginTop: 26 }}>
          {scene.subhead}
        </p>
      ) : null}

      <Caption text={scene.narration} />
    </SceneFrame>
  );
}

/* ------------------------------ stakes ------------------------------- */

const COST_ICON: Record<string, string> = {
  money: '$',
  time: '⏱',
  privacy: '🔒',
  limit: '⛔',
};

/**
 * The reason to care, before anything technical. A situation the viewer
 * recognises, then what it costs them today.
 */
export function DemoStakes({ scene }: { scene: StakesScene }) {
  const scenario = useEntrance(2);

  return (
    <SceneFrame accent={theme.colors.warning}>
      <Eyebrow label="if this is you" accent={theme.colors.warning} />

      <p
        style={{
          opacity: scenario.opacity,
          transform: `translateY(${scenario.translateY}px)`,
          margin: '0 0 40px',
          // Scale down as the scene gets denser, so three costs and a long
          // scenario still fit above the caption.
          fontSize: scene.scenario.length > 150 || scene.costs.length > 2 ? 48 : 62,
          fontWeight: 700,
          lineHeight: 1.28,
        }}
      >
        {scene.scenario}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {scene.costs.map((cost, index) => (
          <Cost key={index} cost={cost} index={index} />
        ))}
      </div>

      <Caption text={scene.narration} />
    </SceneFrame>
  );
}

function Cost({
  cost,
  index,
}: {
  cost: StakesScene['costs'][number];
  index: number;
}) {
  const { opacity, translateY } = useEntrance(10 + index * 9);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        backgroundColor: theme.colors.bgLift,
        border: `3px solid ${theme.colors.warning}44`,
        borderRadius: 18,
        padding: '18px 26px',
      }}
    >
      <span style={{ fontSize: 46, width: 56, textAlign: 'center', flexShrink: 0 }}>
        {COST_ICON[cost.kind] ?? '•'}
      </span>
      <span
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: theme.colors.warning,
          flexShrink: 0,
          maxWidth: 320,
        }}
      >
        {cost.value}
      </span>
      <span style={{ fontSize: 30, color: theme.colors.dim, lineHeight: 1.25 }}>{cost.label}</span>
    </div>
  );
}

/* ------------------------------ problem ------------------------------ */

/** The manual process, step by step, with what it costs. Shows, not tells. */
export function DemoProblem({ scene }: { scene: ProblemScene }) {
  const cost = useEntrance(4 + scene.painSteps.length * 7);

  return (
    <SceneFrame accent={theme.colors.danger}>
      <Eyebrow label="today, by hand" accent={theme.colors.danger} />
      <h2 style={{ margin: '0 0 36px', fontSize: 62, fontWeight: 800, lineHeight: 1.15 }}>
        {scene.headline}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {scene.painSteps.map((step, index) => (
          <PainStep key={step} step={step} index={index} />
        ))}
      </div>

      {scene.costValue ? (
        <div
          style={{
            opacity: cost.opacity,
            transform: `translateY(${cost.translateY}px)`,
            marginTop: 44,
            alignSelf: 'flex-start',
            border: `4px solid ${theme.colors.danger}`,
            borderRadius: 18,
            padding: '20px 34px',
          }}
        >
          <span style={{ fontSize: 76, fontWeight: 900, color: theme.colors.danger }}>
            {scene.costValue}
          </span>
          <span style={{ fontSize: 34, color: theme.colors.dim, marginLeft: 16 }}>
            {scene.costLabel}
          </span>
        </div>
      ) : null}

      <Caption text={scene.narration} />
    </SceneFrame>
  );
}

function PainStep({ step, index }: { step: string; index: number }) {
  const { opacity, translateY } = useEntrance(4 + index * 7);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        gap: 20,
        alignItems: 'flex-start',
        fontSize: 40,
        lineHeight: 1.3,
      }}
    >
      <span style={{ color: theme.colors.danger, fontWeight: 800, flexShrink: 0 }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span>{step}</span>
    </div>
  );
}

/* ------------------------------ terminal ------------------------------ */

/**
 * A real terminal. The command types out character by character, then its
 * output appears — the viewer watches the tool actually run instead of
 * reading a claim that it works.
 */
export function DemoTerminal({ scene }: { scene: TerminalScene }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Split the scene evenly across its commands.
  const perBlock = durationInFrames / scene.lines.length;

  return (
    <SceneFrame accent={theme.colors.success}>
      {scene.title ? <Eyebrow label={scene.title} accent={theme.colors.success} /> : null}

      <div
        style={{
          backgroundColor: '#07090d',
          border: `3px solid ${theme.colors.bgLift}`,
          borderRadius: 22,
          padding: 36,
          fontFamily: theme.font.mono,
          fontSize: 32,
          lineHeight: 1.5,
          minHeight: 560,
        }}
      >
        <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
          {['#f05d5e', '#e8b341', '#35c389'].map((dot) => (
            <span
              key={dot}
              style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: dot }}
            />
          ))}
        </div>

        {scene.lines.map((line, index) => {
          const blockStart = index * perBlock;
          const local = frame - blockStart;
          if (local < 0) return null;

          // Type the command over the first second of its block.
          const typed = Math.floor(
            interpolate(local, [0, fps * 0.9], [0, line.command.length], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          );
          const commandText = line.command.slice(0, typed);
          const typing = typed < line.command.length;

          return (
            <div key={index} style={{ marginBottom: 22 }}>
              <div style={{ color: theme.colors.text, wordBreak: 'break-all' }}>
                <span style={{ color: theme.colors.success, marginRight: 12 }}>$</span>
                {commandText}
                {typing ? <Cursor /> : null}
              </div>

              {!typing
                ? line.output.map((outputLine, outputIndex) => (
                    <OutputLine
                      key={outputIndex}
                      text={outputLine}
                      delay={fps * 1.0 + outputIndex * 6}
                      local={local}
                    />
                  ))
                : null}
            </div>
          );
        })}
      </div>

      <Caption text={scene.narration} />
    </SceneFrame>
  );
}

function Cursor() {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
        color: theme.colors.success,
      }}
    >
      ▋
    </span>
  );
}

function OutputLine({ text, delay, local }: { text: string; delay: number; local: number }) {
  if (local < delay) return null;
  const isWarning = /not found|mismatch|issue|error|fail/i.test(text);
  return (
    <div
      style={{
        color: isWarning ? theme.colors.warning : theme.colors.dim,
        paddingLeft: 34,
        wordBreak: 'break-word',
      }}
    >
      {text}
    </div>
  );
}

/* -------------------------------- code -------------------------------- */

export function DemoCode({ scene }: { scene: CodeScene }) {
  const lines = scene.code.replace(/\t/g, '  ').split('\n');
  const highlight = new Set(scene.highlightLines ?? []);

  return (
    <SceneFrame accent={theme.colors.accent}>
      {scene.filename ? <Eyebrow label={scene.filename} accent={theme.colors.accent} /> : null}

      <div
        style={{
          backgroundColor: '#07090d',
          border: `3px solid ${theme.colors.bgLift}`,
          borderRadius: 22,
          padding: '30px 0',
          fontFamily: theme.font.mono,
          fontSize: 28,
          lineHeight: 1.55,
          overflow: 'hidden',
        }}
      >
        {lines.slice(0, 18).map((line, index) => (
          <CodeLine
            key={index}
            number={index + 1}
            text={line}
            highlighted={highlight.has(index + 1)}
            delay={index * 2}
          />
        ))}
      </div>

      <Caption text={scene.narration} />
    </SceneFrame>
  );
}

function CodeLine({
  number,
  text,
  highlighted,
  delay,
}: {
  number: number;
  text: string;
  highlighted: boolean;
  delay: number;
}) {
  const { opacity } = useEntrance(delay);
  return (
    <div
      style={{
        opacity,
        display: 'flex',
        gap: 22,
        padding: '2px 30px',
        backgroundColor: highlighted ? `${theme.colors.accent}26` : 'transparent',
        borderLeft: `6px solid ${highlighted ? theme.colors.accent : 'transparent'}`,
      }}
    >
      <span style={{ color: '#4a5465', minWidth: 42, textAlign: 'right' }}>{number}</span>
      <span
        style={{
          color: highlighted ? theme.colors.text : '#a9b4c4',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text || ' '}
      </span>
    </div>
  );
}

/* ----------------------------- comparison ----------------------------- */

/** The two numbers, side by side. The payoff of the whole video. */
export function DemoComparison({ scene }: { scene: ComparisonScene }) {
  const before = useEntrance(2);
  const after = useEntrance(14);

  return (
    <SceneFrame accent={theme.colors.success}>
      {scene.headline ? (
        <h2 style={{ margin: '0 0 44px', fontSize: 58, fontWeight: 800 }}>{scene.headline}</h2>
      ) : null}

      <Side
        entrance={before}
        label={scene.before.label}
        value={scene.before.value}
        detail={scene.before.detail}
        color={theme.colors.danger}
      />

      <div style={{ height: 28 }} />

      <Side
        entrance={after}
        label={scene.after.label}
        value={scene.after.value}
        detail={scene.after.detail}
        color={theme.colors.success}
      />

      <Caption text={scene.narration} />
    </SceneFrame>
  );
}

function Side({
  entrance,
  label,
  value,
  detail,
  color,
}: {
  entrance: { opacity: number; translateY: number };
  label: string;
  value: string;
  detail?: string;
  color: string;
}) {
  return (
    <div
      style={{
        opacity: entrance.opacity,
        transform: `translateY(${entrance.translateY}px)`,
        backgroundColor: theme.colors.bgLift,
        border: `3px solid ${color}66`,
        borderRadius: 22,
        padding: 34,
      }}
    >
      <div style={{ fontSize: 34, color: theme.colors.dim, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 128, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {detail ? (
        <div style={{ fontSize: 30, color: theme.colors.dim, marginTop: 14 }}>{detail}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------ outcome ------------------------------- */

export function DemoOutcome({ scene }: { scene: OutcomeScene }) {
  return (
    <SceneFrame accent={theme.colors.accent}>
      <h2 style={{ margin: '0 0 44px', fontSize: 64, fontWeight: 800 }}>{scene.headline}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {scene.bullets.map((bullet, index) => (
          <Bullet key={bullet} text={bullet} index={index} />
        ))}
      </div>
      <Caption text={scene.narration} />
    </SceneFrame>
  );
}

function Bullet({ text, index }: { text: string; index: number }) {
  const { opacity, translateY } = useEntrance(4 + index * 9);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        gap: 20,
        fontSize: 42,
        lineHeight: 1.3,
      }}
    >
      <span style={{ color: theme.colors.success, flexShrink: 0 }}>✓</span>
      <span>{text}</span>
    </div>
  );
}

/* -------------------------------- cta --------------------------------- */

export function DemoCta({ scene, courseTitle }: { scene: CtaScene; courseTitle: string }) {
  const title = useEntrance(2);
  const button = useEntrance(10);

  return (
    <SceneFrame accent={theme.colors.accent}>
      <div
        style={{
          opacity: title.opacity,
          transform: `translateY(${title.translateY}px)`,
          fontSize: 50,
          fontWeight: 700,
          color: theme.colors.dim,
          lineHeight: 1.25,
          marginBottom: 42,
        }}
      >
        {scene.courseTitle || courseTitle}
      </div>
      <div
        style={{
          opacity: button.opacity,
          transform: `translateY(${button.translateY}px)`,
          alignSelf: 'flex-start',
          backgroundColor: theme.colors.accent,
          color: theme.colors.bg,
          fontSize: 72,
          fontWeight: 800,
          padding: '32px 52px',
          borderRadius: 22,
        }}
      >
        {scene.headline}
      </div>
      <Caption text={scene.narration} />
    </SceneFrame>
  );
}
