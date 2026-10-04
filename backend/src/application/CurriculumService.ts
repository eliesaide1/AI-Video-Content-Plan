import { aiService } from '../infrastructure/ai/index.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { RealtimeEvent, realtime } from '../infrastructure/realtime/RealtimeGateway.js';
import { contentPaths, storageService } from '../infrastructure/storage/index.js';
import {
  CourseModel,
  CourseStatus,
  LessonModel,
  LessonStatus,
  SectionModel,
  type CourseDocument,
  type CourseLevel,
  type TopicDocument,
} from '../model/index.js';
import { renderCourseMarkdown } from './markdown.js';
import { systemPrompts, userPrompts } from './prompts/index.js';
import { coursePlanJsonSchema, coursePlanZ, type CoursePlan } from './schemas.js';

const log = createLogger('curriculum');

/**
 * Course planner: MASTER.md -> COURSE.md + Section/Lesson rows.
 *
 * Lessons are created as `pending` placeholders here; LessonService fills in
 * their markdown afterwards. That split keeps the curriculum visible in the UI
 * immediately, and makes lesson generation individually retryable.
 */
export class CurriculumService {
  /** One course per topic — reused on re-runs so we never duplicate a course. */
  async ensureCourseForTopic(topic: TopicDocument): Promise<CourseDocument> {
    const existing = await CourseModel.findOne({ topicId: topic._id });
    if (existing) return existing;

    return CourseModel.create({
      topicId: topic._id,
      title: topic.title,
      description: topic.description,
      targetAudience: topic.audience,
      desiredDepth: topic.desiredDepth,
      status: CourseStatus.Draft,
    });
  }

  async plan(course: CourseDocument, masterMarkdown: string): Promise<CourseDocument> {
    course.status = CourseStatus.Planning;
    course.error = null;
    await course.save();

    try {
      const { value: plan } = await aiService.generateStructuredOutput({
        system: systemPrompts.curriculum,
        prompt: userPrompts.coursePlan({
          title: course.title,
          masterMarkdown,
          context: { audience: course.targetAudience, depth: course.desiredDepth },
        }),
        schemaName: 'course_plan',
        schemaDescription: 'Curriculum: sections and lessons in teaching order',
        jsonSchema: coursePlanJsonSchema,
        validate: (raw) => coursePlanZ.parse(raw),
        temperature: 0.4,
        mock: () => mockPlan(course.title),
      });

      const estimatedDuration = plan.sections.reduce(
        (total, section) =>
          total + section.lessons.reduce((sum, lesson) => sum + lesson.estimatedDuration, 0),
        0,
      );

      await this.replaceCurriculum(course, plan);

      const coursePlanPath = contentPaths.coursePlan(course.id);
      await storageService.save(
        coursePlanPath,
        renderCourseMarkdown({
          plan,
          audience: course.targetAudience,
          estimatedDurationMinutes: estimatedDuration,
        }),
      );

      course.title = plan.title;
      course.description = plan.description;
      course.level = plan.level as CourseLevel;
      course.learningObjectives = plan.learningObjectives;
      course.prerequisites = plan.prerequisites;
      course.estimatedDuration = estimatedDuration;
      course.coursePlanPath = coursePlanPath;
      course.status = CourseStatus.Planned;
      await course.save();

      log.info(
        `planned course ${course.id}: ${plan.sections.length} section(s), ${estimatedDuration} min`,
      );
      realtime.emit(RealtimeEvent.CourseUpdated, { courseId: course.id, status: course.status });
      return course;
    } catch (error) {
      course.status = CourseStatus.Failed;
      course.error = error instanceof Error ? error.message : String(error);
      await course.save();
      realtime.emit(RealtimeEvent.CourseUpdated, { courseId: course.id, status: course.status });
      throw error;
    }
  }

  /**
   * Replaces the previous curriculum for this course.
   * Sections/lessons are keyed by (course, order) with unique indexes, so a
   * regenerated plan must clear the old rows before inserting the new ones.
   */
  private async replaceCurriculum(course: CourseDocument, plan: CoursePlan): Promise<void> {
    await Promise.all([
      SectionModel.deleteMany({ courseId: course._id }),
      LessonModel.deleteMany({ courseId: course._id }),
    ]);

    let lessonOrder = 0;

    for (const [sectionIndex, plannedSection] of plan.sections.entries()) {
      const section = await SectionModel.create({
        courseId: course._id,
        title: plannedSection.title,
        description: plannedSection.description,
        order: sectionIndex + 1,
      });

      for (const [lessonIndex, plannedLesson] of plannedSection.lessons.entries()) {
        lessonOrder += 1;
        await LessonModel.create({
          courseId: course._id,
          sectionId: section._id,
          title: plannedLesson.title,
          learningObjective: plannedLesson.learningObjective,
          order: lessonOrder,
          orderInSection: lessonIndex + 1,
          estimatedDuration: plannedLesson.estimatedDuration,
          status: LessonStatus.Pending,
        });
      }
    }
  }

  async getCourse(courseId: string): Promise<CourseDocument> {
    const course = await CourseModel.findById(courseId);
    if (!course) throw AppError.notFound(`Course ${courseId} was not found.`);
    return course;
  }

  /** Full curriculum tree for the Course Details screen. */
  async getCourseTree(courseId: string) {
    const course = await this.getCourse(courseId);
    const [sections, lessons] = await Promise.all([
      SectionModel.find({ courseId: course._id }).sort({ order: 1 }).lean(),
      LessonModel.find({ courseId: course._id }).sort({ order: 1 }).lean(),
    ]);

    return {
      course: course.toObject(),
      sections: sections.map((section) => ({
        ...section,
        lessons: lessons.filter((lesson) => String(lesson.sectionId) === String(section._id)),
      })),
    };
  }

  async list(options: { status?: string; limit?: number } = {}) {
    const query = options.status ? { status: options.status } : {};
    return CourseModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(options.limit ?? 50, 200))
      .lean();
  }
}

export const curriculumService = new CurriculumService();

/** Offline fixture. */
function mockPlan(title: string): CoursePlan {
  return coursePlanZ.parse({
    title,
    description: `Mock curriculum for "${title}". Set AI_API_KEY for real planning.`,
    level: 'intermediate',
    learningObjectives: ['Understand the topic', 'Build something small with it'],
    prerequisites: ['Basic programming knowledge'],
    sections: [
      {
        title: 'Introduction',
        description: 'Orientation and motivation.',
        lessons: [
          {
            title: 'What We Are Building',
            learningObjective: 'Understand the goal of the course.',
            estimatedDuration: 8,
            concepts: ['Overview'],
          },
          {
            title: 'Core Ideas',
            learningObjective: 'Learn the key concepts.',
            estimatedDuration: 12,
            concepts: ['Fundamentals'],
          },
        ],
      },
      {
        title: 'Hands On',
        description: 'Build a small project.',
        lessons: [
          {
            title: 'Building the First Example',
            learningObjective: 'Apply the concepts in practice.',
            estimatedDuration: 15,
            concepts: ['Implementation'],
          },
        ],
      },
    ],
  });
}
