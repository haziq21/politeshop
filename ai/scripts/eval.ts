import { buildApplication, buildCommand, run } from "@stricli/core";
import { writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import yaml from "yaml";

import type { Eval, EvaluatorOutput } from "../evals/define-eval.ts";
import type { Provider } from "../src/providers/types.ts";

import { logger } from "../src/logging.ts";

process.loadEnvFile(new URL("../.env", import.meta.url));

function resolvePath(input: string): string {
  return resolve(process.env["INIT_CWD"] ?? process.cwd(), input);
}

interface EvaluatorResult {
  evaluator: string;
  description?: string;
  outputs: EvaluatorOutput[];
}

const command = buildCommand<{ output?: string; provider: string; eval: string }, []>({
  docs: { brief: "Evaluate an AI task against test cases" },
  parameters: {
    flags: {
      output: {
        kind: "parsed",
        optional: true,
        brief: "Path to write results to (JSON or YAML, detected by extension)",
        parse: resolvePath,
      },
      provider: {
        kind: "parsed",
        optional: false,
        brief: "Path to a TypeScript provider file",
        parse: resolvePath,
      },
      eval: {
        kind: "parsed",
        optional: false,
        brief: "Path to a TypeScript eval file",
        parse: resolvePath,
      },
    },
  },
  func: async function ({ output: outputFile, provider: providerFile, eval: evalFile }) {
    const { default: provider } = (await import(providerFile)) as { default: Provider };
    const { default: eval_ } = (await import(evalFile)) as { default: Eval<any, any> };

    const t0 = performance.now();
    let taskOutput: ReturnType<typeof eval_.task>;
    try {
      taskOutput = await eval_.task(provider, eval_.input);
    } catch (err) {
      logger.error({ err }, "Task run failed");
      throw err;
    }
    const durationMs = Math.round(performance.now() - t0);

    let passes = 0;
    let fails = 0;
    const evaluatorResults: EvaluatorResult[] = [];

    for (const ev of eval_.evaluators) {
      const evOutputs = ev.fn(taskOutput);
      const passCount = evOutputs.filter((c) => c.pass).length;
      passes += passCount;
      fails += evOutputs.length - passCount;

      evaluatorResults.push({
        evaluator: ev.fn.name,
        description: ev.description,
        outputs: evOutputs,
      });

      logger.info(`${ev.fn.name || "(anonymous)"}: ${passCount}/${evOutputs.length} passed`);
    }

    logger.info(`Total: ${passes}/${passes + fails} evaluator conditions passed, ${fails} failed (${durationMs}ms)`);

    if (outputFile) {
      const result = {
        task: eval_.task.name || "(anonymous)",
        summary: { passes, fails, durationMs },
        evaluators: evaluatorResults,
      };
      const content =
        extname(outputFile).match(/\.ya?ml$/) !== null
          ? yaml.stringify(result, { lineWidth: 0 })
          : JSON.stringify(result, null, 2);
      writeFileSync(outputFile, content);
      logger.info(`Results written to ${outputFile}`);
    }
  },
});

const app = buildApplication(command, { name: "eval" });
const args = process.argv.slice(2);
await run(app, args[0] === "--" ? args.slice(1) : args, { process });
