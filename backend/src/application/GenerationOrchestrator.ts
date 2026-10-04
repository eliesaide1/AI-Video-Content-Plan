import { createLogger } from '../infrastructure/logger.js';
import {
  CourseStatus,
  JobStage,
  JobType,
  TopicStatus,
  type GenerationJobDocument,
} from '../model/index.js';
import { curriculumService } from './CurriculumService.js';
import { discoveryService } from './DiscoveryService.js';
import { jobService } from './JobService.js';
import { lessonService } from './LessonService.js';
import { researchService } from './ResearchService.js';
import { teaserService } from './TeaserService.js';
import { topicService } from './TopicService.js';

const log = createLogger('orchestrator');

export interface StartedJob {
  jobId: string;
  status: string;
  type: string;
  entityId: string;
}

/**
 * The orchestrator.
 *
 * It owns the V1 pipeline order — research -> MASTER.md -> course plan ->
 * COURSE.md -> lessons -> teaser.md — and nothing else. Each step lives in its
 * own service; this class only sequences them and reports progress.
 *
 * Execution model (V1): the HTTP request returns a jobId immediately and the
 * work continues in-process. No request is ever held open for a whole course.
 * Phase 5 replaces `runDetached` with a BullMQ producer — every step function
 * below stays exactly as it is.
 */
export class GenerationOrchestrator {
  /** Discovery run (sources -> ranked candidate topics). */
  async startDiscovery(maxCandidates?: number): Promise<StartedJob> {
    const job = await jobService.create(JobType.Discovery, 'system');

    this.runDetached(job, async () => {
      await jobService.markRunning(job, JobStage.Discovering, 10);
      await jobService.addLog(job, 'Retrieving items from configured sources...');
      const result = await discoveryService.run({ maxCandidates });
      await jobService.addLog(
        job,
        `Retrieved ${result.retrievedItems} item(s); created ${result.created} candidate topic(s).`,
      );
      return result;
    });

    return this.describe(job);
  }

  /**
   * The full V1 pipeline for one approved topic.
   * Safe to re-run: every step upserts rather than duplicating.
   */
  async startFullPipeline(topicId: string): Promise<StartedJob> {
    const topic = await topicService.getById(topicId);
    if (topic.status === TopicStatus.Candidate) {
      // Human approval is the gate; refuse to spend AI budget before it.
      await topicService.approve(topicId);
    }
    if (topic.status === TopicStatus.Rejected) {
      const { AppError } = await import('../infrastructure/errors/AppError.js');
      throw AppError.badRequest('This topic was rejected. Approve it before generating.');
    }

    const job = await jobService.create(JobType.FullPipeline, topicId);

    this.runDetached(job, async () => {
      const freshTopic = await topicService.getById(topicId);
      const course = await curriculumService.ensureCourseForTopic(freshTopic);

      await jobService.markRunning(job, JobStage.Researching, 8);
      await jobService.addLog(job, `Researching "${freshTopic.title}"...`);
      const research = await researchService.research(freshTopic, course.id);

      await jobService.setStage(job, JobStage.WritingMaster, 32);
      await jobService.addLog(job, `MASTER.md written to ${research.masterMarkdownPath}`);
      const masterMarkdown = await researchService.readMaster(research);

      course.researchId = research._id;
      await course.save();

      await jobService.setStage(job, JobStage.Planning, 40);
      await jobService.addLog(job, 'Planning the curriculum...');
      const plannedCourse = await curriculumService.plan(course, masterMarkdown);
      await jobService.addLog(
        job,
        `COURSE.md written (${plannedCourse.estimatedDuration} min estimated).`,
      );

      await jobService.setStage(job, JobStage.GeneratingLessons, 50);
      const lessonResult = await lessonService.generateAllForCourse(
        plannedCourse,
        masterMarkdown,
        async (completed, total, lessonTitle) => {
          const progress = 50 + Math.round((completed / total) * 40);
          await jobService.setStage(job, JobStage.GeneratingLessons, progress);
          await jobService.addLog(job, `Lesson ${completed}/${total}: ${lessonTitle}`);
        },
      );

      await jobService.setStage(job, JobStage.GeneratingTeaser, 92);
      await jobService.addLog(job, 'Writing the teaser script...');
      const teaser = await teaserService.generate(plannedCourse, masterMarkdown);

      await topicService.setStatus(freshTopic, TopicStatus.CourseGenerated);

      return {
        topicId,
        courseId: plannedCourse.id,
        researchId: research.id,
        teaserId: teaser.id,
        masterMarkdownPath: research.masterMarkdownPath,
        coursePlanPath: plannedCourse.coursePlanPath,
        teaserMarkdownPath: teaser.markdownPath,
        lessonsGenerated: lessonResult.generated,
        lessonsFailed: lessonResult.failed,
      };
    });

    return this.describe(job);
  }

