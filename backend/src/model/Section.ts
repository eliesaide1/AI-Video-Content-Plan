import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const sectionSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    order: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, collection: 'sections' },
);

/* ------------------------------- INDEXES ------------------------------- */

// Course detail screen reads sections in order; uniqueness keeps the curriculum
// consistent if a plan is regenerated concurrently.
sectionSchema.index({ courseId: 1, order: 1 }, { name: 'section_course_order_unique', unique: true });

export type Section = InferSchemaType<typeof sectionSchema>;
export type SectionDocument = HydratedDocument<Section>;
export const SectionModel = model('Section', sectionSchema);
