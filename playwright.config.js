import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.NOSTOS_BASE_URL || "http://127.0.0.1:8080/src/",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "python3 -m http.server 8080",
      cwd: ".",
      url: "http://127.0.0.1:8080/src/",
      reuseExistingServer: true,
    },
    {
      command: "python3 -m http.server 8081",
      cwd: "www",
      url: "http://127.0.0.1:8081/",
      reuseExistingServer: true,
    },
  ],
});
