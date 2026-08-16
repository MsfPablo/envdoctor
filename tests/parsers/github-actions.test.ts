import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { githubActionsParser } from "../../src/parsers/github-actions.js";
import { fixturePath } from "../helpers.js";

const fixture = () =>
  fs.readFileSync(path.join(fixturePath("parsers"), "workflow.yml"), "utf8");

describe("githubActionsParser", () => {
  it("extracts env definitions at workflow, job, and step level", () => {
    const file = githubActionsParser.parse(fixture(), "/proj/.github/workflows/ci.yml");

    const byName = new Map(file.variables.map((v) => [v.name, v]));
    expect(Array.from(byName.keys()).sort()).toEqual(
      ["CI", "DATABASE_URL", "NODE_VERSION", "REGION", "TZ"].sort(),
    );
    expect(byName.get("CI")?.value).toBe("true");
    expect(byName.get("TZ")?.value).toBe("UTC");
    expect(byName.get("DATABASE_URL")?.value).toBe("${{ secrets.DATABASE_URL }}");
  });

  it("records secrets, vars, and shell interpolations as usages", () => {
    const file = githubActionsParser.parse(fixture(), "/proj/.github/workflows/ci.yml");

    const usageFor = (name: string) => file.usages.find((u) => u.name === name);
    const subkindOf = (name: string) => usageFor(name)?.origins[0]?.subkind;

    expect(subkindOf("DATABASE_URL")).toBe("secrets");
    expect(subkindOf("AWS_REGION")).toBe("vars");
    expect(subkindOf("DEPLOY_TOKEN")).toBe("secrets");
    expect(subkindOf("HOME")).toBeUndefined();
    expect(usageFor("DATABASE_URL")?.origins[0]?.line).toBe(19);
  });
});
