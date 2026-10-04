import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { LessonStatus, values } from './enums.js';

const lessonSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    learningObjective: { type: String, default: '', trim: true, maxlength: 1000 },
    /** Order within the course (stable across sections). */
    order: { type: Number, required: true, min: 1 },
    /** Order within the owning section — drives the lesson-NN.md file name. */
    orderInSection: { type: Number, required: true, min: 1 },
    estimatedDuration: { type: Number, default: 0, min: 0 },
    markdownPath: { type: String, default: null },
    status: { type: String, enum: values(LessonStatus), default: LessonStatus.Pending },
    /** Phase 4 placeholder; unused in V1 but part of the agreed entity. */
    videoPath: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: 'lessons' },
);

/* ------------------------------- INDEXES ------------------------------- */

// Section detail: lessons in order, uniquely positioned.
lessonSchema.index({ sectionId: 1, orderInSection: 1 }, { name: 'lesson_section_order_unique', unique: true });

// Course detail: the whole curriculum in reading order.
lessonSchema.index({ courseId: 1, order: 1 }, { name: 'lesson_course_order' });

// Generation progress / retry of failed lessons.
lessonSchema.index({ courseId: 1, status: 1 }, { name: 'lesson_course_status' });

export type Lesson = InferSchemaType<typeof lessonSchema>;
export type LessonDocument = HydratedDocument<Lesson>;
export const LessonModel = model('Lesson', lessonSchema);
