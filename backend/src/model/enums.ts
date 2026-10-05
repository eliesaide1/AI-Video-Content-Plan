/** Shared vocabulary for the V1 pipeline. Kept as const objects so the values
 *  are usable both as runtime enum lists (Mongoose) and as TS union types. */

export const TopicStatus = {
  Candidate: 'candidate',
  Approved: 'approved',
  Rejected: 'rejected',
  Researching: 'researching',
  Researched: 'researched',
  CourseGenerated: 'course-generated',
} as const;
export type TopicStatus = (typeof TopicStatus)[keyof typeof TopicStatus];

export const Audience = {
  Junior: 'junior-developers',
  Intermediate: 'intermediate-developers',
  Advanced: 'advanced-developers',
  NonTechnical: 'non-technical-users',
  Students: 'students',
  Business: 'business-users',
} as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

/** Approximate course size the user asks for. The AI must not pad content to
 *  reach it — it is a hint about scope, not a quota. */
export const CourseDepth = {
  Short: 'short',
  Medium: 'medium',
  Large: 'large',
} as const;
export type CourseDepth = (typeof CourseDepth)[keyof typeof CourseDepth];

export const DEPTH_GUIDANCE: Record<CourseDepth, string> = {
  short: 'roughly 30-60 minutes of material',
  medium: 'roughly 1-4 hours of material',
  large: 'roughly 10-12 hours of material, only if the topic genuinely requires it',
};

export const ResearchStatus = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const;
export type ResearchStatus = (typeof ResearchStatus)[keyof typeof ResearchStatus];

export const CourseStatus = {
  Draft: 'draft',
  Planning: 'planning',
  Planned: 'planned',
  GeneratingLessons: 'generating-lessons',
  Ready: 'ready',
  Failed: 'failed',
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const CourseLevel = {
  Beginner: 'beginner',
  Intermediate: 'intermediate',
  Advanced: 'advanced',
} as const;
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

export const LessonStatus = {
  Pending: 'pending',
  Generating: 'generating',
  Generated: 'generated',
  Edited: 'edited',
  Failed: 'failed',
} as const;
export type LessonStatus = (typeof LessonStatus)[keyof typeof LessonStatus];

export const TeaserStatus = {
  Pending: 'pending',
  Generating: 'generating',
  Generated: 'generated',
  Failed: 'failed',
} as const;
export type TeaserStatus = (typeof TeaserStatus)[keyof typeof TeaserStatus];

export const JobType = {
  Discovery: 'discovery',
  Research: 'research',
  CoursePlan: 'course-plan',
  Lessons: 'lessons',
  Teaser: 'teaser',
  Scenes: 'scenes',
  FullPipeline: 'full-pipeline',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  Queued: 'queued',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Pipeline stages a job moves through (reported over socket.io). */
export const JobStage = {
  Queued: 'queued',
  Discovering: 'discovering',
  Researching: 'researching',
  WritingMaster: 'writing-master',
  Planning: 'planning',
  GeneratingLessons: 'generating-lessons',
  GeneratingTeaser: 'generating-teaser',
  GeneratingScenes: 'generating-scenes',
  Completed: 'completed',
} as const;
export type JobStage = (typeof JobStage)[keyof typeof JobStage];

export const values = <T extends Record<string, string>>(source: T): T[keyof T][] =>
  Object.values(source) as T[keyof T][];
