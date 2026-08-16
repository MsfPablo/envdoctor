import path from "node:path";
import { createVariable, mergeVariables } from "../models/environment-variable.js";
import type { EnvironmentVariable } from "../models/environment-variable.js";
import type { Origin } from "../models/origin.js";
import type { Parser } from "./parser.js";

const USAGE_PATTERNS: { re: RegExp; description: string }[] = [
  { re: /\bprocess\.env\.([A-Za-z_$][\w$]*)/g, description: "process.env.NAME" },
  {
    re: /\bprocess\.env\[['"]([A-Za-z_$][\w$]*)['"]\]/g,
    description: "process.env['NAME']",
  },
  { re: /\bimport\.meta\.env\.([A-Za-z_$][\w$]*)/g, description: "import.meta.env.NAME" },
];

/**
 * Create the source-code parser for a set of file extensions.
 *
 * Scans for `process.env.NAME`, `process.env['NAME']`, and `import.meta.env.NAME`
 * usages. Comments and string literals are stripped first (a state machine that
 * understands quotes, escape sequences, template literals, and `${...}`
 * interpolation) so documented/string occurrences don't create false positives.
 */
export function createSourceParser(extensions: readonly string[]): Parser {
  const extSet = new Set(extensions.map((e) => e.replace(/^\./, "").toLowerCase()));

  return {
    id: "source",
    match(filePath) {
      return extSet.has(path.extname(filePath).slice(1).toLowerCase());
    },
    parse(content, filePath) {
      const stripped = stripComments(content);
      const usages: EnvironmentVariable[] = [];

      for (const { re } of USAGE_PATTERNS) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(stripped)) !== null) {
          const name = match[1];
          if (name === undefined) continue;
          const origin: Origin = {
            filePath,
            line: lineNumberAt(stripped, match.index),
            kind: "usage",
            format: "source",
          };
          usages.push(createVariable(name, undefined, [origin]));
        }
      }

      return {
        filePath,
        format: "source",
        variables: [],
        usages: mergeVariables(usages),
      };
    },
  };
}

/** 1-based line number for a character offset in `text`. */
function lineNumberAt(text: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

type Mode = "code" | "code-tpl" | "sq" | "dq" | "tq";

interface Frame {
  mode: Mode;
  /** Brace depth for `${...}` interpolation inside a template literal. */
  tplDepth: number;
  /**
   * For string frames: when true, the string content is preserved verbatim
   * (used for computed-property access like `process.env["KEY"]` where the
   * string is a variable name, not a literal we want to blank out).
   */
  preserve: boolean;
}

/**
 * Replace comments and string-literal *contents* with spaces while preserving
 * line structure (newlines and everything else are kept in position).
 * Template-literal `${...}` interpolation is treated as code so
 * `process.env.X` inside it is still found. This makes the later regex scan
 * immune to comments and strings without needing a full JS parser.
 */
export function stripComments(code: string): string {
  let out = "";
  const len = code.length;
  let i = 0;
  const stack: Frame[] = [{ mode: "code", tplDepth: 0, preserve: false }];

  const current = () => stack[stack.length - 1]!;

  const skipLineComment = () => {
    while (i < len && code[i] !== "\n") {
      out += " ";
      i++;
    }
  };

  const skipBlockComment = () => {
    out += "  ";
    i += 2;
    while (i < len) {
      if (code[i] === "*" && code[i + 1] === "/") {
        out += "  ";
        i += 2;
        return;
      }
      if (code[i] === "\n") out += "\n";
      else out += " ";
      i++;
    }
  };

  while (i < len) {
    const c = code[i]!;
    const next = code[i + 1];
    const frame = current();
    const { mode } = frame;

    switch (mode) {
      case "code":
      case "code-tpl": {
        if (c === "'" || c === '"' || c === "`") {
          const stringMode: Mode = c === "`" ? "tq" : c === '"' ? "dq" : "sq";
          // A string that immediately follows `[` is a computed-property key
          // (e.g. process.env["KEY"]) — its content must be preserved so the
          // later regex can extract the variable name.
          const preserve = c !== "`" && i > 0 && code[i - 1] === "[";
          stack.push({ mode: stringMode, tplDepth: 0, preserve });
          out += c;
          i++;
          break;
        }
        if (c === "/" && next === "/") {
          skipLineComment();
          break;
        }
        if (c === "/" && next === "*") {
          skipBlockComment();
          break;
        }
        if (mode === "code-tpl") {
          if (c === "{") {
            frame.tplDepth++;
          } else if (c === "}") {
            frame.tplDepth--;
            if (frame.tplDepth === 0) {
              stack.pop();
            }
          }
        }
        out += c;
        i++;
        break;
      }

      case "tq": {
        if (c === "\\" && next) {
          out += c + next;
          i += 2;
          break;
        }
        if (c === "`") {
          stack.pop();
          out += c;
          i++;
          break;
        }
        if (c === "$" && next === "{") {
          out += "$" + "{";
          i += 2;
          stack.push({ mode: "code-tpl", tplDepth: 1, preserve: false });
          break;
        }
        // Template-literal content (not in interpolation) is blanked so that
        // embedded `process.env.X` literals don't create false positives.
        out += " ";
        i++;
        break;
      }

      case "sq":
      case "dq": {
        const quote = mode === "sq" ? "'" : '"';
        if (c === "\\" && next) {
          if (frame.preserve) {
            out += c + next;
          } else {
            out += "  ";
          }
          i += 2;
        } else if (c === quote) {
          out += c;
          i++;
          stack.pop();
        } else if (frame.preserve) {
          // Preserve computed-property key content verbatim.
          out += c;
          i++;
        } else {
          // Regular string literal content — blank it out.
          out += " ";
          i++;
        }
        break;
      }
    }
  }

  return out;
}
