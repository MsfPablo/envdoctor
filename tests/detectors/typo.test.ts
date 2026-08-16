import { describe, expect, it } from "vitest";
import { buildIndex } from "../../src/detectors/index.js";
import { typoDetector } from "../../src/detectors/typo.js";
import { buildModel } from "../helpers.js";

describe("typo detector", () => {
  it("suggests a defined name when a referenced name is a single-character typo", () => {
    const model = buildModel([
      { path: "/p/.env", content: "DATABASE_URL=postgres://localhost\n" },
      {
        path: "/p/docker-compose.yml",
        content: "services:\n  api:\n    command: echo ${DATABSE_URL}\n",
      },
    ]);
    const findings = typoDetector.detect(buildIndex(model));
    expect(findings.map((f) => f.variable)).toEqual(["DATABSE_URL"]);
    expect(findings[0]?.message).toContain("DATABASE_URL");
  });

  it("is silent when there are no near-miss names", () => {
    const model = buildModel([
      { path: "/p/.env", content: "DATABASE_URL=postgres://localhost\n" },
      {
        path: "/p/docker-compose.yml",
        content: "services:\n  api:\n    environment:\n      DATABASE_URL: ${DATABASE_URL}\n",
      },
    ]);
    expect(typoDetector.detect(buildIndex(model))).toEqual([]);
  });

  it("is silent for very short names", () => {
    const model = buildModel([
      { path: "/p/.env", content: "AB=1\n" },
      { path: "/p/docker-compose.yml", content: "services:\n  api:\n    environment:\n      AC: x\n" },
    ]);
    expect(typoDetector.detect(buildIndex(model))).toEqual([]);
  });
});
