import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runDiff } from "../../src/commands/diff.js";
import { EXIT_ISSUES, EXIT_OK, EXIT_USAGE } from "../../src/core/exit-codes.js";
import { capture, copyFixtureToTemp } from "../helpers.js";

describe("envdoctor diff", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = copyFixtureToTemp("sample-project");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports differences between development and production", async () => {
    const result = await capture(() =>
      runDiff({ rootDir: tmpDir, envA: "development", envB: "production", json: false }),
    );
    expect(result.code).toBe(EXIT_ISSUES);
    expect(result.stdout).toContain("development → production");
    expect(result.stdout).toContain("JWT_SECRET");
    expect(result.stdout).toContain("OLD_API_KEY");
    expect(result.stdout).toContain("missing in");
  });

  it("supports dev/prod aliases", async () => {
    const result = await capture(() =>
      runDiff({ rootDir: tmpDir, envA: "dev", envB: "prod", json: false }),
    );
    expect(result.code).toBe(EXIT_ISSUES);
    expect(result.stdout).toContain("development → production");
  });

  it("emits machine-readable JSON", async () => {
    const result = await capture(() =>
      runDiff({ rootDir: tmpDir, envA: "development", envB: "production", json: true }),
    );
    const parsed = JSON.parse(result.stdout);
    expect(parsed.environments).toEqual(["development", "production"]);
    expect(parsed.missing).toBeGreaterThan(0);
    expect(parsed.variables.some((v: { name: string; status: string }) => v.name === "JWT_SECRET" && v.status === "missing")).toBe(true);
  });

  it("returns 0 when environments match", async () => {
    const clean = path.join(tmpDir, "matching");
    fs.mkdirSync(clean, { recursive: true });
    fs.writeFileSync(path.join(clean, ".env"), "A=1\nB=2\n");
    fs.writeFileSync(path.join(clean, ".env.production"), "A=1\nB=2\n");

    const result = await capture(() =>
      runDiff({ rootDir: clean, envA: "development", envB: "production", json: false }),
    );
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toContain("present in both");
  });

  it("returns a usage error for unknown environments", async () => {
    const clean = path.join(tmpDir, "single");
    fs.mkdirSync(clean, { recursive: true });
    fs.writeFileSync(path.join(clean, ".env"), "A=1\n");

    const result = await capture(() =>
      runDiff({ rootDir: clean, envA: "development", envB: "staging", json: false }),
    );
    expect(result.code).toBe(EXIT_USAGE);
  });
});
