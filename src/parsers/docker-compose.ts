import path from "node:path";
import { parse as parseYaml } from "yaml";
import { createVariable, mergeVariables } from "../models/environment-variable.js";
import type { EnvironmentVariable } from "../models/environment-variable.js";
import type { Origin } from "../models/origin.js";
import type { Parser } from "./parser.js";
import { lineForOffset, scanInterpolations } from "./yaml-interp.js";

const COMPOSE_BASENAMES = new Set([
  "docker-compose.yml",
  "docker-compose.yaml",
  "docker-compose.override.yml",
  "docker-compose.override.yaml",
  "compose.yml",
  "compose.yaml",
]);

/**
 * Parser for docker-compose files.
 *
 * Definitions come from `services.<name>.environment:` blocks (both the map
 * and the list form). Bare list entries (`- FOO`) become value-less
 * definitions. `$VAR` / `${VAR}` interpolation anywhere in the file becomes
 * usages.
 */
export const dockerComposeParser: Parser = {
  id: "docker-compose",
  match(filePath) {
    return COMPOSE_BASENAMES.has(path.basename(filePath));
  },
  parse(content, filePath) {
    const doc = parseYaml(content) as Record<string, unknown> | null;
    const variables: EnvironmentVariable[] = [];
    const services =
      doc && typeof doc === "object" && "services" in doc
        ? (doc.services as Record<string, unknown>)
        : undefined;

    if (services && typeof services === "object" && !Array.isArray(services)) {
      for (const [serviceName, serviceValue] of Object.entries(services)) {
        void serviceName;
        const env =
          serviceValue &&
          typeof serviceValue === "object" &&
          !Array.isArray(serviceValue) &&
          "environment" in serviceValue
            ? (serviceValue as Record<string, unknown>).environment
            : undefined;

        for (const entry of normalizeEnvironment(env, content, filePath)) {
          variables.push(entry);
        }
      }
    }

    // `$VAR` / `${VAR}` interpolation → usages.
    const usages: EnvironmentVariable[] = [];
    for (const interp of scanInterpolations(content)) {
      const origin: Origin = {
        filePath,
        line: interp.line,
        kind: "usage",
        format: "docker-compose",
      };
      usages.push(createVariable(interp.name, undefined, [origin]));
    }

    return {
      filePath,
      format: "docker-compose",
      variables: mergeVariables(variables),
      usages: mergeVariables(usages),
    };
  },
};

/** Flatten a service's `environment:` value into definition variables. */
function normalizeEnvironment(
  env: unknown,
  content: string,
  filePath: string,
): EnvironmentVariable[] {
  if (!env) return [];
  const variables: EnvironmentVariable[] = [];

  if (typeof env === "object" && !Array.isArray(env)) {
    // Map form: KEY: value
    for (const [key, rawValue] of Object.entries(env)) {
      const value = rawValue === null ? undefined : String(rawValue);
      const origin: Origin = {
        filePath,
        line: lineForName(content, key),
        kind: value === undefined ? "reference" : "definition",
        format: "docker-compose",
      };
      variables.push(createVariable(key, value, [origin]));
    }
  } else if (Array.isArray(env)) {
    // List form: - KEY=value | - KEY
    for (const item of env) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (trimmed === "") continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        const origin: Origin = {
          filePath,
          line: lineForName(content, trimmed),
          kind: "reference",
          format: "docker-compose",
        };
        variables.push(createVariable(trimmed, undefined, [origin]));
      } else {
        const key = trimmed.slice(0, eq);
        const value = trimmed.slice(eq + 1);
        const origin: Origin = {
          filePath,
          line: lineForName(content, key),
          kind: "definition",
          format: "docker-compose",
        };
        variables.push(createVariable(key, value, [origin]));
      }
    }
  }

  return variables;
}

/** Best-effort line lookup for a definition name in the raw YAML text. */
function lineForName(content: string, name: string): number | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Supports both map form (`KEY: value`) and list form (`- KEY=value`).
  const re = new RegExp(`^\\s*[- ]*["']?${escaped}["']?\\s*[:=]`, "m");
  const match = re.exec(content);
  return match ? lineForOffset(content, match.index) : undefined;
}
