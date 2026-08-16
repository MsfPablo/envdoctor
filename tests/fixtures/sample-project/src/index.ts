/**
 * Sample application for envdoctor's test fixture.
 *
 * Uses a mix of defined, undefined, and commented-out environment variables
 * so the audit has deterministic findings.
 */

const port = process.env.PORT ?? 3000;

// This comment mentions process.env.PORT — it must NOT be treated as usage.
function databaseUrl(): string {
  // The real connection string lives in the environment.
  return process.env.DATABASE_URL ?? "postgres://localhost:5432/app";
}

// Usage inside a template literal — this IS a real usage.
const message = `Listening on http://localhost:${process.env.PORT}`;

// Completely undefined: code will read `undefined` at runtime.
const featureFlag = process.env.NEW_FEATURE_FLAG;

// Deliberately disabled in a comment — must NOT be reported.
// const disabled = process.env.DISABLED_FEATURE;

export function buildServer() {
  console.log(databaseUrl(), message);
  return { port, featureFlag };
}
