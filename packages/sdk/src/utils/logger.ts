import type { Logger } from "../client/config";

export const noopLogger: Logger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};
