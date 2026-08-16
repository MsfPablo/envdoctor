import type { ProjectModel } from "../models/project-model.js";
import type { Origin } from "../models/origin.js";
import { environmentDiffDetector } from "./environment-diff.js";
import { duplicatesDetector } from "./duplicates.js";
import { missingDetector } from "./missing.js";
import { typeMismatchDetector } from "./type-mismatch.js";
import { undefinedSourceDetector } from "./undefined-source.js";
import { unusedDetector } from "./unused.js";
import type { Definition, Detector, IndexedModel } from "./detector.js";
import { publicPrefixDetector } from "./public-prefix.js";
import { schemaValidationDetector } from "./schema-validation.js";
import { typoDetector } from "./typo.js";
import { weakSecretDetector } from "./weak-secret.js";

/**
 * All detectors, in a stable order. The audit engine runs them in this order
 * and the report renders in the same order.
 */
export const DETECTORS: readonly Detector[] = [
  missingDetector,
  unusedDetector,
  undefinedSourceDetector,
  duplicatesDetector,
  environmentDiffDetector,
  typeMismatchDetector,
  publicPrefixDetector,
  weakSecretDetector,
  typoDetector,
  schemaValidationDetector,
];

export type { Detector, IndexedModel } from "./detector.js";

/** Build the format-agnostic index detectors operate on. */
export function buildIndex(model: ProjectModel): IndexedModel {
  const envDefinitions = new Map<string, Definition[]>();
  const composeDefinitions = new Map<string, Definition[]>();
  const actionDefinitions = new Map<string, Definition[]>();
  const k8sDefinitions = new Map<string, Definition[]>();
  const usages = new Map<string, Origin[]>();
  const sourceUsages = new Map<string, Origin[]>();
  const exampleNames = new Set<string>();
  const envLabels = new Set<string>();

  const push = (map: Map<string, Definition[]>, def: Definition) => {
    const list = map.get(def.name) ?? [];
    list.push(def);
    map.set(def.name, list);
  };
  const pushOrigin = (map: Map<string, Origin[]>, name: string, origin: Origin) => {
    const list = map.get(name) ?? [];
    list.push(origin);
    map.set(name, list);
  };

  for (const file of model.envFiles) {
    if (file.environment === "example") {
      // .env.example documents what *should* exist but is not a runtime value.
      // Add to exampleNames only — do NOT add to envDefinitions.
      for (const v of file.variables) exampleNames.add(v.name);
    } else {
      if (file.environment) envLabels.add(file.environment);
      for (const v of file.variables) {
        for (const origin of v.origins) {
          push(envDefinitions, {
            name: v.name,
            value: v.value,
            type: v.type,
            isSecret: v.isSecret,
            environment: file.environment,
            origin,
          });
        }
      }
    }
  }

  for (const file of model.composeFiles) {
    for (const v of file.variables) {
      for (const origin of v.origins) {
        push(composeDefinitions, {
          name: v.name,
          value: v.value,
          type: v.type,
          isSecret: v.isSecret,
          environment: file.environment,
          origin,
        });
      }
    }
    for (const v of file.usages) {
      for (const origin of v.origins) pushOrigin(usages, v.name, origin);
    }
  }

  for (const file of model.actionFiles) {
    for (const v of file.variables) {
      for (const origin of v.origins) {
        push(actionDefinitions, {
          name: v.name,
          value: v.value,
          type: v.type,
          isSecret: v.isSecret,
          environment: file.environment,
          origin,
        });
      }
    }
    for (const v of file.usages) {
      for (const origin of v.origins) pushOrigin(usages, v.name, origin);
    }
  }

  for (const file of model.k8sFiles) {
    for (const v of file.variables) {
      for (const origin of v.origins) {
        push(k8sDefinitions, {
          name: v.name,
          value: v.value,
          type: v.type,
          isSecret: v.isSecret,
          environment: file.environment,
          origin,
        });
      }
    }
    for (const v of file.usages) {
      for (const origin of v.origins) pushOrigin(usages, v.name, origin);
    }
  }

  for (const file of model.sourceFiles) {
    for (const v of file.usages) {
      for (const origin of v.origins) {
        pushOrigin(usages, v.name, origin);
        pushOrigin(sourceUsages, v.name, origin);
      }
    }
  }

  return {
    model,
    envDefinitions,
    composeDefinitions,
    actionDefinitions,
    k8sDefinitions,
    usages,
    sourceUsages,
    exampleNames,
    envLabels: Array.from(envLabels),
  };
}
