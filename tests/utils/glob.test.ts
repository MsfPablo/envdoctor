import { describe, expect, it } from "vitest";
import { matchesAnyGlob, matchesGlob } from "../../src/utils/glob.js";

describe("glob matching", () => {
  it("supports * within a segment", () => {
    expect(matchesGlob("AWS_*", "AWS_REGION")).toBe(true);
    expect(matchesGlob("AWS_*", "DB_URL")).toBe(false);
  });

  it("supports ?", () => {
    expect(matchesGlob("NODE_VERSIO?", "NODE_VERSION")).toBe(true);
  });

  it("supports **", () => {
    expect(matchesGlob("**/*.ts", "src/a.ts")).toBe(true);
  });

  it("matches any of several patterns", () => {
    expect(matchesAnyGlob(["AWS_*", "DB_*"], "DB_URL")).toBe(true);
    expect(matchesAnyGlob(["AWS_*", "DB_*"], "OTHER")).toBe(false);
  });
});
