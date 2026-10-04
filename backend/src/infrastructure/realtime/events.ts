/** Channel names shared with the frontend (see frontend/src/shared/sharedService.ts). */
export const RealtimeEvent = {
  JobUpdated: 'job:updated',
  JobLog: 'job:log',
  TopicUpdated: 'topic:updated',
  CourseUpdated: 'course:updated',
  LessonUpdated: 'lesson:updated',
  TeaserUpdated: 'teaser:updated',
  DiscoveryCompleted: 'discovery:completed',
} as const;

export type RealtimeEventName = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export interface JobUpdatePayload {
  jobId: string;
  type: string;
  entityId: string;
  status: string;
  stage?: string;
  progress: number;
  error?: string | null;
  updatedAt: string;
}

export interface JobLogPayload {
  jobId: string;
  message: string;
  at: string;
}
