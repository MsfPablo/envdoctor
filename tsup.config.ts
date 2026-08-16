import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/cli.ts" },
  format: ["esm", "cjs"],
  dts: false,
  clean: true,
  sourcemap: false,
  minify: false,
  target: "node18",
  platform: "node",
  bundle: true,
  // Make the CLI executable and keep it self-contained for `npm install -g`.
  banner: { js: "#!/usr/bin/env node" },
});
