import type { Finding } from "../models/audit-result.js";
import type { ProjectModel } from "../models/project-model.js";
import type { Origin } from "../models/origin.js";
import type { VariableType } from "../models/variable-type.js";

/** A concrete definition of a variable in one file. */
export interface Definition {
  name: string;
  value?: string;
  type: VariableType;
  isSecret: boolean;
  environment?: string;
  origin: Origin;
}

/**
 * The format-agnostic view detectors operate on. Built once by `buildIndex`
 * so detectors never scan raw files and never repeat the same work.
 */
export interface IndexedModel {
  model: ProjectModel;
  /** Every definition found in dotenv files, keyed by name (duplicates kept). */
  envDefinitions: Map<string, Definition[]>;
  /** Definitions found in docker-compose files, keyed by name. */
  composeDefinitions: Map<string, Definition[]>;
  /** Definitions found in GitHub Actions workflows, keyed by name. */
  actionDefinitions: Map<string, Definition[]>;
  /** Every usage (source, compose, actions), keyed by name. */
  usages: Map<string, Origin[]>;
  /** Usages that come specifically from source code. */
  sourceUsages: Map<string, Origin[]>;
  /** Names documented in `.env.example`. */
  exampleNames: Set<string>;
  /** Distinct environment labels among dotenv files (excluding "example"). */
  envLabels: string[];
}

export interface Detector {
  id: string;
  name: string;
  description: string;
  detect(index: IndexedModel): Finding[];
}

/** Helper to create a finding with a stable id. */
export function makeFinding(
  ruleId: string,
  severity: Finding["severity"],
  variable: string,
  message: string,
  locations: Origin[],
): Finding {
  return { id: `${ruleId}.${variable}`, ruleId, severity, variable, message, locations };
}
