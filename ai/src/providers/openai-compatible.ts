import { z } from "zod";

import type { Provider, SendParams } from "./types.ts";

const chatCompletionSchema = z.object({
  choices: z
    .object({
      message: z.object({
        content: z.string(),
      }),
    })
    .array(),
});

export interface OpenAICompatibleConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
  headers?: Record<string, string>;
}

export class OpenAICompatibleProvider implements Provider {
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  async send<TSchema extends z.ZodTypeAny>(params: SendParams<TSchema>): Promise<z.infer<TSchema>> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;

    const body = {
      model: this.config.model,
      messages: [
        { role: "system" as const, content: params.systemPrompt },
        { role: "user" as const, content: params.userMessage },
      ],
      temperature: this.config.temperature ?? 0,
      max_tokens: 4096,
      response_format: {
        type: "json_schema" as const,
        json_schema: {
          name: "response",
          strict: true,
          schema: z.toJSONSchema(params.schema),
        },
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.config.headers },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`${resp.status}: ${await resp.text()}`);
    }

    const data = chatCompletionSchema.parse(await resp.json());
    return params.schema.parse(JSON.parse(data.choices[0]!.message.content));
  }
}
