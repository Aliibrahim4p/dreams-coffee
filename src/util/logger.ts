import config from "@/src/config";
import winston from "winston";

const { logDir, isDev } = config;
const logFileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.splat(),
  winston.format.errors({ stack: true }),
);

const logconsoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),

  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `[${timestamp}] [${level}]:  ${message}\n${stack}`
      : `[${timestamp}] [${level}]:  ${message}`;
  }),
);

const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.File({
      filename: `error.log`,
      dirname: logDir,
      level: "error",
      format: logFileFormat,
    }),
    new winston.transports.File({
      filename: `all.log`,
      dirname: logDir,
      format: logFileFormat,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: `exceptions.log`,
      dirname: logDir,
      format: logFileFormat,
    }),
  ],
});
if (isDev) {
  logger.add(
    new winston.transports.Console({
      format: logconsoleFormat,
    }),
  );
  logger.level = "debug";
}
console.log(`Logger initialised. Logs will be saved to ${logDir}`);
export default logger;
