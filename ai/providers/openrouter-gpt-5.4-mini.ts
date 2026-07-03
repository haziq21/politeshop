import { getEnv } from "../src/env.ts";
import { OpenRouterProvider } from "../src/providers/openrouter.ts";

export default new OpenRouterProvider({
  apiKey: getEnv("OPENROUTER_API_KEY"),
  model: "openai/gpt-5.4-mini",
  reasoning: {
    effort: "low",
  },
});
