import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    base: {
        service: 'pr-reviewer',
        version: process.env.npm_package_version || '1.0.0',
    },
});

// Child loggers for different modules
export const createChildLogger = (module: string) => logger.child({ module });

// Pre-configured module loggers
export const loggers = {
    webhook: createChildLogger('webhook'),
    llm: createChildLogger('llm'),
    rag: createChildLogger('rag'),
    parsing: createChildLogger('parsing'),
    review: createChildLogger('review'),
    health: createChildLogger('health'),
};
