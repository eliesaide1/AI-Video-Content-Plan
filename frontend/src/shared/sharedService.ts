import { io, type Socket } from 'socket.io-client';

/**
 * ============================================================================
 *  sharedService.ts — THE ONLY FILE THAT TALKS TO THE BACKEND
 * ============================================================================
 *
 * Rules this file enforces for the whole app:
 *   1. Screens never call `fetch` themselves. They call `sharedService.*`.
 *   2. Every request goes through ONE function — `clientProxy` — so headers,
 *      the response envelope and error handling exist in exactly one place.
 *   3. Every server error goes through ONE function — `handleServerError` —
 *      which returns the error from the backend AND raises the global alert
 *      rendered by the <VC_Alert /> component.
 *   4. No API keys here. All provider keys stay server-side.
 */

// `import.meta.env` is injected by Vite. The optional chain keeps this module
// importable outside Vite too (unit tests, server-side rendering).
export const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4500';

/* ==========================================================================
 *  Types mirrored from the backend
 * ======================================================================== */

export interface ServerError {
  message: string;
  code: string;
  status: number;
  details?: unknown;
  requestId?: string;
}

/** Thrown by clientProxy after the alert has already been shown. */
export class ApiError extends Error {
  constructor(readonly serverError: ServerError) {
    super(serverError.message);
    this.name = 'ApiError';
  }
}

export type Audience =
  | 'junior-developers'
  | 'intermediate-developers'
  | 'advanced-developers'
  | 'non-technical-users'
  | 'students'
  | 'business-users';

export type CourseDepth = 'short' | 'medium' | 'large';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export interface SourceRef {
  title: string;
  url: string;
  origin?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
}

