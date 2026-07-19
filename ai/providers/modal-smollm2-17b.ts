import { getEnv } from "../src/env.ts";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.ts";

export default new OpenAICompatibleProvider({
  baseUrl: `https://${getEnv("MODAL_WORKSPACE")}--politeshop-smollm2-17b-server-serve.modal.run`,
  model: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
  headers: { "Modal-Key": getEnv("MODAL_PROXY_KEY"), "Modal-Secret": getEnv("MODAL_PROXY_SECRET") },
});
