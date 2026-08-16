// Bracket access and string-literal false positive.

const apiKey = process.env["API_KEY"] ?? "missing";
const logLevel = process.env.LOG_LEVEL;

// This string contains "process.env.REDIS_URL" — it must NOT be reported.
const example = "process.env.REDIS_URL is not real usage";

export function config() {
  return { apiKey, logLevel, example };
}
