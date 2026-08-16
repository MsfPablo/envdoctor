import path from "node:path";
import { parse as parseYaml } from "yaml";
import { createVariable, mergeVariables } from "../models/environment-variable.js";
import type { EnvironmentVariable } from "../models/environment-variable.js";
import type { Origin } from "../models/origin.js";
import type { Parser } from "./parser.js";
import { scanInterpolations } from "./yaml-interp.js";

/**
 * Parser for Kubernetes manifests.
 *
 * Matches YAML files that look like Kubernetes resources (have apiVersion and
 * kind). Extracts container environment definitions and `${VAR}` / `$VAR`
 * interpolations from command/args/env values.
 */

function isYaml(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".yaml" || ext === ".yml";
}

function looksLikeK8s(doc: unknown): doc is Record<string, unknown> {
  return (
    doc !== null &&
    typeof doc === "object" &&
    !Array.isArray(doc) &&
    "apiVersion" in doc &&
    typeof doc.apiVersion === "string" &&
    "kind" in doc &&
    typeof doc.kind === "string"
  );
}

export const k8sParser: Parser = {
  id: "kubernetes",
  match(filePath) {
    return isYaml(filePath);
  },
  parse(content, filePath) {
    const docs = parseYaml(content, { prettyErrors: false }) as unknown;
    const docArray = Array.isArray(docs) ? docs : [docs];

    const variables: EnvironmentVariable[] = [];
    const usages: EnvironmentVariable[] = [];

    for (const doc of docArray) {
      if (!looksLikeK8s(doc)) continue;
      walkResource(doc, content, filePath, variables, usages);
    }

    return {
      filePath,
      format: "kubernetes",
      variables: mergeVariables(variables),
      usages: mergeVariables(usages),
    };
  },
};

function originAt(
  filePath: string,
  line: number | undefined,
  kind: Origin["kind"] = "definition",
): Origin {
  return { filePath, line, kind, format: "kubernetes" };
}

function walkResource(
  doc: Record<string, unknown>,
  content: string,
  filePath: string,
  variables: EnvironmentVariable[],
  usages: EnvironmentVariable[],
) {
  const kind = doc.kind;

  // ConfigMap data keys become definitions.
  if (kind === "ConfigMap") {
    const data = getObject(doc, "data");
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== "string") continue;
        variables.push(createVariable(key, value, [originAt(filePath, undefined)]));
      }
    }
    return;
  }

  const spec = getObject(doc, "spec");
  if (!spec) return;

  const template = getObject(spec, "template");
  const podSpec = template ? getObject(template, "spec") : spec;
  if (!podSpec || typeof podSpec !== "object") return;

  const containers = getArray(podSpec, "containers") ?? [];
  const initContainers = getArray(podSpec, "initContainers") ?? [];

  for (const container of [...containers, ...initContainers]) {
    if (!container || typeof container !== "object") continue;

    const env = getArray(container, "env") ?? [];
    for (const raw of env) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const name = entry.name;
      if (typeof name !== "string") continue;

      if ("value" in entry && typeof entry.value === "string") {
        variables.push(createVariable(name, entry.value, [originAt(filePath, undefined)]));
      } else if ("valueFrom" in entry) {
        // Referenced but value provided elsewhere (ConfigMap/Secret).
        usages.push(createVariable(name, undefined, [originAt(filePath, undefined, "usage")]));
      }
    }

    for (const raw of getArray(container, "envFrom") ?? []) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const prefix = typeof entry.prefix === "string" ? entry.prefix : "";
      if (entry.configMapRef && typeof entry.configMapRef === "object") {
        const refName = (entry.configMapRef as Record<string, unknown>).name;
        if (typeof refName === "string") {
          usages.push(createVariable(`${prefix}*`, undefined, [originAt(filePath, undefined, "usage")]));
        }
      }
      if (entry.secretRef && typeof entry.secretRef === "object") {
        const refName = (entry.secretRef as Record<string, unknown>).name;
        if (typeof refName === "string") {
          usages.push(createVariable(`${prefix}*`, undefined, [originAt(filePath, undefined, "usage")]));
        }
      }
    }

    // Interpolations in command/args.
    for (const key of ["command", "args"]) {
      const list = getArray(container, key);
      if (!list) continue;
      for (const item of list) {
        if (typeof item !== "string") continue;
        for (const interp of scanInterpolations(item)) {
          usages.push(createVariable(interp.name, undefined, [originAt(filePath, interp.line, "usage")]));
        }
      }
    }
  }
}

function getObject(obj: unknown, key: string): Record<string, unknown> | undefined {
  if (obj && typeof obj === "object" && !Array.isArray(obj) && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function getArray(obj: unknown, key: string): unknown[] | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}
