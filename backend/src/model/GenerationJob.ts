import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { JobStage, JobStatus, JobType, values } from './enums.js';

const jobLogSchema = new Schema(
  {
    at: { type: Date, default: () => new Date() },
    message: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const generationJobSchema = new Schema(
  {
    type: { type: String, enum: values(JobType), required: true },
    /** Topic id, course id, or 'system' for discovery runs. */
    entityId: { type: String, required: true, index: false },
    status: { type: String, enum: values(JobStatus), default: JobStatus.Queued },
    stage: { type: String, enum: values(JobStage), default: JobStage.Queued },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    logs: { type: [jobLogSchema], default: [] },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'generation_jobs' },
);

/* ------------------------------- INDEXES -------------------------------
 * The Generation screen polls/streams "what is running and what just
 * finished", and the orchestrator must refuse to start a second job for the
 * same entity while one is in flight.
 * ---------------------------------------------------------------------- */

// Guard against two concurrent jobs for the same entity + type.
generationJobSchema.index({ entityId: 1, type: 1, status: 1 }, { name: 'job_entity_type_status' });

// Generation screen: active jobs first, newest first.
generationJobSchema.index({ status: 1, createdAt: -1 }, { name: 'job_status_createdAt' });
generationJobSchema.index({ createdAt: -1 }, { name: 'job_createdAt' });

export type GenerationJob = InferSchemaType<typeof generationJobSchema>;
export type GenerationJobDocument = HydratedDocument<GenerationJob>;
export const GenerationJobModel = model('GenerationJob', generationJobSchema);
