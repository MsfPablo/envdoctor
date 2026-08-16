import { dockerComposeParser } from "./docker-compose.js";
import { envParser } from "./env.js";
import { githubActionsParser } from "./github-actions.js";
import type { Parser, ParserRegistry } from "./parser.js";
import { createSourceParser } from "./source.js";

export interface RegistryOptions {
  sourceExtensions: readonly string[];
}

/**
 * Build the default parser registry. Parsers are independent and ordered
 * most-specific first; discovery assigns each discovered file to the first
 * parser whose `match` claims it.
 */
export function defaultRegistry(options: RegistryOptions): ParserRegistry {
  return [
    envParser,
    dockerComposeParser,
    githubActionsParser,
    createSourceParser(options.sourceExtensions),
  ] satisfies readonly Parser[];
}
