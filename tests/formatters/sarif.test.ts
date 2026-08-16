import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/core/audit.js";
import { formatSarif } from "../../src/formatters/sarif.js";
import { buildModel } from "../helpers.js";

describe("formatSarif", () => {
  it("produces a valid SARIF run with results and rules", () => {
    const model = buildModel([
      { path: "/p/.env", content: "PORT=3000\nOLD_KEY=abc\n" },
      { path: "/p/src/index.ts", content: "const p = process.env.PORT;\n" },
    ]);
    const audit = runAudit(model, { strict: false });
    const sarifText = formatSarif(audit, "/p");
    const sarif = JSON.parse(sarifText) as {
      version: string;
      runs: Array<{
        tool: { driver: { rules: unknown[] } };
        results: Array<{ ruleId: string; level: string }>;
      }>;
    };

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]?.tool.driver.rules.length).toBeGreaterThan(0);
    expect(sarif.runs[0]?.results.length).toBe(audit.findings.length);
    const ruleIds = new Set(sarif.runs[0]?.results.map((r) => r.ruleId));
    expect(ruleIds.has("unused")).toBe(true);
  });

  it("does not include variable values", () => {
    const model = buildModel([
      { path: "/p/.env", content: "API_KEY=super-secret\n" },
      { path: "/p/src/index.ts", content: "const k = process.env.API_KEY;\n" },
    ]);
    const audit = runAudit(model, { strict: false });
    const sarifText = formatSarif(audit, "/p");
    expect(sarifText).not.toContain("super-secret");
  });
});
