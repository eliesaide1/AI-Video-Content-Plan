/** The teaser.json the backend already writes. */
export interface TeaserBeat {
  label: string;
  startSecond: number;
  endSecond: number;
  narration: string;
  onScreenText: string;
}

export interface TeaserData {
  courseId: string;
  hook: string;
  durationSeconds: number;
  callToAction: string;
  beats: TeaserBeat[];
}

/**
 * Remotion's <Composition> constrains props to Record<string, unknown>, so the
 * index signature is required for the component type to be accepted.
 */
export interface TeaserVideoProps extends Record<string, unknown> {
  teaser: TeaserData;
  courseTitle: string;
}
