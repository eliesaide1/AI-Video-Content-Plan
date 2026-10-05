import { Composition } from 'remotion';
import { DemoVideo, totalFrames } from './DemoVideo';
import { Segments } from './Segments';
import type { ProductionKit, SegmentProps } from './kitTypes';
import type { DemoScript, DemoVideoProps } from './sceneTypes';
import { TITLE_CARD_SECONDS, TeaserVideo } from './TeaserVideo';
import { theme } from './theme';
import type { TeaserData, TeaserVideoProps } from './types';

/** Used when the studio opens with no props passed in. */
const placeholder: TeaserData = {
  courseId: 'preview',
  hook: 'Preview',
  durationSeconds: 10,
  callToAction: 'Pass real teaser.json via --props',
  beats: [
    {
      label: 'hook',
      startSecond: 0,
      endSecond: 10,
      narration: 'Render with --props=<path to teaser.json> to see a real teaser.',
      onScreenText: 'No teaser loaded',
    },
  ],
};

const placeholderDemo: DemoScript = {
  scenes: [
    {
      type: 'title',
      durationSeconds: 4,
      narration: 'Render with --scenes <demo.json> to see a real demo.',
      headline: 'No demo loaded',
      chips: ['PASS --scenes'],
    },
  ],
};

const placeholderKit: ProductionKit = {
  toolName: 'Tool',
  titleArabic: 'لا يوجد kit',
  titleEnglish: 'No kit loaded',
  thumbnailText: 'PASS --kit',
  hookArabic: '',
  audienceNote: '',
  verdictQuestion: 'Pass --kit <kit.json>',
  tasks: [],
  estimatedMinutes: 0,
};

export function RemotionRoot() {
  return (
    <>
    <Composition
      id="Teaser"
      component={TeaserVideo}
      width={theme.width}
      height={theme.height}
      fps={theme.fps}
      durationInFrames={placeholder.durationSeconds * theme.fps}
      defaultProps={{ teaser: placeholder, courseTitle: 'Course title' } satisfies TeaserVideoProps}
      // The teaser's own duration decides the video length.
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round(
          (props.teaser.durationSeconds + (props.packaging ? TITLE_CARD_SECONDS : 0)) * theme.fps,
        ),
      })}
    />

      {/* The demo: shows the problem and the tool fixing it, from real scenes. */}
      <Composition
        id="Demo"
        component={DemoVideo}
        width={theme.width}
        height={theme.height}
        fps={theme.fps}
        durationInFrames={totalFrames(placeholderDemo, theme.fps)}
        defaultProps={
          { script: placeholderDemo, courseTitle: 'Course title' } satisfies DemoVideoProps
        }
        calculateMetadata={({ props }) => ({
          durationInFrames: totalFrames(props.script, theme.fps),
        })}
      />

      {/* Cards to cut into a screen recording: intro, scoreboard, outro. */}
      <Composition
        id="Segment"
        component={Segments}
        width={theme.width}
        height={theme.height}
        fps={theme.fps}
        durationInFrames={5 * theme.fps}
        defaultProps={
          {
            kit: placeholderKit,
            segment: 'intro',
          } satisfies SegmentProps
        }
        calculateMetadata={({ props }) => ({
          // The scoreboard needs longer: each row lands in turn.
          durationInFrames:
            props.segment === 'scoreboard'
              ? Math.round((4 + props.kit.tasks.length * 0.9) * theme.fps)
              : 5 * theme.fps,
        })}
      />
    </>
  );
}
