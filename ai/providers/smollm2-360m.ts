import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.ts";

export default new OpenAICompatibleProvider({
  baseUrl: "https://haziq21--bench-360m-server-serve.modal.run",
  model: "HuggingFaceTB/SmolLM2-360M-Instruct",
});
