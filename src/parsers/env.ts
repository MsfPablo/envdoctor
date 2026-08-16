import path from "node:path";
import type { EnvironmentFile } from "../models/environment-file.js";
import { createVariable } from "../models/environment-variable.js";
import type { EnvironmentVariable } from "../models/environment-variable.js";
import type { Origin } from "../models/origin.js";
import type { Parser } from "./parser.js";

/**
 * Parser for dotenv-style files (`.env`, `.env.local`, `.env.production`, ...).
 *
 * We hand-roll the tokenizer instead of using `dotenv.parse` because the audit
 * needs every occurrence of a key (to detect duplicates and to attribute
 * origins with line numbers), while `dotenv.parse` silently keeps only the
 * last value for a repeated key.
 */

interface EnvEntry {
  key: string;
  value: string | undefined;
  line: number;
}

/** The environment label derived from a dotenv filename. */
export function environmentLabelForDotenv(filePath: string): string {
  const base = path.basename(filePath);
  if (base === ".env") return "development";
  if (base === ".env.example") return "example";
  const suffix = base.replace(/^\.env\.?/, "");
  if (suffix === "") return "development";
  // `.env.development.local` → development, `.env.test` → test
  return suffix.replace(/\.local$/, "").replace(/\.$/, "") || "development";
}

function isKeyChar(ch: string): boolean {
  return /[\w.-]/.test(ch);
}

/**
 * Parse dotenv content into key/value/line entries.
 *
 * Handles: `export ` prefixes, blank lines, full-line comments, inline
 * comments after unquoted values (respecting `\#` escapes), single/double/
 * backtick quoting including multiline quoted values, and the common escape
 * sequences in double-quoted values. Lines without an `=` are ignored,
 * matching `dotenv` behavior.
 */
export function parseDotenv(content: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  const len = content.length;
  let i = 0;
  let line = 1;

  while (i < len) {
    // Skip whitespace and blank lines.
    while (i < len && /\s/.test(content[i]!)) {
      if (content[i] === "\n") line++;
      i++;
    }
    if (i >= len) break;

    // Full-line comment.
    if (content[i] === "#") {
      while (i < len && content[i] !== "\n") i++;
      continue;
    }

    // Optional `export` prefix.
    if (content.startsWith("export ", i)) {
      i += "export ".length;
      while (i < len && content[i] === " ") i++;
    }

    const startLine = line;

    // Read the key.
    const keyStart = i;
    while (i < len && isKeyChar(content[i]!)) i++;
    if (i === keyStart) {
      while (i < len && content[i] !== "\n") i++;
      continue;
    }
    const key = content.slice(keyStart, i);

    // Skip whitespace before `=`.
    while (i < len && content[i] !== "=" && content[i] !== "\n" && /\s/.test(content[i]!)) i++;
    if (content[i] !== "=") {
      // Malformed line (no `=`); ignore it like dotenv does.
      while (i < len && content[i] !== "\n") i++;
      continue;
    }
    i++; // consume `=`

    // Skip whitespace before the value.
    while (i < len && content[i] !== "\n" && /\s/.test(content[i]!)) i++;

    let value: string;
    const ch = content[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      let raw = "";
      while (i < len) {
        const c = content[i]!;
        if (c === quote) {
          i++;
          break;
        }
        if (c === "\\") {
          const next = content[i + 1];
          if (quote === '"' && next === "n") {
            raw += "\n";
            i += 2;
            continue;
          }
          if (quote === '"' && next === "t") {
            raw += "\t";
            i += 2;
            continue;
          }
          if (quote === '"' && next === "r") {
            raw += "\r";
            i += 2;
            continue;
          }
          if (next === '"' || next === "'" || next === "`" || next === "\\") {
            raw += next;
            i += 2;
            continue;
          }
          raw += c;
          i++;
          continue;
        }
        raw += c;
        if (c === "\n") line++;
        i++;
      }
      value = raw;
    } else {
      // Unquoted value: ends at newline or an unescaped `#`.
      let raw = "";
      while (i < len && content[i] !== "\n") {
        const c = content[i]!;
        if (c === "\\" && content[i + 1] === "#") {
          raw += "#";
          i += 2;
          continue;
        }
        if (c === "#") break;
        raw += c;
        i++;
      }
      value = raw.trimEnd();
    }

    entries.push({ key, value, line: startLine });
  }

  return entries;
}

export const envParser: Parser = {
  id: "dotenv",
  match(filePath) {
    const base = path.basename(filePath);
    return /^\.env(\..+)?$/.test(base);
  },
  parse(content, filePath) {
    const environment = environmentLabelForDotenv(filePath);
    const variables: EnvironmentVariable[] = [];
    for (const entry of parseDotenv(content)) {
      const origin: Origin = {
        filePath,
        line: entry.line,
        kind: "definition",
        environment,
        format: "dotenv",
      };
      variables.push(createVariable(entry.key, entry.value, [origin]));
    }
    const result: EnvironmentFile = {
      filePath,
      format: "dotenv",
      environment,
      variables,
      usages: [],
    };
    return result;
  },
};
