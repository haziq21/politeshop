import { getEnv } from "../src/env.ts";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.ts";

export default new OpenAICompatibleProvider({
  baseUrl: `https://${getEnv("MODAL_WORKSPACE")}--politeshop-qwen3-06b-server-serve.modal.run`,
  model: "Qwen/Qwen3-0.6B",
  headers: { "Modal-Key": getEnv("MODAL_PROXY_KEY"), "Modal-Secret": getEnv("MODAL_PROXY_SECRET") },
});
