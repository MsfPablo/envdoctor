# @arun/envdoctor

[![CI](https://github.com/arun/envdoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/arun/envdoctor/actions/workflows/ci.yml)

**Local-first consistency checker for environment variables.** Detects missing, unused, duplicate, and mismatched variables across `.env` files, Docker Compose, GitHub Actions, and source code.

```
┌─────────────────────────────────────────────────────────────────┐
│  ENVIRONMENT AUDIT                                              │
│  ════════════════════════════════════════════════════════════════│
│                                                                 │
│  Missing (error)                                                │
│  ─────────────────────────────────────────────────────────────  │
│  ❌  COMPOSE_ONLY       docker-compose.yml:9   referenced but   │
│                          not defined in any environment file   │
│  ❌  DATABASE_URL       docker-compose.yml:7   referenced but   │
│                          not defined in any environment file   │
│  ❌  REDIS_URL          docker-compose.yml:15  referenced but   │
│                          not defined in any environment file   │
│  ❌  NEW_FEATURE_FLAG   src/index.ts:5         used in source   │
│                          code but not defined in any           │
│                          environment file                      │
│                                                                 │
│  Unused (warning)                                               │
│  ─────────────────────────────────────────────────────────────  │
│  ⚠  DEBUG_MODE          .env:7               defined but never │
│                          referenced anywhere                    │
│  ⚠  OLD_API_KEY         .env:9               defined but never │
│                          referenced anywhere                    │
│  ⚠  LOCAL_ONLY          .env.local:3         defined but never │
│                          referenced anywhere                    │
│  ⚠  JWT_SECRET          .env.production:7    defined but never │
│                          referenced anywhere                    │
│                                                                 │
│  Duplicates (error)                                             │
│  ─────────────────────────────────────────────────────────────  │
│  ❌  NODE_ENV            .env:2,12           defined 2 times   │
│                          on lines 2, 12                         │
│                                                                 │
│  Type mismatch (error)                                          │
│  ─────────────────────────────────────────────────────────────  │
│  ❌  PORT                expected: integer                      │
│                          found: string                          │
│                                                                 │
│  Environment differences                                        │
│  ─────────────────────────────────────────────────────────────  │
│  development → local · API_KEY missing in local                │
│  development → local · DATABASE_URL missing in local           │
│  development → production · JWT_SECRET missing in development  │
│                                                                 │
│  Summary: 8 files scanned · 15 variables · 3 errors · 16 warns │
└─────────────────────────────────────────────────────────────────┘
```

## Features

| Detector | Severity | What it catches |
|----------|----------|-----------------|
| **missing** | error | Variables referenced in docker-compose (definitions + `${VAR}` interpolation), GitHub Actions, or `.env.example` but not defined in any `.env` file |
| **unused** | warning | Variables defined in `.env` files but never referenced in source, compose, or actions |
| **undefined-in-source** | error | `process.env.X` / `import.meta.env.X` in source code with no definition in any `.env` file and not in `.env.example` |
| **duplicates** | error/warning | Same key defined twice in one file (error); same key across files sharing one environment label (warning) |
| **environment-diff** | warning | Set-membership diffs across environments (e.g. `dev` vs `prod`) |
| **type-mismatch** | error | Incompatible inferred types across environments, or values failing their own inferred type |

## Installation

```bash
# From npm (once published)
npm install -g @arun/envdoctor

# Or run directly with npx
npx @arun/envdoctor scan
```

## Quick Start

```bash
# Bootstrap config + .env.example + ENVIRONMENT.md in your project
envdoctor init

# Scan for issues (exits 1 on errors, 0 on clean)
envdoctor scan

# Compare two environments
envdoctor diff development production

# Generate/update docs (dry-run first)
envdoctor fix --dry-run
envdoctor fix
```

## Commands

### `envdoctor init [--force]`

Bootstraps a project:
- Creates `envdoctor.config.ts` with commented defaults (if missing)
- Generates `.env.example` from discovered variables (if missing)
- Generates `ENVIRONMENT.md` documentation (if missing)

Never overwrites existing files without `--force`.

### `envdoctor scan [options]`

Runs the full audit.

| Option | Description |
|--------|-------------|
| `-d, --dir <path>` | Project root (default: cwd) |
| `--strict` | Treat warnings as errors (exit 1) |
| `--json` | Machine-readable JSON output |
| `--verbose` | Show file:line locations |
| `--only <ruleId>` | Run only specific detector(s) |

**Exit codes:** `0` = clean, `1` = errors found, `2` = usage/config error

### `envdoctor fix [options]`

Generates/updates documentation files based on the audit:
- `.env.example` — all known variables with placeholders (secrets get empty values)
- `ENVIRONMENT.md` — comprehensive reference table + per-environment sections
- `.github/ENVIRONMENT.md` — checklist of `secrets.*`/`vars.*` for GitHub Actions (if applicable)

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without writing |
| `--force` | Overwrite without confirmation |

### `envdoctor diff <env1> <env2> [--json]`

Focused comparison between two environments (e.g. `dev prod`, `development production`).

Shows per-variable status: `✓ same`, `⚠ different`, `❌ missing`.

## Configuration

Create `envdoctor.config.ts` (or `.js`/`mjs`, or `package.json#envdoctor`):

```ts
export default {
  // Files considered as environment files (glob patterns)
  envFilePatterns: [".env", ".env.*"],
  
  // Docker Compose file patterns
  composeFiles: [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yaml",
    "compose.yml"
  ],
  
  // Source file extensions to scan
  sourceExtensions: ["ts", "tsx", "js", "jsx", "mjs", "cjs"],
  
  // Variable names to ignore entirely (glob patterns)
  ignoreVariables: [],
  
  // File paths to ignore
  ignoreFiles: [],
  
  // Explicit environment label → file list overrides
  environments: {
    // development: [".env", ".env.local"],
    // production: [".env.production"],
  },
  
  // Default for --strict
  strict: false,
};
```

## Environment Labels

| File | Label |
|------|-------|
| `.env` | `development` (base) |
| `.env.local` | `local` |
| `.env.production` | `production` |
| `.env.<suffix>` | `<suffix>` |
| `.env.example` | `example` (documentation only) |

Aliases: `dev` → `development`, `prod` → `production` for the `diff` command.

## Security

- **Values are never printed** to stdout/stderr (even with `--verbose`)
- **Secrets are never written** to generated files (`.env.example`, `ENVIRONMENT.md`, `.github/ENVIRONMENT.md`)
- Secret heuristic: name matches `/(SECRET|TOKEN|PASSWORD|PASS|API[_A-Z]*KEY|PRIVATE[_-]?KEY|CREDENTIALS)/i`

## GitHub Actions Integration

```yaml
# .github/workflows/env-audit.yml
name: Environment Audit
on: [push, pull_request]
jobs:
  envdoctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @arun/envdoctor
      - run: envdoctor scan --strict
```

## Output Formats

### Human (default)
Colorized, sectioned report as shown above.

### JSON (`--json`)
```json
{
  "exitCode": 1,
  "summary": {
    "filesScanned": 8,
    "variablesFound": 15,
    "errors": 4,
    "warnings": 16,
    "infos": 0,
    "total": 20
  },
  "findings": [
    {
      "id": "missing.COMPOSE_ONLY",
      "ruleId": "missing",
      "severity": "error",
      "variable": "COMPOSE_ONLY",
      "message": "referenced but not defined in any environment file",
      "locations": [
        { "file": "docker-compose.yml", "line": 9, "kind": "definition" }
      ]
    }
  ]
}
```

## Architecture

```
discovery (fast-glob)
    │
    ▼
parsers (dotenv, docker-compose, github-actions, source)
    │
    ▼
normalized ProjectModel (definitions + usages per file)
    │
    ▼
index (buildIndex: maps by name + environment)
    │
    ▼
detectors (missing, unused, undefined-in-source, duplicates, environment-diff, type-mismatch)
    │
    ▼
AuditResult (Findings + Summary + ExitCode)
    │
    ▼
generators (env-example, environment-doc, github-actions)
```

All parsers implement a common `Parser` interface — new formats can be added without changing detectors or generators.

## Development

```bash
# Install deps
npm install

# Run tests
npm test

# Typecheck
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Local smoke test
node dist/index.js scan --dir tests/fixtures/sample-project
```

## License

MIT