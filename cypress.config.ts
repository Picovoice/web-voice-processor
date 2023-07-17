import { defineConfig } from "cypress";

export default defineConfig({
  env: {
    "DEBUG": false,
  },
  e2e: {
    defaultCommandTimeout: 30000,
    supportFile: "cypress/support/index.ts",
    specPattern: "test/*.test.{js,jsx,ts,tsx}",
    video: false,
    screenshotOnRunFailure: false,
  }
});
