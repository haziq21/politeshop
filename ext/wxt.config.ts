import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "POLITEShop Extension",
    permissions: ["cookies", "declarativeNetRequest", "declarativeNetRequestWithHostAccess"],
    host_permissions: ["https://*.polite.edu.sg/"],
  },
});
