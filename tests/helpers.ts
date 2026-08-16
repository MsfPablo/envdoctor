import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_CONFIG, type EnvdoctorConfig } from "../src/config/config.js";
import type { ProjectContext } from "../src/core/pipeline.js";
import { loadProject } from "../src/core/pipeline.js";
import { dockerComposeParser } from "../src/parsers/docker-compose.js";
import { envParser } from "../src/parsers/env.js";
import { githubActionsParser } from "../src/parsers/github-actions.js";
import { k8sParser } from "../src/parsers/k8s.js";
import { createSourceParser } from "../src/parsers/source.js";
import type { EnvironmentFile } from "../src/models/environment-file.js";
import type { ProjectModel } from "../src/models/project-model.js";

export interface InMemoryFile {
  path: string;
  content: string;
}

/** Build a `ProjectModel` directly from in-memory files (parser unit tests). */
export function buildModel(files: InMemoryFile[], config: EnvdoctorConfig = DEFAULT_CONFIG): ProjectModel {
  const envFiles: EnvironmentFile[] = [];
  const composeFiles: EnvironmentFile[] = [];
  const actionFiles: EnvironmentFile[] = [];
  const k8sFiles: EnvironmentFile[] = [];
  const sourceFiles: EnvironmentFile[] = [];

  const sourceParser = createSourceParser(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);

  for (const file of files) {
    let parsed: EnvironmentFile;
    if (envParser.match(file.path)) {
      parsed = envParser.parse(file.content, file.path);
    } else if (dockerComposeParser.match(file.path)) {
      parsed = dockerComposeParser.parse(file.content, file.path);
    } else if (githubActionsParser.match(file.path)) {
      parsed = githubActionsParser.parse(file.content, file.path);
    } else if (k8sParser.match(file.path)) {
      parsed = k8sParser.parse(file.content, file.path);
    } else {
      parsed = sourceParser.parse(file.content, file.path);
    }

    switch (parsed.format) {
      case "dotenv":
        envFiles.push(parsed);
        break;
      case "docker-compose":
        composeFiles.push(parsed);
        break;
      case "github-actions":
        actionFiles.push(parsed);
        break;
      case "kubernetes":
        k8sFiles.push(parsed);
        break;
      case "source":
        sourceFiles.push(parsed);
        break;
    }
  }

  return {
    rootDir: "/test",
    config,
    envFiles,
    composeFiles,
    actionFiles,
    k8sFiles,
    sourceFiles,
    allFiles: [...envFiles, ...composeFiles, ...actionFiles, ...k8sFiles, ...sourceFiles],
    parseErrors: [],
  };
}

/** Load the sample-project fixture through the real discovery pipeline. */
export async function loadSampleProject(): Promise<{ rootDir: string; context: ProjectContext }> {
  const rootDir = fixturePath("sample-project");
  const context = await loadProject(rootDir);
  return { rootDir, context };
}

export function fixturePath(name: string): string {
  return path.join(process.cwd(), "tests", "fixtures", name);
}

/** Copy a fixture into a fresh temp dir and return the temp dir path. */
export function copyFixtureToTemp(name: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "envdoctor-"));
  fs.cpSync(fixturePath(name), tmp, { recursive: true });
  return tmp;
}

/** Run an async command while capturing stdout/stderr. */
export async function capture(
  fn: () => Promise<number>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const originalOut = process.stdout.write.bind(process.stdout);
  const originalErr = process.stderr.write.bind(process.stderr);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stdout.write as any) = (chunk: string) => {
    out.push(String(chunk));
    return true;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr.write as any) = (chunk: string) => {
    err.push(String(chunk));
    return true;
  };

  try {
    const code = await fn();
    return { code, stdout: out.join(""), stderr: err.join("") };
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }
}
