import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { TeaserStatus, values } from './enums.js';

/** One beat of the 15-30s teaser (hook -> problem -> idea -> outcome -> CTA). */
const beatSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    startSecond: { type: Number, required: true, min: 0 },
    endSecond: { type: Number, required: true, min: 0 },
    narration: { type: String, required: true, trim: true },
    onScreenText: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const teaserSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    hook: { type: String, default: '', trim: true },
    callToAction: { type: String, default: '', trim: true },
    /** Seconds. Constrained to the 15-30s window the spec asks for. */
    duration: { type: Number, default: 30, min: 10, max: 60 },
    beats: { type: [beatSchema], default: [] },
    markdownPath: { type: String, default: null },
    /** Phase 2 writes the structured scene JSON here. */
    scenesPath: { type: String, default: null },
    /** Phase 4 placeholder. */
    videoPath: { type: String, default: null },
    status: { type: String, enum: values(TeaserStatus), default: TeaserStatus.Pending },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: 'teasers' },
);

/* ------------------------------- INDEXES ------------------------------- */

// One teaser per course.
teaserSchema.index({ courseId: 1 }, { name: 'teaser_course_unique', unique: true });
teaserSchema.index({ status: 1, updatedAt: -1 }, { name: 'teaser_status_updatedAt' });

export type Teaser = InferSchemaType<typeof teaserSchema>;
export type TeaserDocument = HydratedDocument<Teaser>;
export const TeaserModel = model('Teaser', teaserSchema);
