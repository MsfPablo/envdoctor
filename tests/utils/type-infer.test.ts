import { describe, expect, it } from "vitest";
import { inferType } from "../../src/utils/type-infer.js";

describe("inferType", () => {
  it.each([
    ["3000", "integer"],
    ["-42", "integer"],
    ["3.14", "float"],
    ["1.5e3", "float"],
    ["true", "boolean"],
    ["FALSE", "boolean"],
    ["https://example.com/path", "url"],
    ["http://localhost:3000", "url"],
    ['{"a":1}', "json"],
    ["[1,2,3]", "json"],
    ["hello world", "string"],
    ["3000abc", "string"],
    ["", "unknown"],
    [undefined, "unknown"],
  ] as const)("infers %j as %s", (value, expected) => {
    expect(inferType(value)).toBe(expected);
  });
});
