import { describe, expect, it } from "vitest";
import { buildIndex } from "../../src/detectors/index.js";
import { weakSecretDetector } from "../../src/detectors/weak-secret.js";
import { buildModel } from "../helpers.js";

describe("weak-secret detector", () => {
  it("flags blocklisted placeholder values", () => {
    const model = buildModel([
      { path: "/p/.env", content: "API_KEY=changeme\nJWT_SECRET=password123\n" },
    ]);
    const findings = weakSecretDetector.detect(buildIndex(model));
    expect(findings.map((f) => f.variable).sort()).toEqual([
      "API_KEY",
      "JWT_SECRET",
    ]);
  });

  it("flags very short secret values", () => {
    const model = buildModel([{ path: "/p/.env", content: "API_KEY=abc\n" }]);
    expect(weakSecretDetector.detect(buildIndex(model)).map((f) => f.variable)).toEqual([
      "API_KEY",
    ]);
  });

  it("does not flag non-secret variables", () => {
    const model = buildModel([{ path: "/p/.env", content: "PORT=3000\n" }]);
    expect(weakSecretDetector.detect(buildIndex(model))).toEqual([]);
  });

  it("does not flag reasonably strong secrets", () => {
    const model = buildModel([
      { path: "/p/.env", content: "API_KEY=a9f8b2c1d0e7f6a5\n" },
    ]);
    expect(weakSecretDetector.detect(buildIndex(model))).toEqual([]);
  });

  it("ignores .env.example", () => {
    const model = buildModel([
      { path: "/p/.env.example", content: "API_KEY=changeme\n" },
    ]);
    expect(weakSecretDetector.detect(buildIndex(model))).toEqual([]);
  });
});
