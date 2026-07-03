import diff from "microdiff";

import type { Evaluator } from "../define-eval.ts";

export function elementWiseEq<T>({ expected, description }: { expected: T[]; description?: string }): Evaluator<T[]> {
  return {
    description,
    fn: function elementWiseEq(output: T[]) {
      return output.map((got, i) => {
        const want = expected[i];
        if (want === undefined) return { pass: false, reason: `output[${i}]: missing expected value` };
        const diffs = diff(want as any, got as any);
        if (diffs.length === 0) return { pass: true, reason: `output[${i}]: matches expected ${JSON.stringify(want)}` };
        return { pass: false, reason: `output[${i}]: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}` };
      });
    },
  };
}