  /** Research only — useful when a human wants to review MASTER.md first. */
  async startResearch(topicId: string): Promise<StartedJob> {
    const topic = await topicService.getById(topicId);
    const job = await jobService.create(JobType.Research, topicId);

    this.runDetached(job, async () => {
      const course = await curriculumService.ensureCourseForTopic(topic);
      await jobService.markRunning(job, JobStage.Researching, 15);
      await jobService.addLog(job, `Researching "${topic.title}"...`);
      const research = await researchService.research(topic, course.id);
      course.researchId = research._id;
      await course.save();
      await jobService.setStage(job, JobStage.WritingMaster, 90);
      await jobService.addLog(job, `MASTER.md written to ${research.masterMarkdownPath}`);
      return {
        topicId,
        courseId: course.id,
        researchId: research.id,
        masterMarkdownPath: research.masterMarkdownPath,
      };
    });

    return this.describe(job);
  }

  /** Course plan + lessons for a course whose research already exists. */
  async startCourseGeneration(courseId: string): Promise<StartedJob> {
    const course = await curriculumService.getCourse(courseId);
    const job = await jobService.create(JobType.CoursePlan, courseId);

    this.runDetached(job, async () => {
      const research = await researchService.getByTopicId(String(course.topicId));
      const masterMarkdown = await researchService.readMaster(research);

      await jobService.markRunning(job, JobStage.Planning, 15);
      await jobService.addLog(job, 'Planning the curriculum...');
      const plannedCourse = await curriculumService.plan(course, masterMarkdown);

      await jobService.setStage(job, JobStage.GeneratingLessons, 40);
      const lessonResult = await lessonService.generateAllForCourse(
        plannedCourse,
        masterMarkdown,
        async (completed, total, lessonTitle) => {
          await jobService.setStage(
            job,
            JobStage.GeneratingLessons,
            40 + Math.round((completed / total) * 55),
          );
          await jobService.addLog(job, `Lesson ${completed}/${total}: ${lessonTitle}`);
        },
      );

      return {
        courseId: plannedCourse.id,
        coursePlanPath: plannedCourse.coursePlanPath,
        ...lessonResult,
      };
    });

    return this.describe(job);
  }

  /** Teaser only. */
  async startTeaserGeneration(courseId: string): Promise<StartedJob> {
    const course = await curriculumService.getCourse(courseId);
    const job = await jobService.create(JobType.Teaser, courseId);

    this.runDetached(job, async () => {
      const research = await researchService.getByTopicId(String(course.topicId));
      const masterMarkdown = await researchService.readMaster(research);
      await jobService.markRunning(job, JobStage.GeneratingTeaser, 25);
      const teaser = await teaserService.generate(course, masterMarkdown);
      return { courseId, teaserId: teaser.id, markdownPath: teaser.markdownPath };
    });

    return this.describe(job);
  }

  /** Regenerate a single lesson (retry after a failure, or after editing the plan). */
  async regenerateLesson(lessonId: string): Promise<StartedJob> {
    const lesson = await lessonService.getById(lessonId);
    const course = await curriculumService.getCourse(String(lesson.courseId));
    const job = await jobService.create(JobType.Lessons, lessonId);

    this.runDetached(job, async () => {
      const research = await researchService.getByTopicId(String(course.topicId));
      const masterMarkdown = await researchService.readMaster(research);
      const tree = await curriculumService.getCourseTree(course.id);
      const section = tree.sections.find(
        (candidate) => String(candidate._id) === String(lesson.sectionId),
      );

      await jobService.markRunning(job, JobStage.GeneratingLessons, 30);
      await jobService.addLog(job, `Regenerating "${lesson.title}"...`);
      await lessonService.generateOne(course, lesson, {
        masterMarkdown,
        sectionTitle: section?.title ?? 'Section',
        sectionOrder: section?.order ?? 1,
      });

      if (course.status === CourseStatus.Failed) {
        course.status = CourseStatus.Ready;
        course.error = null;
        await course.save();
      }

      return { lessonId, markdownPath: lesson.markdownPath };
    });

    return this.describe(job);
  }

  /**
   * Runs the work outside the HTTP request/response cycle.
   * Any thrown error is recorded on the job (and pushed to the UI) instead of
   * becoming an unhandled rejection.
   */
  private runDetached(job: GenerationJobDocument, work: () => Promise<unknown>): void {
    void (async () => {
      try {
        const result = await work();
        await jobService.complete(job, result);
      } catch (error) {
        log.error(`job ${job.id} failed`, error);
        try {
          await jobService.fail(job, error);
        } catch (saveError) {
          log.error(`could not record failure for job ${job.id}`, saveError);
        }
      }
    })();
  }

  private describe(job: GenerationJobDocument): StartedJob {
    return { jobId: job.id, status: job.status, type: job.type, entityId: job.entityId };
  }
}

export const generationOrchestrator = new GenerationOrchestrator();