export interface Topic {
  _id: string;
  title: string;
  description: string;
  /** The concrete thing the student has working at the end of the course. */
  whatYouWillBuild: string;
  /** The tool the topic is built around — what the viewer installs. */
  toolName: string;
  toolUrl: string;
  isFreeOrOpenSource: boolean;
  /** The quantified payoff that makes the hook, e.g. "70% fewer tokens". */
  measurableOutcome: string;
  credibilityAnchor: string;
  /** How the topic would appear as a video. */
  videoTitleArabic: string;
  videoTitleEnglish: string;
  thumbnailText: string;
  hookLine: string;
  whoBenefits: string;
  whyNow: string;
  prerequisites: string[];
  category: string;
  audience: Audience;
  desiredDepth: CourseDepth;
  score: number;
  rankingReasons: string[];
  sources: SourceRef[];
  status:
    | 'candidate'
    | 'approved'
    | 'rejected'
    | 'researching'
    | 'researched'
    | 'course-generated';
  discoveredAt: string;
  rejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchClaim {
  statement: string;
  kind: 'verified-fact' | 'ai-explanation' | 'recommendation' | 'assumption';
  sourceUrls: string[];
}

export interface Research {
  _id: string;
  topicId: string;
  courseId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: string;
  masterMarkdownPath: string | null;
  sourcesMarkdownPath: string | null;
  sources: SourceRef[];
  claims: ResearchClaim[];
  aiModel: string | null;
  error: string | null;
}

export interface MasterDocument {
  topicId: string;
  path: string | null;
  markdown: string;
  sources: SourceRef[];
  claims: ResearchClaim[];
}

export interface Course {
  _id: string;
  topicId: string;
  researchId: string | null;
  title: string;
  description: string;
  level: CourseLevel;
  targetAudience: Audience;
  desiredDepth: CourseDepth;
  estimatedDuration: number;
  learningObjectives: string[];
  prerequisites: string[];
  coursePlanPath: string | null;
  status: 'draft' | 'planning' | 'planned' | 'generating-lessons' | 'ready' | 'failed';
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  _id: string;
  courseId: string;
  sectionId: string;
  title: string;
  learningObjective: string;
  order: number;
  orderInSection: number;
  estimatedDuration: number;
  markdownPath: string | null;
  status: 'pending' | 'generating' | 'generated' | 'edited' | 'failed';
  error: string | null;
}

export interface Section {
  _id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
}

export interface CourseTree {
  course: Course;
  sections: Section[];
}

export interface TeaserBeat {
  label: string;
  startSecond: number;
  endSecond: number;
  narration: string;
  onScreenText: string;
}

export interface Teaser {
  _id: string;
  courseId: string;
  hook: string;
  callToAction: string;
  duration: number;
  beats: TeaserBeat[];
  markdownPath: string | null;
  scenesPath: string | null;
  status: 'pending' | 'generating' | 'generated' | 'failed';
  error: string | null;
  updatedAt: string;
}

export interface GenerationJob {
  _id: string;
  type: 'discovery' | 'research' | 'course-plan' | 'lessons' | 'teaser' | 'full-pipeline';
  entityId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  progress: number;
  logs: { at: string; message: string }[];
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface StartedJob {
  jobId: string;
  status: string;
  type: string;
  entityId: string;
}

export interface HealthInfo {
  status: string;
  env: string;
  database: string;
  realtime: string;
  aiProvider: string;
  aiModel: string;
  time: string;
}

export interface MetaInfo {
  audiences: Audience[];
  depths: CourseDepth[];
  levels: CourseLevel[];
}

export interface MarkdownDocument {
  path: string | null;
  markdown: string;
}

/* ==========================================================================
 *  GLOBAL ALERT CHANNEL
 *  Rendered by components/VC_Alert.tsx — see handleServerError below.
 * ======================================================================== */

export type AlertKind = 'error' | 'success' | 'info';

export interface AppAlert {
  id: string;
  kind: AlertKind;
  title: string;
  message: string;
  details?: string[];
  requestId?: string;
  createdAt: number;
}

let alerts: AppAlert[] = [];
const alertListeners = new Set<(current: AppAlert[]) => void>();
let alertSequence = 0;

function publishAlerts(): void {
  const snapshot = alerts;
  alertListeners.forEach((listener) => listener(snapshot));
}

/** VC_Alert subscribes here. Returns the unsubscribe function. */
export function subscribeToAlerts(listener: (current: AppAlert[]) => void): () => void {
  alertListeners.add(listener);
  listener(alerts);
  return () => alertListeners.delete(listener);
}

export function getAlerts(): AppAlert[] {
  return alerts;
}

export function pushAlert(input: {
  kind: AlertKind;
  title: string;
  message: string;
  details?: string[];
  requestId?: string;
}): AppAlert {
  alertSequence += 1;
  const alert: AppAlert = {
    id: `alert-${alertSequence}-${Date.now()}`,
    createdAt: Date.now(),
    ...input,
  };
  // Newest first, and never let the stack grow without bound.
  alerts = [alert, ...alerts].slice(0, 5);
  publishAlerts();
  return alert;
}

export function dismissAlert(id: string): void {
  alerts = alerts.filter((alert) => alert.id !== id);
  publishAlerts();
}

export function clearAlerts(): void {
  alerts = [];
  publishAlerts();
}

/* ==========================================================================
 *  THE ONE ERROR FUNCTION
 *  Takes whatever failed, returns the error that came back from the backend,
 *  and shows it in the global alert component. Used by clientProxy for every
 *  server error, and callable directly from a screen if needed.
 * ======================================================================== */

export function handleServerError(error: unknown): ServerError {
  const serverError = toServerError(error);

  pushAlert({
    kind: 'error',
    title: titleForStatus(serverError.status, serverError.code),
    message: serverError.message,
    details: detailsToLines(serverError.details),
    requestId: serverError.requestId,
  });

  // Keep the raw failure in the console for developers; the user sees the alert.
  console.error('[sharedService] server error', serverError, error);
  return serverError;
}

function toServerError(error: unknown): ServerError {
  if (error instanceof ApiError) return error.serverError;

  if (isServerErrorShape(error)) return error;

  if (error instanceof TypeError) {
    return {
      message: `Cannot reach the server at ${API_BASE_URL}. Is the backend running?`,
      code: 'NETWORK_ERROR',
      status: 0,
    };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return { message: 'The request took too long and was cancelled.', code: 'TIMEOUT', status: 0 };
  }

  return {
    message: error instanceof Error ? error.message : 'Something unexpected went wrong.',
    code: 'UNKNOWN_ERROR',
    status: 0,
  };
}

function isServerErrorShape(value: unknown): value is ServerError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ServerError).message === 'string' &&
    typeof (value as ServerError).code === 'string'
  );
}

