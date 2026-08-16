import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dockerComposeParser } from "../../src/parsers/docker-compose.js";
import { fixturePath } from "../helpers.js";

const fixture = () =>
  fs.readFileSync(path.join(fixturePath("parsers"), "docker-compose.yml"), "utf8");

describe("dockerComposeParser", () => {
  it("extracts map-form and list-form environment definitions", () => {
    const file = dockerComposeParser.parse(fixture(), "/proj/docker-compose.yml");

    const byName = new Map(file.variables.map((v) => [v.name, v]));
    expect(Array.from(byName.keys()).sort()).toEqual(
      ["API_KEY", "DEBUG", "LOG_LEVEL", "NODE_ENV", "PORT", "REDIS_URL"].sort(),
    );

    // Map form
    expect(byName.get("NODE_ENV")?.value).toBe("production");
    expect(byName.get("PORT")?.value).toBe("${PORT:-8080}");
    expect(byName.get("API_KEY")?.isSecret).toBe(true);

    // List form with value and bare reference
    expect(byName.get("REDIS_URL")?.value).toBe("${REDIS_URL}");
    expect(byName.get("LOG_LEVEL")?.value).toBeUndefined();
    expect(byName.get("LOG_LEVEL")?.origins[0]?.kind).toBe("reference");
    expect(byName.get("DEBUG")?.value).toBe("1");
  });

  it("records interpolation usages", () => {
    const file = dockerComposeParser.parse(fixture(), "/proj/docker-compose.yml");
    const names = Array.from(new Set(file.usages.map((v) => v.name))).sort();
    expect(names).toEqual(["PORT", "REDIS_URL"]);
  });

  it("handles empty and malformed files without throwing", () => {
    expect(() => dockerComposeParser.parse("", "/proj/docker-compose.yml")).not.toThrow();
    const empty = dockerComposeParser.parse("", "/proj/docker-compose.yml");
    expect(empty.variables).toEqual([]);
    expect(empty.usages).toEqual([]);
  });

  it("ignores $$ escapes when scanning interpolations", () => {
    const file = dockerComposeParser.parse(
      'services:\n  a:\n    image: busybox\n    command: echo "$$PORT is literal"\n',
      "/proj/docker-compose.yml",
    );
    expect(file.usages).toEqual([]);
  });
});
