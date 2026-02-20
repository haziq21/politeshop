import pino from "pino";

export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "warn",
  base: undefined,
  transport: import.meta.env.DEV
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid",
        },
      }
    : undefined,
});
