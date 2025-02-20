import type { Result } from "./types";

export function dataResult<T>(data: T): Result<T> {
  return { data, error: null };
}

export function errorResult<T>(error: { msg: string; data?: Object }): Result<T> {
  return { data: null, error };
}
