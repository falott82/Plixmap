// Structured JSON server logger extracted from index.cjs. Level-gated by
// serverConfig.logLevel.
const { serverConfig } = require('./config.cjs');

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const SERVER_LOG_LEVEL = serverConfig.logLevel;

const shouldLogLevel = (level) => LOG_LEVELS[level] >= LOG_LEVELS[SERVER_LOG_LEVEL];
const serverLog = (level, event, context = {}) => {
  if (!shouldLogLevel(level)) return;
  const payload = {
    at: new Date().toISOString(),
    level,
    event,
    ...context
  };
  const json = JSON.stringify(payload);
  if (level === 'error') console.error(json);
  else if (level === 'warn') console.warn(json);
  else console.log(json);
};

module.exports = { serverLog, shouldLogLevel };
