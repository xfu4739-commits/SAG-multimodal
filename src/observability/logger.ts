import pino from "pino";
import { config } from "../config/env.js";

const loggerOptions = {
  level: config.LOG_LEVEL,
  base: {
    service: "sag"
  },
};

const useStderr =
  process.env.SAG_LOG_STDERR === "true" ||
  Boolean(process.env.SAG_MCP_SOURCE_ID?.trim() || process.env.SAG_MCP_PROJECT_ID?.trim());

export const logger = useStderr
  ? pino(loggerOptions, pino.destination(2))
  : pino(loggerOptions);
