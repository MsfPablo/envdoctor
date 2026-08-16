import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runSync } from "../../src/commands/sync.js";
import { copyFixtureToTemp } from "../helpers.js";

describe("envdoctor sync", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = copyFixtureToTemp("sample-project");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds missing keys from development to production with placeholders", async () => {
    const productionPath = path.join(tmpDir, ".env.production");
    const before = fs.readFileSync(productionPath, "utf8");
    expect(before).not.toContain("DEBUG_MODE");

    const code = await runSync({ rootDir: tmpDir, envA: "development", envB: "production", dryRun: false });
    expect(code).toBe(0);

    const after = fs.readFileSync(productionPath, "utf8");
    expect(after).toContain("DEBUG_MODE=");
    expect(after).toContain("OLD_API_KEY=");
    // Secret values should be empty placeholders.
    expect(after).toContain("OLD_API_KEY=\n");
  });

  it("dry-run does not write", async () => {
    const productionPath = path.join(tmpDir, ".env.production");
    const before = fs.readFileSync(productionPath, "utf8");

    const code = await runSync({ rootDir: tmpDir, envA: "development", envB: "production", dryRun: true });
    expect(code).toBe(0);

    const after = fs.readFileSync(productionPath, "utf8");
    expect(after).toBe(before);
  });
});
