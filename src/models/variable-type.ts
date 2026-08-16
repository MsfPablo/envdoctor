/**
 * The basic value types envdoctor can infer from a variable's value.
 * Inference lives in `utils/type-infer.ts`; detectors compare these across
 * environments to surface type mismatches.
 */
export type VariableType =
  | "integer"
  | "float"
  | "boolean"
  | "url"
  | "json"
  | "string"
  | "unknown";

/** Human-readable labels used in CLI output and generated docs. */
export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  integer: "integer",
  float: "float",
  boolean: "boolean",
  url: "url",
  json: "json",
  string: "string",
  unknown: "unknown",
};
