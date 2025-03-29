import pino from "pino";

export const logger = pino({
  level: "debug",
  base: undefined,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid",
    },
  },
});
