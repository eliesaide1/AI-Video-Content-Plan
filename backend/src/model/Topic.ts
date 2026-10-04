import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { Audience, CourseDepth, TopicStatus, values } from './enums.js';

/** A source backing a topic or a research claim — kept so content is auditable. */
export const sourceRefSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    origin: { type: String, trim: true },
    publishedAt: { type: Date },
    retrievedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const topicSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    /** Normalised title used to detect duplicates / already-covered topics. */
    dedupeKey: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true, maxlength: 4000 },
    /** The concrete thing a student has working when the course ends. A topic
     *  without this is a lecture subject, not a course. */
    whatYouWillBuild: { type: String, default: '', trim: true, maxlength: 1000 },
    whoBenefits: { type: String, default: '', trim: true, maxlength: 500 },
    whyNow: { type: String, default: '', trim: true, maxlength: 1000 },
    prerequisites: { type: [String], default: [] },
    category: { type: String, default: 'general', trim: true, index: true },
    audience: { type: String, enum: values(Audience), default: Audience.Intermediate },
    desiredDepth: { type: String, enum: values(CourseDepth), default: CourseDepth.Medium },
    score: { type: Number, default: 0, min: 0, max: 100 },
    rankingReasons: { type: [String], default: [] },
    sources: { type: [sourceRefSchema], default: [] },
    status: {
      type: String,
      enum: values(TopicStatus),
      default: TopicStatus.Candidate,
    },
    /** Set when the topic came from automated discovery rather than manual entry. */
    discoveryRunId: { type: String, default: null },
    discoveredAt: { type: Date, default: () => new Date() },
    rejectedReason: { type: String, default: null },
  },
  { timestamps: true, collection: 'topics' },
);

/* ------------------------------- INDEXES -------------------------------
 * Driven by the real V1 queries:
 *  - the Discover screen lists candidates best-first
 *  - discovery must not re-suggest an already covered topic
 *  - "similar to previous courses" needs a text search over title+description
 * ---------------------------------------------------------------------- */

// Dashboard: candidates/approved lists, highest score first.
topicSchema.index({ status: 1, score: -1 }, { name: 'topic_status_score' });

// Dashboard: newest first.
topicSchema.index({ discoveredAt: -1 }, { name: 'topic_discoveredAt' });

// Deduplication guard: the same normalised title can never be stored twice.
topicSchema.index({ dedupeKey: 1 }, { name: 'topic_dedupeKey_unique', unique: true });

// Similarity search against previously covered topics.
topicSchema.index(
  { title: 'text', description: 'text' },
  { name: 'topic_text_search', weights: { title: 5, description: 1 } },
);

// Audience-filtered browsing.
topicSchema.index({ audience: 1, status: 1 }, { name: 'topic_audience_status' });

// Grouping the output of one discovery run.
topicSchema.index({ discoveryRunId: 1 }, { name: 'topic_discoveryRun', sparse: true });

export type Topic = InferSchemaType<typeof topicSchema>;
export type TopicDocument = HydratedDocument<Topic>;
export const TopicModel = model('Topic', topicSchema);

/** Normalises a title into a dedupe key: lowercase, alphanumeric words only. */
export function buildDedupeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join('-');
}
