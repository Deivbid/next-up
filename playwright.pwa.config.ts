import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/pwa",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3031" },
  webServer: {
    command:
      "npm exec vite -- preview --host 127.0.0.1 --port 3031 --strictPort",
    url: "http://127.0.0.1:3031",
    reuseExistingServer: true,
  },
});
