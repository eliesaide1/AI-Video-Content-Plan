type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN: Level = process.env.LOG_LEVEL === 'debug' ? 'debug' : 'info';

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  if (ORDER[level] < ORDER[MIN]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  if (meta === undefined) {
    console[level === 'debug' ? 'log' : level](line);
  } else {
    console[level === 'debug' ? 'log' : level](line, meta);
  }
}

/**
 * Tiny scoped logger. Important generation operations are logged so a course
 * can be audited after the fact (Engineering Principles: "Log important
 * generation operations").
 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => emit('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => emit('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => emit('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => emit('error', scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
