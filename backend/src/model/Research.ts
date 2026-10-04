import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ResearchStatus, values } from './enums.js';
import { sourceRefSchema } from './Topic.js';

/**
 * A research claim with its confidence class. The spec requires us to
 * distinguish verified facts from AI explanation/recommendation/assumption so
 * uncertain information is never presented as fact.
 */
const claimSchema = new Schema(
  {
    statement: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ['verified-fact', 'ai-explanation', 'recommendation', 'assumption'],
      required: true,
    },
    sourceUrls: { type: [String], default: [] },
  },
  { _id: false },
);

const researchSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    status: { type: String, enum: values(ResearchStatus), default: ResearchStatus.Pending },
    summary: { type: String, default: '', trim: true },
    masterMarkdownPath: { type: String, default: null },
    sourcesMarkdownPath: { type: String, default: null },
    sources: { type: [sourceRefSchema], default: [] },
    claims: { type: [claimSchema], default: [] },
    aiModel: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: 'research' },
);

/* ------------------------------- INDEXES ------------------------------- */

// One research document per topic — also prevents duplicate research runs.
researchSchema.index({ topicId: 1 }, { name: 'research_topic_unique', unique: true });

// Worker/dashboard queries by state, newest first.
researchSchema.index({ status: 1, updatedAt: -1 }, { name: 'research_status_updatedAt' });

// Jump from a course back to its research.
researchSchema.index({ courseId: 1 }, { name: 'research_course', sparse: true });

export type Research = InferSchemaType<typeof researchSchema>;
export type ResearchDocument = HydratedDocument<Research>;
export const ResearchModel = model('Research', researchSchema);
