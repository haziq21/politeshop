import { z } from "zod";

import type { Provider, SendParams } from "./types.ts";

export interface OpenAICompatibleConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
}

export class OpenAICompatibleProvider implements Provider {
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  async send<TSchema extends z.ZodTypeAny>(
    params: SendParams<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;

    const body = {
      model: this.config.model,
      messages: [
        { role: "system" as const, content: params.systemPrompt },
        { role: "user" as const, content: params.userMessage },
      ],
      temperature: this.config.temperature ?? 0,
      max_tokens: 4096,
      response_format: { type: "json_object" as const },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API returned ${resp.status}: ${text.slice(0, 500)}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    let raw = data.choices[0]?.message.content?.trim();
    if (!raw) throw new Error("Provider returned an empty response");

    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m?.[1]) raw = m[1].trim();

    let parsed = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();

    if (!parsed) throw new Error(`Invalid JSON: ${raw.slice(0, 500)}`);

    // Normalize common model format issues
    if (Array.isArray(parsed)) parsed = { items: parsed };
    if (!("items" in parsed)) parsed = { items: [parsed] };

    return params.schema.parse(parsed);
  }
}
