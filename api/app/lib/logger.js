'use strict';

/**
 * Winston, configured once. Console in every environment; a rotating file pair
 * only when LOG_PATH is set, so a container without a mounted volume does not
 * fail to boot over a directory it cannot create.
 */

const FORMATTERS = Object.freeze({
  production: winston => winston.format.combine(winston.format.timestamp(), winston.format.json()),
  default: winston =>
    winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`)
    ),
});

export default ({ winston, env }) => {
  const { logLevel, logPath, env: nodeEnv, name } = env.app;

  const format = (FORMATTERS[nodeEnv] || FORMATTERS.default)(winston);

  const transports = [new winston.transports.Console()];

  if (logPath) {
    transports.push(
      new winston.transports.File({ filename: `${logPath}/error.log`, level: 'error' }),
      new winston.transports.File({ filename: `${logPath}/combined.log` })
    );
  }

  return winston.createLogger({
    level: logLevel || 'info',
    defaultMeta: { service: name },
    format,
    transports,
  });
};
