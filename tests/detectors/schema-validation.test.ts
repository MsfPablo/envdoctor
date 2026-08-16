import { describe, expect, it } from "vitest";
import { buildIndex } from "../../src/detectors/index.js";
import { schemaValidationDetector } from "../../src/detectors/schema-validation.js";
import { buildModel } from "../helpers.js";
import type { EnvdoctorConfig } from "../../src/config/config.js";

describe("schema-validation detector", () => {
  it("flags values that violate the configured schema", () => {
    const config: EnvdoctorConfig = {
      envFilePatterns: [".env", ".env.*"],
      composeFilePatterns: ["**/docker-compose*.y*ml", "**/compose*.y*ml"],
      actionsFilePatterns: [".github/workflows/**/*.y*ml"],
      k8sFilePatterns: [],
      sourceExtensions: ["ts", "tsx", "js", "jsx", "mjs", "cjs"],
      ignoreVariables: [],
      ignoreFiles: [],
      strict: false,
      rules: {},
      schema: {
        PORT: { type: "integer", min: 1024 },
        NODE_ENV: { enum: ["development", "production", "test"] },
      },
    };
    const model = buildModel(
      [
        { path: "/p/.env", content: "PORT=80\nNODE_ENV=dev\n" },
      ],
      config,
    );
    const findings = schemaValidationDetector.detect(buildIndex(model));
    const vars = findings.map((f) => f.variable).sort();
    expect(vars).toEqual(["NODE_ENV", "PORT"]);
  });

  it("is silent when values match the schema", () => {
    const config: EnvdoctorConfig = {
      envFilePatterns: [".env", ".env.*"],
      composeFilePatterns: ["**/docker-compose*.y*ml", "**/compose*.y*ml"],
      actionsFilePatterns: [".github/workflows/**/*.y*ml"],
      k8sFilePatterns: [],
      sourceExtensions: ["ts", "tsx", "js", "jsx", "mjs", "cjs"],
      ignoreVariables: [],
      ignoreFiles: [],
      strict: false,
      rules: {},
      schema: { PORT: { type: "integer" } },
    };
    const model = buildModel([{ path: "/p/.env", content: "PORT=3000\n" }], config);
    expect(schemaValidationDetector.detect(buildIndex(model))).toEqual([]);
  });
});
