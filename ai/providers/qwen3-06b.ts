import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.ts";

export default new OpenAICompatibleProvider({
  baseUrl: "https://haziq21--bench-qwen3-server-serve.modal.run",
  model: "Qwen/Qwen3-0.6B",
});
