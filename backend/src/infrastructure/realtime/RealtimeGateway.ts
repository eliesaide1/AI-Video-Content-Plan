import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { config, isProduction } from '../config.js';
import { createLogger } from '../logger.js';
import { RealtimeEvent, type RealtimeEventName } from './events.js';

const log = createLogger('realtime');

/**
 * Thin wrapper around socket.io.
 *
 * The application layer only calls `realtime.emit(...)` / `emitToJob(...)`, so
 * the transport stays an infrastructure detail. Clients can subscribe to a
 * single job room (`job:<id>`) to avoid receiving every job's traffic.
 */
class RealtimeGateway {
  private io: SocketServer | null = null;

  attach(httpServer: HttpServer): SocketServer {
    this.io = new SocketServer(httpServer, {
      path: '/realtime',
      cors: {
        // Same rule as the HTTP layer: configured origins, plus any localhost
        // port while developing.
        origin: (origin, callback) => {
          const allowed =
            !origin ||
            config.corsOrigin.includes(origin) ||
            (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
          callback(allowed ? null : new Error(`Origin ${origin} is not allowed`), allowed);
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.io.on('connection', (socket: Socket) => {
      log.info(`client connected: ${socket.id}`);

      socket.on('job:subscribe', (jobId: unknown) => {
        if (typeof jobId === 'string' && jobId) {
          void socket.join(roomFor(jobId));
          log.debug(`${socket.id} subscribed to ${roomFor(jobId)}`);
        }
      });

      socket.on('job:unsubscribe', (jobId: unknown) => {
        if (typeof jobId === 'string' && jobId) void socket.leave(roomFor(jobId));
      });

      socket.on('disconnect', (reason) => log.info(`client ${socket.id} disconnected (${reason})`));
    });

    log.info('socket.io gateway attached at /realtime');
    return this.io;
  }

  /** Broadcast to every connected client. */
  emit(event: RealtimeEventName, payload: unknown): void {
    this.io?.emit(event, payload);
  }

  /**
   * Send to the clients watching one specific job.
   *
   * Job status changes also go to everyone else (the Generation screen lists
   * all jobs), but `except(room)` keeps subscribed clients from receiving the
   * same event twice.
   */
  emitToJob(jobId: string, event: RealtimeEventName, payload: unknown): void {
    if (!this.io) return;
    const room = roomFor(jobId);
    this.io.to(room).emit(event, payload);
    if (event === RealtimeEvent.JobUpdated) this.io.except(room).emit(event, payload);
  }

  async close(): Promise<void> {
    await this.io?.close();
    this.io = null;
  }

  get isAttached(): boolean {
    return this.io !== null;
  }
}

function roomFor(jobId: string): string {
  return `job:${jobId}`;
}

export const realtime = new RealtimeGateway();
export { RealtimeEvent } from './events.js';
export type { JobUpdatePayload, JobLogPayload, RealtimeEventName } from './events.js';
