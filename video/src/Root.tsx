import { Composition } from 'remotion';
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

export function RemotionRoot() {
  return (
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
  );
}
