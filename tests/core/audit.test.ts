import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/core/audit.js";
import { EXIT_ISSUES, EXIT_OK } from "../../src/core/exit-codes.js";
import { buildModel, loadSampleProject } from "../helpers.js";

describe("runAudit on the sample-project fixture", () => {
  it("finds the expected categories of issues", async () => {
    const { context } = await loadSampleProject();
    const audit = runAudit(context.model, { strict: false });

    const ids = new Set(audit.findings.map((f) => f.ruleId));

    // duplicates: NODE_ENV is defined twice in .env
    expect(audit.findings.some((f) => f.ruleId === "duplicates" && f.variable === "NODE_ENV")).toBe(true);

    // undefined-in-source: NEW_FEATURE_FLAG is used but never defined
    expect(audit.findings.some((f) => f.ruleId === "undefined-in-source" && f.variable === "NEW_FEATURE_FLAG")).toBe(true);

    // missing: COMPOSE_ONLY is defined in compose but no env file
    expect(audit.findings.some((f) => f.ruleId === "missing" && f.variable === "COMPOSE_ONLY")).toBe(true);

    // unused: OLD_API_KEY is defined but never referenced
    expect(audit.findings.some((f) => f.ruleId === "unused" && f.variable === "OLD_API_KEY")).toBe(true);

    // environment-diff: JWT_SECRET exists in production but not development
    expect(audit.findings.some((f) => f.ruleId === "environment-diff" && f.variable === "JWT_SECRET")).toBe(true);

    // type-mismatch: PORT=3000 (integer) vs "3000abc" (string)
    const port = audit.findings.find((f) => f.ruleId === "type-mismatch" && f.variable === "PORT");
    expect(port).toBeDefined();
    expect(port?.message).toContain("integer");

    expect(ids).toContain("missing");
    expect(ids).toContain("unused");
    expect(ids).toContain("undefined-in-source");
    expect(ids).toContain("duplicates");
    expect(ids).toContain("environment-diff");
    expect(ids).toContain("type-mismatch");
  });

  it("returns a failing exit code when errors are present", async () => {
    const { context } = await loadSampleProject();
    const audit = runAudit(context.model, { strict: false });
    expect(audit.exitCode).toBe(EXIT_ISSUES);
    expect(audit.summary.errors).toBeGreaterThan(0);
  });

  it("respects the --only filter", async () => {
    const { context } = await loadSampleProject();
    const audit = runAudit(context.model, { strict: false, only: ["unused"] });
    expect(audit.findings.length).toBeGreaterThan(0);
    expect(audit.findings.every((f) => f.ruleId === "unused")).toBe(true);
  });

  it("passes for a clean project", () => {
    // A tiny self-consistent project: defined and used, one environment only.
    const model = buildModel([
      { path: "/p/.env", content: "PORT=3000\n" },
      { path: "/p/src/index.ts", content: "const p = process.env.PORT;\n" },
    ]);
    const audit = runAudit(model, { strict: false });
    expect(audit.exitCode).toBe(EXIT_OK);
  });

  it("honors inline ignore directives in env files", () => {
    const model = buildModel([
      { path: "/p/.env", content: "# envdoctor:ignore unused\nOLD_KEY=abc\n" },
      { path: "/p/src/index.ts", content: "export const x = 1;\n" },
    ]);
    const audit = runAudit(model, { strict: false });
    expect(audit.findings.some((f) => f.ruleId === "unused" && f.variable === "OLD_KEY")).toBe(false);
  });

  it("applies per-rule severity overrides from config", () => {
    const model = buildModel([
      { path: "/p/.env", content: "OLD_KEY=abc\n" },
      { path: "/p/src/index.ts", content: "export const x = 1;\n" },
    ]);
    const audit = runAudit(model, { strict: false, rules: { unused: "error" } });
    expect(audit.findings.every((f) => f.ruleId !== "unused" || f.severity === "error")).toBe(true);
    expect(audit.exitCode).toBe(EXIT_ISSUES);
  });

  it("disables detectors configured as off", () => {
    const model = buildModel([
      { path: "/p/.env", content: "OLD_KEY=abc\n" },
      { path: "/p/src/index.ts", content: "export const x = 1;\n" },
    ]);
    const audit = runAudit(model, { strict: false, rules: { unused: "off" } });
    expect(audit.findings.some((f) => f.ruleId === "unused")).toBe(false);
  });
});
