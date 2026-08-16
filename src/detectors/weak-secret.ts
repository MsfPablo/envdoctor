import { makeFinding, type Detector } from "./detector.js";

/**
 * Weak/placeholder secret detector.
 *
 * Secret-like variables in real env files should not use obvious placeholder
 * values. This detector only inspects definitions in actual environment files,
 * never `.env.example`.
 */

const BLOCKLIST = new Set([
  "",
  "changeme",
  "password",
  "password123",
  "secret",
  "secret123",
  "token",
  "key",
  "apikey",
  "api_key",
  "test",
  "testing",
  "12345678",
  "123456789",
  "1234567890",
  "your_secret",
  "your_token",
  "your_api_key",
  "your_password",
  "example",
  "dummy",
  "foo",
  "bar",
  "admin",
  "default",
  "null",
  "undefined",
]);

function isWeakSecret(name: string, value: string | undefined): boolean {
  if (value === undefined) return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (BLOCKLIST.has(trimmed.toLowerCase())) return true;
  if (trimmed.length < 8) return true;
  return false;
}

export const weakSecretDetector: Detector = {
  id: "weak-secret",
  name: "weak-secret",
  description:
    "A secret-looking variable in an environment file has a weak or placeholder value.",
  detect(index) {
    const findings = [];
    for (const [name, defs] of index.envDefinitions) {
      for (const def of defs) {
        if (!def.isSecret) continue;
        if (!isWeakSecret(name, def.value)) continue;
        findings.push(
          makeFinding(
            "weak-secret",
            "warning",
            name,
            `${name} has a weak or placeholder value in ${def.origin.filePath}${def.origin.line ? `:${def.origin.line}` : ""}`,
            [def.origin],
          ),
        );
      }
    }
    return findings;
  },
};
