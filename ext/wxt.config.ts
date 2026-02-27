import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "POLITEShop Extension",
    permissions: [
      "cookies",
      "declarativeNetRequest",
      "declarativeNetRequestWithHostAccess",
    ],
    host_permissions: ["https://*.polite.edu.sg/", "http://*.localhost/*"],
    declarative_net_request: {
      rule_resources: [
        {
          id: "fix_orb",
          enabled: true,
          path: "rules/fix_orb.json",
        },
      ],
    },
  },
});
