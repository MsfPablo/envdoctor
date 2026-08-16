import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSourceParser, stripComments } from "../../src/parsers/source.js";
import { fixturePath } from "../helpers.js";

const parser = createSourceParser(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);

describe("stripComments", () => {
  it("preserves line structure", () => {
    const input = "const a = 1; // trailing\n/* block */\nconst b = 2;\n";
    const out = stripComments(input);
    expect(out.split("\n").length).toBe(input.split("\n").length);
  });

  it("keeps code but blanks comments and string contents", () => {
    const input = "const a = process.env.FOO; // comment";
    const out = stripComments(input);
    expect(out).toContain("process.env.FOO");
    expect(out).not.toContain("comment");
  });

  it("does not mistake string literals for usage", () => {
    const out = stripComments('const s = "process.env.NOPE";');
    expect(out).not.toContain("process.env");
  });

  it("keeps template-literal interpolation as code", () => {
    const out = stripComments("const s = `host: ${process.env.HOST}`;");
    expect(out).toContain("process.env.HOST");
  });
});

describe("createSourceParser", () => {
  it("finds every supported access pattern", () => {
    const content = fs.readFileSync(path.join(fixturePath("parsers"), "source.ts"), "utf8");
    const file = parser.parse(content, "/proj/src/source.ts");
    const names = Array.from(new Set(file.usages.map((u) => u.name))).sort();
    expect(names).toEqual(
      ["BRACKET", "HOST", "PLAIN", "PORT", "SINGLE_BRACKET", "VITE_KEY"].sort(),
    );
  });

  it("never reports commented-out or string-literal usages", () => {
    const content = fs.readFileSync(path.join(fixturePath("parsers"), "source.ts"), "utf8");
    const file = parser.parse(content, "/proj/src/source.ts");
    const names = new Set(file.usages.map((u) => u.name));
    expect(names.has("COMMENTED_OUT")).toBe(false);
    expect(names.has("BLOCK_COMMENTED")).toBe(false);
    expect(names.has("IN_STRING")).toBe(false);
    expect(names.has("IN_SINGLE_STRING")).toBe(false);
    expect(names.has("IN_TEMPLATE_STRING")).toBe(false);
  });

  it("attributes usages to the right line", () => {
    const file = parser.parse("const a = process.env.PLAIN;\n", "/proj/a.ts");
    expect(file.usages[0]?.origins[0]?.line).toBe(1);
  });

  it("matches only configured extensions", () => {
    expect(parser.match("/proj/src/app.ts")).toBe(true);
    expect(parser.match("/proj/src/app.jsx")).toBe(true);
    expect(parser.match("/proj/src/styles.css")).toBe(false);
    expect(parser.match("/proj/src/readme.md")).toBe(false);
  });
});
