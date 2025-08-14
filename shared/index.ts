export type Awaitable<T> = T | Promise<T>;

export type Result<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: { msg: string; data?: any };
    };

type ResultError<T> = Exclude<Result<T>, { error: null }>["error"];

export function dataResult<T>(data: T): Result<T> {
  return { data, error: null };
}

export function errorResult<T>(error: ResultError<T>): Result<T> {
  return { data: null, error };
}

/**
 * Reduces `Awaitable<Result<T>>[]` into a `Promise<Result<T[]>>` that runs in parallel (via `Promise.all()`)
 * and rejects when one of the input `Awaitable<Result<T>>` values resolves to an error result.
 */
export async function unwrapResults<T extends any[]>(results: {
  [K in keyof T]: Awaitable<Result<T[K]>>;
}): Promise<Result<T>> {
  try {
    const combinedResult = (await Promise.all(
      results.map(async (r) => {
        const { data, error } = await r;
        if (error) throw error;
        return data;
      })
    )) as T;

    return dataResult(combinedResult);
  } catch (error) {
    return errorResult(error as ResultError<T>);
  }
}

export type POLITEMallAuth = {
  d2lSessionVal: string;
  d2lSecureSessionVal: string;
};

export type POLITEShopAuth = POLITEMallAuth & {
  brightspaceToken: string;
  domain: string;
  csrfToken: string;
};

export type Message<T, P = void> = P extends void ? { type: T } : { type: T; payload: P };
export type WindowMessage = Message<"URL_PATH_CHANGED", string>;

export async function getD2lSessionSignature(
  { d2lSessionVal, d2lSecureSessionVal }: { d2lSessionVal: string; d2lSecureSessionVal: string },
  salt?: string
): Promise<string> {
  salt ||= Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const dataToHash = new TextEncoder().encode(`${salt}:${d2lSessionVal}:${d2lSecureSessionVal}`);
  const hashBuff = await crypto.subtle.digest("SHA-256", dataToHash);
  const hash = Buffer.from(hashBuff).toString("base64");
  return `${salt}:${hash}`;
}

export async function verifyD2lSessionSignature(
  signature: string,
  credentials: { d2lSessionVal: string; d2lSecureSessionVal: string }
): Promise<boolean> {
  const parts = signature.split(":");
  if (parts.length !== 2) return false;

  const [salt] = parts;
  const expectedSignature = await getD2lSessionSignature(credentials, salt);
  return signature === expectedSignature;
}
