import { config } from '../config.js';
import { LocalStorageService } from './LocalStorageService.js';
import type { StorageService } from './StorageService.js';

/**
 * V1 factory. Phase 7 swaps the implementation here only.
 */
export const storageService: StorageService = new LocalStorageService(config.storage.generatedRoot);

export type { StorageService, SavedFile } from './StorageService.js';
export { LocalStorageService } from './LocalStorageService.js';

/** Canonical layout of /generated, kept in one place. */
export const contentPaths = {
  courseRoot: (courseId: string) => `courses/${courseId}`,
  master: (courseId: string) => `courses/${courseId}/research/MASTER.md`,
  sources: (courseId: string) => `courses/${courseId}/research/SOURCES.md`,
  coursePlan: (courseId: string) => `courses/${courseId}/course/COURSE.md`,
  lesson: (courseId: string, sectionOrder: number, lessonOrder: number) =>
    `courses/${courseId}/course/section-${pad(sectionOrder)}/lesson-${pad(lessonOrder)}.md`,
  teaserMarkdown: (courseId: string) => `courses/${courseId}/marketing/teaser.md`,
  teaserJson: (courseId: string) => `courses/${courseId}/marketing/teaser.json`,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
