import type { Provider } from "../src/providers/types.ts";

export interface EvaluatorOutput {
  pass: boolean;
  reason: string;
}

export interface Evaluator<TOutput> {
  description?: string;
  fn: (output: TOutput) => EvaluatorOutput[];
}

export interface Eval<TInput, TOutput> {
  input: TInput;
  task: (provider: Provider, input: TInput) => Promise<TOutput>;
  evaluators: Evaluator<TOutput>[];
}

export function defineEval<TInput, TOutput>(def: Eval<TInput, TOutput>): Eval<TInput, TOutput> {
  return def;
}
