import type { VariableType } from "../models/variable-type.js";

const INTEGER_RE = /^-?\d+$/;
const FLOAT_RE = /^-?\d+\.\d+([eE][+-]?\d+)?$/;
const BOOLEAN_RE = /^(true|false|TRUE|FALSE)$/;
const URL_RE = /^https?:\/\/\S+$/i;

/**
 * Infer the basic type of a variable value. Ordering matters: a value like
 * "1" is an integer, "1.5" is a float, "true" is a boolean, and a URL wins
 * over generic string. Anything unparseable or empty is "string" or "unknown".
 */
export function inferType(value: string | undefined): VariableType {
  if (value === undefined) return "unknown";
  const trimmed = value.trim();
  if (trimmed === "") return "unknown";
  if (INTEGER_RE.test(trimmed)) return "integer";
  if (FLOAT_RE.test(trimmed)) return "float";
  if (BOOLEAN_RE.test(trimmed)) return "boolean";
  if (URL_RE.test(trimmed)) return "url";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // fall through to string
    }
  }
  return "string";
}
