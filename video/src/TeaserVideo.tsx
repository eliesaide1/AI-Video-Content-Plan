import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { OutroScene } from './scenes/OutroScene';
import { TitleCardScene } from './scenes/TitleCardScene';
import { PipelineScene } from './scenes/PipelineScene';
import { StatementScene } from './scenes/StatementScene';
import { ProgressBar } from './scenes/_shared';
import { beatAccent, theme } from './theme';
import type { TeaserBeat, TeaserVideoProps } from './types';

/**
 * Turns one teaser.json into a video.
 *
 * Each beat already carries its own start and end second, so the composition
 * is a direct mapping from the data the AI produced to a Sequence. Which scene
 * component renders a beat is decided HERE, never by the AI — that is what
 * keeps every video in the channel looking like the same channel.
 */
/** Seconds the opening title card holds before the first beat. */
export const TITLE_CARD_SECONDS = 3;

export function TeaserVideo({ teaser, courseTitle, packaging }: TeaserVideoProps) {
  const { fps } = useVideoConfig();
  // The card is prepended, so every beat shifts later by its length.
  const offset = packaging ? Math.round(TITLE_CARD_SECONDS * fps) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      {packaging ? (
        <Sequence from={0} durationInFrames={offset}>
          <TitleCardScene packaging={packaging} />
        </Sequence>
      ) : null}

      {teaser.beats.map((beat, index) => {
        const from = offset + Math.round(beat.startSecond * fps);
        const durationInFrames = Math.max(
          1,
          Math.round((beat.endSecond - beat.startSecond) * fps),
        );

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            {renderBeat(beat, courseTitle)}
          </Sequence>
        );
      })}

      <ProgressBar accent={theme.colors.accent} />
    </AbsoluteFill>
  );
}

function renderBeat(beat: TeaserBeat, courseTitle: string) {
  const accent = beatAccent[beat.label] ?? theme.colors.accent;
  const label = beat.label.replace(/-/g, ' ');
  const steps = splitPipeline(beat.onScreenText);

  if (beat.label === 'call-to-action') {
    return (
      <OutroScene
        accent={accent}
        headline={beat.onScreenText || 'Start the course'}
        courseTitle={courseTitle}
        narration={beat.narration}
      />
    );
  }

  // On-screen text written as "a -> b -> c" is a pipeline; draw it as one.
  if (steps.length >= 2) {
    return <PipelineScene label={label} accent={accent} steps={steps} narration={beat.narration} />;
  }

  return (
    <StatementScene
      label={label}
      accent={accent}
      headline={beat.onScreenText || beat.narration}
      narration={beat.narration}
    />
  );
}

/** Splits "hash → sign → zip" (or "->", "|", "·") into steps. */
function splitPipeline(text: string): string[] {
  if (!text) return [];
  const parts = text
    .split(/\s*(?:→|->|⇒|\||·)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : [];
}
