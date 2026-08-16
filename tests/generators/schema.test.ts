import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProject } from "../../src/core/pipeline.js";
import { generateSchema } from "../../src/generators/schema.js";

describe("generateSchema", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "envdoctor-schema-"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function projectWith(files: Record<string, string>): Promise<string> {
    const root = fs.mkdtempSync(path.join(tmpDir, "project-"));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(root, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    return root;
  }

  it("infers integer from parseInt usage", async () => {
    const root = await projectWith({
      ".env": "PORT=3000\n",
      "src/index.ts": "const port = parseInt(process.env.PORT);\n",
    });
    const { model } = await loadProject(root);
    const output = generateSchema(model);
    expect(output).toContain('PORT: { type: "integer" }');
  });

  it("infers boolean from equality check", async () => {
    const root = await projectWith({
      ".env": 'DEBUG=true\n',
      "src/index.ts": 'const debug = process.env.DEBUG === "true";\n',
    });
    const { model } = await loadProject(root);
    const output = generateSchema(model);
    expect(output).toContain('DEBUG: { type: "boolean" }');
  });

  it("infers float from Number() usage", async () => {
    const root = await projectWith({
      ".env": "RATIO=1.5\n",
      "src/index.ts": "const ratio = Number(process.env.RATIO);\n",
    });
    const { model } = await loadProject(root);
    const output = generateSchema(model);
    expect(output).toContain('RATIO: { type: "float" }');
  });

  it("does not emit values", async () => {
    const root = await projectWith({
      ".env": "API_KEY=super-secret\n",
      "src/index.ts": "const key = process.env.API_KEY;\n",
    });
    const { model } = await loadProject(root);
    const output = generateSchema(model);
    expect(output).not.toContain("super-secret");
  });
});
