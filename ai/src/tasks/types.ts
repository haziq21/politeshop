import type { Provider } from "../providers/types.ts";

export type Task<TInput, TOutput> = (provider: Provider, input: TInput) => Promise<TOutput>;
