import type { z } from "zod";

export interface SendParams<TSchema extends z.ZodTypeAny> {
  systemPrompt: string;
  userMessage: string;
  schema: TSchema;
}

export interface Provider {
  send<TSchema extends z.ZodTypeAny>(params: SendParams<TSchema>): Promise<z.infer<TSchema>>;
}