function titleForStatus(status: number, code: string): string {
  if (status === 0) return 'Connection problem';
  if (status === 404) return 'Not found';
  if (status === 409) return 'Already exists';
  if (status === 422 || code === 'VALIDATION_ERROR') return 'Please check your input';
  if (status === 502 || code === 'UPSTREAM_ERROR') return 'AI provider problem';
  if (status === 503) return 'Service unavailable';
  if (status >= 500) return 'Server error';
  return 'Request failed';
}

function detailsToLines(details: unknown): string[] | undefined {
  if (!details) return undefined;

  if (Array.isArray(details)) {
    return details.map((entry) => {
      if (entry && typeof entry === 'object' && 'field' in entry && 'message' in entry) {
        const typed = entry as { field: string; message: string };
        return `${typed.field}: ${typed.message}`;
      }
      return typeof entry === 'string' ? entry : JSON.stringify(entry);
    });
  }

  if (typeof details === 'string') return [details];
  return [JSON.stringify(details)];
}

/* ==========================================================================
 *  THE CLIENT PROXY — the single request function
 * ======================================================================== */

const REQUEST_TIMEOUT_MS = 30_000;

interface ProxyOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Set to false to handle the error in the screen instead of alerting. */
  alertOnError?: boolean;
}

async function clientProxy<T>(path: string, options: ProxyOptions = {}): Promise<T> {
  const { method = 'GET', body, query, alertOnError = true } = options;
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success: true; data: T }
      | { success: false; error: ServerError }
      | null;

    if (!response.ok || !payload || payload.success === false) {
      const serverError: ServerError =
        payload && payload.success === false
          ? payload.error
          : {
              message: `The server responded with ${response.status}.`,
              code: 'HTTP_ERROR',
              status: response.status,
            };
      throw new ApiError(serverError);
    }

    return payload.data;
  } catch (error) {
    // Every server error passes through the one error function.
    if (alertOnError) handleServerError(error);
    throw error instanceof ApiError ? error : new ApiError(toServerError(error));
  }
}

/* ==========================================================================
 *  REALTIME (socket.io) — one shared connection
 * ======================================================================== */

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      path: '/realtime',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export const RealtimeEvent = {
  JobUpdated: 'job:updated',
  JobLog: 'job:log',
  TopicUpdated: 'topic:updated',
  CourseUpdated: 'course:updated',
  LessonUpdated: 'lesson:updated',
  TeaserUpdated: 'teaser:updated',
  DiscoveryCompleted: 'discovery:completed',
} as const;

export interface JobUpdatePayload {
  jobId: string;
  type: string;
  entityId: string;
  status: GenerationJob['status'];
  stage: string;
  progress: number;
  error?: string | null;
  updatedAt: string;
}

export interface JobLogPayload {
  jobId: string;
  message: string;
  at: string;
}

/* ==========================================================================
 *  THE SHARED SERVICE — every backend call in the app
 * ======================================================================== */

