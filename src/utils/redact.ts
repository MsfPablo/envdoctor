import { isSecretName } from "../models/environment-variable.js";

/**
 * Redaction helpers. The core invariant of envdoctor: **variable values are
 * never rendered in CLI output or written into generated files.** These
 * helpers exist to make that invariant impossible to break accidentally.
 */

/** Mask a value for display. Values are never displayed, so this is a guard. */
export function redactValue(value: string | undefined): string {
  if (value === undefined || value === "") return "";
  return "••••••••";
}

/** Placeholder written into generated `.env.example` files for secret vars. */
export function examplePlaceholder(name: string, isSecret: boolean): string {
  if (isSecret) return "";
  return `your_${name.toLowerCase()}`;
}

/** True when a name should never have its value copied into generated output. */
export const isSensitiveName = (name: string): boolean => isSecretName(name);
