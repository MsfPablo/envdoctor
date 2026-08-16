import { z } from "zod";
import type { EnvdoctorConfig } from "../config/config.js";
import { makeFinding, type Detector } from "./detector.js";

type VariableSchema = NonNullable<EnvdoctorConfig["schema"]>[string];

function buildValidator(schema: VariableSchema): z.ZodTypeAny | null {
  if (schema.enum && schema.enum.length > 0) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  switch (schema.type) {
    case "integer": {
      let v: z.ZodTypeAny = z.coerce.number().int();
      if (schema.min !== undefined) v = (v as z.ZodNumber).min(schema.min);
      if (schema.max !== undefined) v = (v as z.ZodNumber).max(schema.max);
      return v;
    }
    case "float": {
      let v: z.ZodTypeAny = z.coerce.number();
      if (schema.min !== undefined) v = (v as z.ZodNumber).min(schema.min);
      if (schema.max !== undefined) v = (v as z.ZodNumber).max(schema.max);
      return v;
    }
    case "boolean":
      return z.coerce.boolean();
    case "url":
      return z.string().url();
    case "json":
      return z.string().refine(
        (s) => {
          try {
            JSON.parse(s);
            return true;
          } catch {
            return false;
          }
        },
        { message: "must be valid JSON" },
      );
    case "regex": {
      if (!schema.regex) return null;
      try {
        const re = new RegExp(schema.regex);
        return z.string().regex(re, `must match ${schema.regex}`);
      } catch {
        return null;
      }
    }
    case "string":
    default:
      return z.string();
  }
}

function validateValue(
  value: string | undefined,
  schema: VariableSchema,
): { ok: true } | { ok: false; error: string } {
  if (value === undefined || value.trim() === "") {
    if (schema.optional ?? false) return { ok: true };
    return { ok: false, error: "value is required" };
  }

  const validator = buildValidator(schema);
  if (!validator) return { ok: true };

  const result = validator.safeParse(value);
  if (result.success) return { ok: true };

  const issue = result.error.issues[0];
  return { ok: false, error: issue?.message ?? "invalid value" };
}

export const schemaValidationDetector: Detector = {
  id: "schema-validation",
  name: "schema-validation",
  description: "A variable value does not match its declared schema.",
  detect(index) {
    const schema = index.model.config.schema;
    const schemaNames = Object.keys(schema);
    if (schemaNames.length === 0) return [];

    const findings = [];
    for (const [name, defs] of index.envDefinitions) {
      const variableSchema = schema[name];
      if (!variableSchema) continue;

      for (const def of defs) {
        const result = validateValue(def.value, variableSchema);
        if (result.ok) continue;
        findings.push(
          makeFinding(
            "schema-validation",
            "error",
            name,
            `does not match schema: ${result.error}`,
            [def.origin],
          ),
        );
      }
    }
    return findings;
  },
};
