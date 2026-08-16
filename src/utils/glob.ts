/**
 * A tiny glob-to-regex converter for matching variable names and file paths
 * against config patterns (`ignoreVariables: ["AWS_*"]`, environment
 * overrides, etc.). Supports `*` (within a segment), `**`, and `?`.
 */
export function globToRegExp(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesGlob(pattern: string, value: string): boolean {
  return globToRegExp(pattern).test(value);
}

export function matchesAnyGlob(patterns: readonly string[], value: string): boolean {
  return patterns.some((pattern) => matchesGlob(pattern, value));
}
