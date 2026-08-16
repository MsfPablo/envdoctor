import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runScan } from "../../src/commands/scan.js";
import { EXIT_ISSUES, EXIT_OK } from "../../src/core/exit-codes.js";
import { capture, copyFixtureToTemp } from "../helpers.js";

describe("envdoctor scan", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = copyFixtureToTemp("sample-project");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports issues on the sample project with a non-zero exit code", async () => {
    const result = await capture(() => runScan({ rootDir: tmpDir, strict: false, json: false, verbose: false, only: [] }));
    expect(result.code).toBe(EXIT_ISSUES);
    expect(result.stdout).toContain("ENVIRONMENT AUDIT");
    expect(result.stdout).toContain("Missing");
    expect(result.stdout).toContain("COMPOSE_ONLY");
    expect(result.stdout).toContain("NEW_FEATURE_FLAG");
    expect(result.stdout).toContain("OLD_API_KEY");
    expect(result.stdout).toContain("PORT");
    expect(result.stdout).not.toContain("dev-key-123");
    expect(result.stdout).not.toContain("prod-only-secret");
  });

  it("emits JSON that contains no values", async () => {
    const result = await capture(() => runScan({ rootDir: tmpDir, strict: false, json: true, verbose: false, only: [] }));
    const parsed = JSON.parse(result.stdout);
    expect(parsed.exitCode).toBe(EXIT_ISSUES);
    expect(parsed.summary.errors).toBeGreaterThan(0);
    expect(Array.isArray(parsed.findings)).toBe(true);
    const blob = result.stdout;
    expect(blob).not.toContain("dev-key-123");
    expect(blob).not.toContain("stale-key");
  });

  it("honors --strict by failing on warnings alone", async () => {
    // Build a project with only a warning (an unused variable) and no errors.
    const clean = path.join(tmpDir, "strict-project");
    fs.mkdirSync(clean, { recursive: true });
    fs.mkdirSync(path.join(clean, "src"), { recursive: true });
    fs.writeFileSync(path.join(clean, ".env"), "OLD_KEY=abc\n");
    fs.writeFileSync(path.join(clean, "src", "index.ts"), "export const x = 1;\n");

    const lax = await capture(() => runScan({ rootDir: clean, strict: false, json: false, verbose: false, only: [] }));
    expect(lax.code).toBe(EXIT_OK);

    const strict = await capture(() => runScan({ rootDir: clean, strict: true, json: false, verbose: false, only: [] }));
    expect(strict.code).toBe(EXIT_ISSUES);
  });

  it("renders verbose locations when requested", async () => {
    const result = await capture(() => runScan({ rootDir: tmpDir, strict: false, json: false, verbose: true, only: [] }));
    expect(result.stdout).toContain("src/index.ts:");
  });
});
