import { describe, expect, it } from "vitest";
import { generateEnvTypes } from "../../src/generators/env-types.js";
import { buildModel } from "../helpers.js";

describe("generateEnvTypes", () => {
  it("emits an ambient ProcessEnv declaration for all known variables", () => {
    const model = buildModel([
      { path: "/p/.env", content: "PORT=3000\nAPI_KEY=secret\n" },
      { path: "/p/src/index.ts", content: "const t = process.env.TOKEN;\n" },
    ]);
    const output = generateEnvTypes(model);
    expect(output).toContain("interface ProcessEnv");
    expect(output).toContain("PORT: string;");
    expect(output).toContain("API_KEY: string;");
    expect(output).toContain("TOKEN: string;");
  });

  it("annotates secrets and inferred types but never emits values", () => {
    const model = buildModel([
      { path: "/p/.env", content: "PORT=3000\nAPI_KEY=secret\n" },
    ]);
    const output = generateEnvTypes(model);
    expect(output).toContain("/** secret");
    expect(output).toContain("inferred type: integer");
    expect(output).not.toContain("API_KEY=secret");
    expect(output).not.toContain("3000");
  });
});
