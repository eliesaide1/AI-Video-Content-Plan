/** Mirrors backend/src/application/sceneSchemas.ts. */
export interface BaseScene {
  type: string;
  durationSeconds: number;
  narration: string;
  /**
   * Narration audio for this scene, relative to the video's public/ folder.
   * Absent when the scene has not been narrated.
   */
  audioSrc?: string;
}
export interface TitleScene extends BaseScene {
  type: 'title';
  headline: string;
  subhead?: string;
  chips?: string[];
}
export interface ProblemScene extends BaseScene {
  type: 'problem';
  headline: string;
  painSteps: string[];
  costLabel?: string;
  costValue?: string;
}
export interface TerminalScene extends BaseScene {
  type: 'terminal';
  title?: string;
  lines: { command: string; output: string[] }[];
}
export interface CodeScene extends BaseScene {
  type: 'code';
  filename?: string;
  language?: string;
  code: string;
  highlightLines?: number[];
}
export interface ComparisonScene extends BaseScene {
  type: 'comparison';
  headline?: string;
  before: { label: string; value: string; detail?: string };
  after: { label: string; value: string; detail?: string };
}
export interface OutcomeScene extends BaseScene {
  type: 'outcome';
  headline: string;
  bullets: string[];
}
export interface CtaScene extends BaseScene {
  type: 'cta';
  headline: string;
  courseTitle?: string;
}

export type DemoScene =
  | TitleScene
  | ProblemScene
  | TerminalScene
  | CodeScene
  | ComparisonScene
  | OutcomeScene
  | CtaScene;

export interface DemoScript {
  courseId?: string;
  toolName?: string;
  totalSeconds?: number;
  scenes: DemoScene[];
}

export interface DemoVideoProps extends Record<string, unknown> {
  script: DemoScript;
  courseTitle: string;
}
