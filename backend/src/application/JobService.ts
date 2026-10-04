import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { RealtimeEvent, realtime } from '../infrastructure/realtime/RealtimeGateway.js';
import {
  GenerationJobModel,
  JobStage,
  JobStatus,
  type GenerationJobDocument,
  type JobType,
} from '../model/index.js';

const log = createLogger('jobs');

/**
 * Tracks long-running generation work.
 *
 * V1 runs the work in-process (see GenerationOrchestrator) but the HTTP request
 * returns a jobId immediately and progress is pushed over socket.io. Because
 * all progress reporting goes through this service, Phase 5 can move execution
 * into a BullMQ worker without changing the API or the frontend.
 */
export class JobService {
  async create(type: JobType, entityId: string): Promise<GenerationJobDocument> {
    const active = await GenerationJobModel.findOne({
      entityId,
      type,
      status: { $in: [JobStatus.Queued, JobStatus.Running] },
    });

    if (active) {
      throw AppError.conflict(`A "${type}" job is already running for this item.`, {
        jobId: active.id,
      });
    }

    const job = await GenerationJobModel.create({
      type,
      entityId,
      status: JobStatus.Queued,
      stage: JobStage.Queued,
      progress: 0,
    });

    log.info(`job ${job.id} created (${type} / ${entityId})`);
    this.publish(job);
    return job;
  }

  async markRunning(job: GenerationJobDocument, stage: string, progress = 5): Promise<void> {
    job.status = JobStatus.Running;
    job.stage = stage as GenerationJobDocument['stage'];
    job.progress = progress;
    job.startedAt = job.startedAt ?? new Date();
    await job.save();
    this.publish(job);
  }

  async setStage(job: GenerationJobDocument, stage: string, progress: number): Promise<void> {
    job.stage = stage as GenerationJobDocument['stage'];
    job.progress = Math.max(0, Math.min(100, Math.round(progress)));
    await job.save();
    this.publish(job);
  }

  /** Human-readable progress line; stored on the job and streamed to clients. */
  async addLog(job: GenerationJobDocument, message: string): Promise<void> {
    const at = new Date();
    job.logs.push({ at, message });
    if (job.logs.length > 200) job.logs.splice(0, job.logs.length - 200);
    await job.save();
    log.info(`job ${job.id}: ${message}`);
    realtime.emitToJob(job.id, RealtimeEvent.JobLog, {
      jobId: job.id,
      message,
      at: at.toISOString(),
    });
  }

  async complete(job: GenerationJobDocument, result: unknown): Promise<void> {
    job.status = JobStatus.Completed;
    job.stage = JobStage.Completed;
    job.progress = 100;
    job.result = result ?? null;
    job.error = null;
    job.completedAt = new Date();
    await job.save();
    log.info(`job ${job.id} completed`);
    this.publish(job);
  }

  async fail(job: GenerationJobDocument, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    job.status = JobStatus.Failed;
    job.error = message;
    job.completedAt = new Date();
    await job.save();
    log.error(`job ${job.id} failed: ${message}`);
    this.publish(job);
  }

  async list(options: { status?: string; limit?: number } = {}) {
    const query = options.status ? { status: options.status } : {};
    return GenerationJobModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(options.limit ?? 30, 100))
      .lean();
  }

  async getById(id: string): Promise<GenerationJobDocument> {
    const job = await GenerationJobModel.findById(id);
    if (!job) throw AppError.notFound(`Job ${id} was not found.`);
    return job;
  }

  private publish(job: GenerationJobDocument): void {
    realtime.emitToJob(job.id, RealtimeEvent.JobUpdated, {
      jobId: job.id,
      type: job.type,
      entityId: job.entityId,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      error: job.error,
      updatedAt: new Date().toISOString(),
    });
  }
}

export const jobService = new JobService();
