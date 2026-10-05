import { z } from 'zod';
import { Audience, CourseDepth, values } from '../model/enums.js';

/** Request validation schemas, shared by the controllers. */

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

export const idParams = z.object({ id: objectId });
export const topicIdParams = z.object({ topicId: objectId });
export const courseIdParams = z.object({ courseId: objectId });

const audienceEnum = z.enum(values(Audience) as [string, ...string[]]);
const depthEnum = z.enum(values(CourseDepth) as [string, ...string[]]);

export const createTopicBody = z.object({
  title: z.string().trim().min(5, 'A topic title needs at least 5 characters').max(300),
  description: z.string().trim().max(4000).optional(),
  whatYouWillBuild: z.string().trim().max(1000).optional(),
  /** Naming the tool lets research fetch its real documentation. */
  toolName: z.string().trim().max(120).optional(),
  toolUrl: z.string().trim().url('The tool URL must be a valid URL').max(500).optional(),
  category: z.string().trim().max(80).optional(),
  audience: audienceEnum.optional(),
  desiredDepth: depthEnum.optional(),
  sources: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        url: z.string().trim().url('Each source needs a valid URL'),
        origin: z.string().trim().max(120).optional(),
      }),
    )
    .max(25)
    .optional(),
});

export const approveTopicBody = z
  .object({
    audience: audienceEnum.optional(),
    desiredDepth: depthEnum.optional(),
  })
  .default({});

export const rejectTopicBody = z
  .object({ reason: z.string().trim().max(500).optional() })
  .default({});

export const listTopicsQuery = z.object({
  status: z.string().trim().max(40).optional(),
  audience: audienceEnum.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const listQuery = z.object({
  status: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const discoveryBody = z
  .object({ maxCandidates: z.coerce.number().int().min(1).max(30).optional() })
  .default({});

export const lessonMarkdownBody = z.object({
  markdown: z.string().min(1, 'Lesson markdown cannot be empty').max(400_000),
});
