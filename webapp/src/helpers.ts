import type { Result } from "./types";

type ResultError<T> = Exclude<Result<T>, { error: null }>["error"];

export function dataResult<T>(data: T): Result<T> {
  return { data, error: null };
}

export function errorResult<T>(error: ResultError<T>): Result<T> {
  return { data: null, error };
}

export async function unwrapResults<T extends any[]>(resultPromises: {
  [K in keyof T]: Promise<Result<T[K]>>;
}): Promise<Result<T>> {
  try {
    const results = (await Promise.all(
      resultPromises.map(async (r) => {
        const { data, error } = await r;
        if (error) throw error;
        return data;
      })
    )) as T;

    return dataResult(results);
  } catch (error) {
    return errorResult(error as ResultError<T>);
  }
}

export function arrEq<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
