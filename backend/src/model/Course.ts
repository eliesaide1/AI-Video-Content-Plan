import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { Audience, CourseDepth, CourseLevel, CourseStatus, values } from './enums.js';

const courseSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
    researchId: { type: Schema.Types.ObjectId, ref: 'Research', default: null },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '', trim: true, maxlength: 4000 },
    level: { type: String, enum: values(CourseLevel), default: CourseLevel.Intermediate },
    targetAudience: { type: String, enum: values(Audience), default: Audience.Intermediate },
    desiredDepth: { type: String, enum: values(CourseDepth), default: CourseDepth.Medium },
    /** Minutes. Derived from the lessons the AI judged necessary — never padded. */
    estimatedDuration: { type: Number, default: 0, min: 0 },
    learningObjectives: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    coursePlanPath: { type: String, default: null },
    status: { type: String, enum: values(CourseStatus), default: CourseStatus.Draft },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: 'courses' },
);

/* ------------------------------- INDEXES ------------------------------- */

// "Avoid duplicate course generation": one course per topic.
courseSchema.index({ topicId: 1 }, { name: 'course_topic_unique', unique: true });

// Courses screen: newest first, optionally filtered by state.
courseSchema.index({ status: 1, createdAt: -1 }, { name: 'course_status_createdAt' });
courseSchema.index({ createdAt: -1 }, { name: 'course_createdAt' });

// Browsing by audience/level.
courseSchema.index({ targetAudience: 1, level: 1 }, { name: 'course_audience_level' });

// Finding similar existing courses by title.
courseSchema.index({ title: 'text', description: 'text' }, { name: 'course_text_search' });

export type Course = InferSchemaType<typeof courseSchema>;
export type CourseDocument = HydratedDocument<Course>;
export const CourseModel = model('Course', courseSchema);
