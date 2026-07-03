import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

import type { Provider, SendParams } from "./types.ts";

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  reasoning?: { effort: "low" | "medium" | "high" };
}

export class OpenRouterProvider implements Provider {
  private client: OpenRouter;
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.client = new OpenRouter({ apiKey: config.apiKey });
    this.config = config;
  }

  async send<TSchema extends z.ZodTypeAny>(params: SendParams<TSchema>): Promise<z.infer<TSchema>> {
    const result = await this.client.chat.send({
      chatGenerationParams: {
        model: this.config.model,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userMessage },
        ],
        temperature: this.config.temperature ?? 0,
        reasoning: this.config.reasoning,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "response",
            strict: true,
            schema: z.toJSONSchema(params.schema),
          },
        },
      },
    });

    const rawContent = result.choices[0]?.message.content;
    if (!rawContent) throw new Error("Provider returned an empty response");
    if (typeof rawContent !== "string") throw new Error("Provider returned unexpected non-text content");

    return params.schema.parse(JSON.parse(rawContent));
  }
}
