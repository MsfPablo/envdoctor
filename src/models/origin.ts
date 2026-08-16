/**
 * Where a variable name was seen, and in what role.
 *
 * - `definition`: the variable has a value here (e.g. `FOO=bar` in a .env file,
 *   a `environment:` key in compose, an `env:` key in a workflow).
 * - `reference`: the variable is expected to exist but no value is given here
 *   (e.g. a bare `- FOO` compose entry, a workflow `env:` whose value is an
 *   expression, or a name listed in `.env.example`).
 * - `usage`: the variable is read somewhere (source code, `${VAR}` interpolation,
 *   `${{ secrets.X }}`).
 *
 * Origins carry file paths and line numbers so findings can point at real
 * locations. Values are intentionally NOT carried here.
 */
export type OriginKind = "definition" | "reference" | "usage";

export interface Origin {
  /** Path to the file where the variable appeared (repo-relative when possible). */
  filePath: string;
  /** 1-based line number when known. */
  line?: number;
  kind: OriginKind;
  /** Environment label (dotenv files only, e.g. "development", "production"). */
  environment?: string;
  /** The format the origin came from. */
  format?: "dotenv" | "docker-compose" | "github-actions" | "kubernetes" | "source";
  /** Format-specific detail (e.g. "secrets" vs "vars" for GitHub Actions). */
  subkind?: string;
}
