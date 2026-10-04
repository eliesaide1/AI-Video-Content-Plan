import { CourseModel } from './Course.js';
import { GenerationJobModel } from './GenerationJob.js';
import { LessonModel } from './Lesson.js';
import { ResearchModel } from './Research.js';
import { SectionModel } from './Section.js';
import { TeaserModel } from './Teaser.js';
import { TopicModel } from './Topic.js';

/**
 * Every model that participates in index synchronisation at boot.
 * Adding a model here is all that is needed for its indexes to be applied.
 */
export const registeredModels = [
  TopicModel,
  ResearchModel,
  CourseModel,
  SectionModel,
  LessonModel,
  TeaserModel,
  GenerationJobModel,
];

export * from './enums.js';
export { TopicModel, buildDedupeKey, sourceRefSchema } from './Topic.js';
export type { Topic, TopicDocument } from './Topic.js';
export { ResearchModel } from './Research.js';
export type { Research, ResearchDocument } from './Research.js';
export { CourseModel } from './Course.js';
export type { Course, CourseDocument } from './Course.js';
export { SectionModel } from './Section.js';
export type { Section, SectionDocument } from './Section.js';
export { LessonModel } from './Lesson.js';
export type { Lesson, LessonDocument } from './Lesson.js';
export { TeaserModel } from './Teaser.js';
export type { Teaser, TeaserDocument } from './Teaser.js';
export { GenerationJobModel } from './GenerationJob.js';
export type { GenerationJob, GenerationJobDocument } from './GenerationJob.js';
