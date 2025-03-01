import { Plugin } from "vite";
import { PORT } from "./config";

const plugin: Plugin = {
  name: "chrome-ext-reloader",
  async closeBundle() {
    let retryCount = 0;

    while (retryCount < 5) {
      try {
        await fetch(`http://localhost:${PORT}/broadcast`, { method: "POST" });
        return;
      } catch (e) {
        // Wait 0.1s before retrying
        await new Promise((resolve) => setTimeout(resolve, 100));
        retryCount++;
      }
    }

    console.error("Failed to trigger reload broadcast");
  },
};

export default plugin;
