import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.ts";

export default new OpenAICompatibleProvider({
  baseUrl: "https://haziq21--bench-17b-server-serve.modal.run",
  model: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
});
