/** Mirrors backend/src/application/kitSchemas.ts. */
export interface KitTask {
  ask: string;
  whyItMatters: string;
  passCondition: string;
  watchFor: string;
  steps: string[];
  narrationArabic: string;
}

export interface ProductionKit {
  courseId?: string;
  toolName: string;
  titleArabic: string;
  titleEnglish: string;
  thumbnailText: string;
  hookArabic: string;
  audienceNote: string;
  verdictQuestion: string;
  tasks: KitTask[];
  estimatedMinutes: number;
}

export type SegmentName = 'intro' | 'scoreboard' | 'outro';

export interface SegmentProps extends Record<string, unknown> {
  kit: ProductionKit;
  segment: SegmentName;
  /** Narration for this segment, relative to public/. */
  audioSrc?: string;
  /** Length of that narration, so the card lasts as long as the line. */
  audioSeconds?: number;
}
