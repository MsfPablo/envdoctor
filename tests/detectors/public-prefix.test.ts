import { describe, expect, it } from "vitest";
import { buildIndex } from "../../src/detectors/index.js";
import { publicPrefixDetector } from "../../src/detectors/public-prefix.js";
import { buildModel } from "../helpers.js";

describe("public-prefix detector", () => {
  it("flags secret-looking variables with public framework prefixes", () => {
    const model = buildModel([
      { path: "/p/.env", content: "NEXT_PUBLIC_API_KEY=abc\nVITE_JWT_SECRET=def\n" },
    ]);
    const findings = publicPrefixDetector.detect(buildIndex(model));
    expect(findings.map((f) => f.variable).sort()).toEqual([
      "NEXT_PUBLIC_API_KEY",
      "VITE_JWT_SECRET",
    ]);
    expect(findings.every((f) => f.severity === "error")).toBe(true);
  });

  it("does not flag non-secret public-prefixed variables", () => {
    const model = buildModel([
      { path: "/p/.env", content: "NEXT_PUBLIC_APP_URL=https://example.com\n" },
    ]);
    expect(publicPrefixDetector.detect(buildIndex(model))).toEqual([]);
  });

  it("does not flag secrets without public prefixes", () => {
    const model = buildModel([{ path: "/p/.env", content: "API_KEY=abc\n" }]);
    expect(publicPrefixDetector.detect(buildIndex(model))).toEqual([]);
  });

  it("ignores .env.example", () => {
    const model = buildModel([
      { path: "/p/.env.example", content: "NEXT_PUBLIC_API_KEY=\n" },
    ]);
    expect(publicPrefixDetector.detect(buildIndex(model))).toEqual([]);
  });
});
