import { HTTPError } from "../errors";

/**
 * Returns a `fetch` for one API: it resolves paths against `baseURL` and throws an {@link HTTPError}
 * for a failed response.
 *
 * `headers` carry credentials, so they are only sent to requests to `baseURL`'s origin.
 */
export function createFetch(config: {
  baseURL: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}): typeof fetch {
  const origin = new URL(config.baseURL).origin;
  const fetchImpl = config.fetch ?? fetch;

  return async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(input instanceof Request ? input.url : input, config.baseURL);

    // Like fetch, `init` replaces the Request's own headers and signal instead of adding to them
    const headers = new Headers(url.origin === origin ? config.headers : undefined);
    new Headers(init?.headers ?? request?.headers).forEach((value, name) => headers.set(name, value));
    const own = init && "signal" in init ? init.signal : request?.signal;
    const signal = AbortSignal.any([config.signal, own].filter((s) => !!s));

    const res = await fetchImpl(request ?? url, { ...init, headers, signal });
    if (!res.ok) throw new HTTPError(res.status, url.href);
    return res;
  };
}
