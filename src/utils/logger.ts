export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  scope: string;
  message: string;
  context?: Record<string, unknown>;
  at: string;
}

const sanitizeContext = (value: Record<string, unknown> | undefined) => {
  if (!value) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { nonSerializable: true };
  }
};

const writeConsole = (level: LogLevel, payload: LogPayload) => {
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  target(`[deskly:${payload.scope}] ${payload.message}`, payload.context || {});
};

export const createLogger = (scope: string) => {
  const write = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    const payload: LogPayload = {
      scope,
      message,
      context: sanitizeContext(context),
      at: new Date().toISOString()
    };
    writeConsole(level, payload);
  };
  return {
    debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
    info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => write('error', message, context)
  };
};

export const appLogger = createLogger('app');