export const sharedService = {
  /* -- the two functions above, re-exported so screens use one import -- */
  handleServerError,
  pushAlert,
  dismissAlert,
  clearAlerts,
  subscribeToAlerts,
  getAlerts,

  /* ------------------------------- system ------------------------------- */
  health: () => clientProxy<HealthInfo>('/api/health'),
  meta: () => clientProxy<MetaInfo>('/api/meta'),

  /* ------------------------------- topics ------------------------------- */
  listTopics: (query?: { status?: string; audience?: string; search?: string; limit?: number }) =>
    clientProxy<Topic[]>('/api/topics', { query }),

  getTopic: (topicId: string) => clientProxy<Topic>(`/api/topics/${topicId}`),

  createTopic: (body: {
    title: string;
    description?: string;
    whatYouWillBuild?: string;
    toolName?: string;
    toolUrl?: string;
    category?: string;
    audience?: Audience;
    desiredDepth?: CourseDepth;
    sources?: { title: string; url: string }[];
  }) => clientProxy<Topic>('/api/topics', { method: 'POST', body }),

  approveTopic: (topicId: string, body?: { audience?: Audience; desiredDepth?: CourseDepth }) =>
    clientProxy<Topic>(`/api/topics/${topicId}/approve`, { method: 'POST', body: body ?? {} }),

  rejectTopic: (topicId: string, reason?: string) =>
    clientProxy<Topic>(`/api/topics/${topicId}/reject`, { method: 'POST', body: { reason } }),

  discoverTopics: (maxCandidates?: number) =>
    clientProxy<StartedJob>('/api/topics/discover', {
      method: 'POST',
      body: { maxCandidates },
    }),

  researchTopic: (topicId: string) =>
    clientProxy<StartedJob>(`/api/topics/${topicId}/research`, { method: 'POST' }),

  generateFromTopic: (topicId: string) =>
    clientProxy<StartedJob>(`/api/topics/${topicId}/generate`, { method: 'POST' }),

  /* ------------------------------ research ------------------------------ */
  getResearchByTopic: (topicId: string) =>
    clientProxy<Research>(`/api/research/topic/${topicId}`),

  getMasterDocument: (topicId: string) =>
    clientProxy<MasterDocument>(`/api/research/topic/${topicId}/master`),

  /* ------------------------------- courses ------------------------------ */
  listCourses: (query?: { status?: string; limit?: number }) =>
    clientProxy<Course[]>('/api/courses', { query }),

  getCourse: (courseId: string) => clientProxy<CourseTree>(`/api/courses/${courseId}`),

  getCoursePlan: (courseId: string) =>
    clientProxy<MarkdownDocument & { courseId: string }>(`/api/courses/${courseId}/plan`),

  generateCourse: (courseId: string) =>
    clientProxy<StartedJob>(`/api/courses/${courseId}/generate`, { method: 'POST' }),

  generateTeaser: (courseId: string) =>
    clientProxy<StartedJob>(`/api/courses/${courseId}/teaser`, { method: 'POST' }),

  /* ------------------------------- lessons ------------------------------ */
  getLesson: (lessonId: string) => clientProxy<Lesson>(`/api/lessons/${lessonId}`),

  getLessonMarkdown: (lessonId: string) =>
    clientProxy<MarkdownDocument & { lessonId: string; title: string }>(
      `/api/lessons/${lessonId}/markdown`,
    ),

  saveLessonMarkdown: (lessonId: string, markdown: string) =>
    clientProxy<Lesson>(`/api/lessons/${lessonId}/markdown`, {
      method: 'PUT',
      body: { markdown },
    }),

  regenerateLesson: (lessonId: string) =>
    clientProxy<StartedJob>(`/api/lessons/${lessonId}/regenerate`, { method: 'POST' }),

  /* ------------------------------- teasers ------------------------------ */
  listTeasers: (limit?: number) => clientProxy<Teaser[]>('/api/teasers', { query: { limit } }),

  getTeaser: (courseId: string) => clientProxy<Teaser>(`/api/teasers/course/${courseId}`),

  getTeaserMarkdown: (courseId: string) =>
    clientProxy<MarkdownDocument & { beats: TeaserBeat[]; duration: number }>(
      `/api/teasers/course/${courseId}/markdown`,
    ),

  /* -------------------------------- jobs -------------------------------- */
  listJobs: (query?: { status?: string; limit?: number }) =>
    clientProxy<GenerationJob[]>('/api/jobs', { query }),

  getJob: (jobId: string) => clientProxy<GenerationJob>(`/api/jobs/${jobId}`),

  /* ------------------------------ realtime ------------------------------ */
  realtime: {
    connect: (): Socket => getSocket(),

    /** Subscribe to one job's room so only its traffic arrives. */
    watchJob(jobId: string): () => void {
      const active = getSocket();
      active.emit('job:subscribe', jobId);
      return () => active.emit('job:unsubscribe', jobId);
    },

    on<T>(event: string, listener: (payload: T) => void): () => void {
      const active = getSocket();
      active.on(event, listener as (payload: unknown) => void);
      return () => active.off(event, listener as (payload: unknown) => void);
    },

    disconnect(): void {
      socket?.disconnect();
      socket = null;
    },
  },
};

export default sharedService;
