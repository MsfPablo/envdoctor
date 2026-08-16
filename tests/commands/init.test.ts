import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runInit } from "../../src/commands/init.js";
import { capture, copyFixtureToTemp } from "../helpers.js";

describe("envdoctor init", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = copyFixtureToTemp("sample-project");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates config, .env.example, and ENVIRONMENT.md", async () => {
    const fresh = path.join(tmpDir, "fresh");
    fs.cpSync(path.join(tmpDir, "src"), path.join(fresh, "src"), { recursive: true });
    fs.writeFileSync(path.join(fresh, ".env"), "PORT=3000\n");

    const result = await capture(() => runInit({ rootDir: fresh, force: false }));
    expect(result.code).toBe(0);

    expect(fs.existsSync(path.join(fresh, "envdoctor.config.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(fresh, ".env.example"))).toBe(true);
    expect(fs.existsSync(path.join(fresh, "ENVIRONMENT.md"))).toBe(true);

    const config = fs.readFileSync(path.join(fresh, "envdoctor.config.mjs"), "utf8");
    expect(config).toContain("envFilePatterns");
  });

  it("skips existing files without --force", async () => {
    const before = fs.readFileSync(path.join(tmpDir, ".env.example"), "utf8");
    const result = await capture(() => runInit({ rootDir: tmpDir, force: false }));
    expect(result.stdout).toContain("skipped .env.example");
    expect(fs.readFileSync(path.join(tmpDir, ".env.example"), "utf8")).toBe(before);
  });
});
