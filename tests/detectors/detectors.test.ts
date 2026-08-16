import { describe, expect, it } from "vitest";
import { buildIndex } from "../../src/detectors/index.js";
import { missingDetector } from "../../src/detectors/missing.js";
import { unusedDetector } from "../../src/detectors/unused.js";
import { undefinedSourceDetector } from "../../src/detectors/undefined-source.js";
import { duplicatesDetector } from "../../src/detectors/duplicates.js";
import { environmentDiffDetector } from "../../src/detectors/environment-diff.js";
import { typeMismatchDetector } from "../../src/detectors/type-mismatch.js";
import type { InMemoryFile } from "../helpers.js";
import { buildModel } from "../helpers.js";
import type { Detector } from "../../src/detectors/detector.js";

function detect(detector: Detector, files: InMemoryFile[]): string[] {
  const model = buildModel(files);
  const index = buildIndex(model);
  return detector.detect(index).map((f) => f.variable);
}

const ENV_FILE: InMemoryFile = { path: "/p/.env", content: "PORT=3000\n" };

describe("missing detector", () => {
  it("flags compose definitions, interpolations, and example docs not in any env file", () => {
    const files: InMemoryFile[] = [
      ENV_FILE,
      {
        path: "/p/docker-compose.yml",
        content:
          "services:\n  api:\n    environment:\n      COMPOSE_ONLY: x\n      EXTRA: ${DATABASE_URL}\n",
      },
      { path: "/p/.env.example", content: "DOCUMENTED_ONLY=\n" },
    ];
    // COMPOSE_ONLY: compose definition with no env file → missing
    // EXTRA: compose definition whose value interpolates DATABASE_URL → both missing
    // DOCUMENTED_ONLY: in .env.example but no env file → missing
    expect(detect(missingDetector, files).sort()).toEqual(
      ["COMPOSE_ONLY", "DATABASE_URL", "DOCUMENTED_ONLY", "EXTRA"].sort(),
    );
  });

  it("does not flag variables defined in an env file", () => {
    const files: InMemoryFile[] = [
      ENV_FILE,
      { path: "/p/docker-compose.yml", content: "services:\n  api:\n    environment:\n      PORT: 80\n" },
    ];
    expect(detect(missingDetector, files)).toEqual([]);
  });

  it("does not flag GitHub Actions env keys, secrets, or vars", () => {
    const files: InMemoryFile[] = [
      ENV_FILE,
      {
        path: "/p/.github/workflows/ci.yml",
        content:
          "name: ci\non: [push]\nenv:\n  CI: 'true'\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ${{ secrets.DEPLOY_TOKEN }}\n",
      },
    ];
    expect(detect(missingDetector, files)).toEqual([]);
  });
});

describe("unused detector", () => {
  it("flags env definitions never referenced anywhere", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: "PORT=3000\nOLD_KEY=abc\n" },
      { path: "/p/src/index.ts", content: "const p = process.env.PORT;\n" },
    ];
    expect(detect(unusedDetector, files)).toEqual(["OLD_KEY"]);
  });

  it("treats compose/actions references as usage", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: "PORT=3000\n" },
      { path: "/p/docker-compose.yml", content: "services:\n  api:\n    environment:\n      PORT: 80\n" },
    ];
    expect(detect(unusedDetector, files)).toEqual([]);
  });
});

describe("undefined-in-source detector", () => {
  it("flags source usages with no definition, including example-only variables", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: "PORT=3000\n" },
      { path: "/p/.env.example", content: "NEW_FEATURE=\n" },
      {
        path: "/p/src/index.ts",
        content: "const a = process.env.PORT;\nconst b = process.env.MYSTERY;\nconst c = process.env.NEW_FEATURE;\n",
      },
    ];
    expect(detect(undefinedSourceDetector, files).sort()).toEqual(["MYSTERY", "NEW_FEATURE"]);
  });
});

describe("duplicates detector", () => {
  it("flags the same key defined twice in one file", () => {
    const files: InMemoryFile[] = [{ path: "/p/.env", content: "A=1\nA=2\nB=3\n" }];
    expect(detect(duplicatesDetector, files)).toEqual(["A"]);
  });

  it("does not flag the same key across different files", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: "PORT=3000\n" },
      { path: "/p/.env.production", content: "PORT=8080\n" },
    ];
    expect(detect(duplicatesDetector, files)).toEqual([]);
  });
});

describe("environment-diff detector", () => {
  it("reports variables missing from one environment but present in another", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: "A=1\nB=2\nC=3\n" },
      { path: "/p/.env.production", content: "A=1\nC=3\nD=4\n" },
    ];
    expect(detect(environmentDiffDetector, files).sort()).toEqual(["B", "D"]);
  });

  it("is silent when only one environment exists", () => {
    const files: InMemoryFile[] = [{ path: "/p/.env", content: "A=1\n" }];
    expect(detect(environmentDiffDetector, files)).toEqual([]);
  });
});

describe("type-mismatch detector", () => {
  it("flags incompatible types across environments", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: 'PORT=3000\n' },
      { path: "/p/.env.production", content: 'PORT="3000abc"\n' },
    ];
    const model = buildModel(files);
    const findings = typeMismatchDetector.detect(buildIndex(model));
    expect(findings.map((f) => f.variable)).toEqual(["PORT"]);
    expect(findings[0]?.message).toContain("expected: integer");
  });

  it("is silent when types match", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: "PORT=3000\n" },
      { path: "/p/.env.production", content: "PORT=8080\n" },
    ];
    expect(detect(typeMismatchDetector, files)).toEqual([]);
  });
});
