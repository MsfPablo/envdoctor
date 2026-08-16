import type { EnvironmentFile } from "../models/environment-file.js";

/**
 * A parser turns the raw text of one supported file format into envdoctor's
 * normalized `EnvironmentFile`. Parsers are independent and format-specific:
 * they know nothing about detectors, the audit, or each other.
 *
 * `match` decides whether a file path belongs to this format; `parse` handles
 * the content. A parser must never throw on malformed input — it should
 * produce whatever it can and let the caller report parse errors.
 */
export interface Parser {
  id: string;
  match(filePath: string): boolean;
  parse(content: string, filePath: string): EnvironmentFile;
}

/** Ordered list of parsers, most specific first. */
export type ParserRegistry = readonly Parser[];

/** Match a path against a registry; returns the first parser that claims it. */
export function parserForPath(
  registry: ParserRegistry,
  filePath: string,
): Parser | undefined {
  return registry.find((parser) => parser.match(filePath));
}
