# envdoctor (Go)

Native Go implementation of [envdoctor](https://github.com/arun-skg/envdoctor) —
a local-first environment-variable consistency checker, installable as a Go
module so Go projects can use it without Node.

## Install

```bash
go install github.com/arun-skg/envdoctor/go/cmd/envdoctor@latest
```

## Quick start

```bash
envdoctor scan --dir .        # audit; exit 1 on errors
envdoctor scan --strict       # treat warnings as errors too
```

## What it detects

Reconciles the variables **used** in Go source (`os.Getenv("X")`,
`os.LookupEnv("X")`) against those **defined** in `.env` files:

| Rule | Severity | Meaning |
|------|----------|---------|
| `undefined-in-source` | error | Used in code but not defined in any `.env` file |
| `duplicates` | error | The same key is defined 2+ times within a single `.env` file |
| `public-prefix` | error | A secret-looking variable is exposed to client bundles via a public prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`, `GATSBY_`, `NUXT_PUBLIC_`, `VUE_APP_`, `PUBLIC_`) |
| `unused` | warning | Defined in `.env` but never referenced in source |

Line and block comments are stripped before scanning. `scan` exits `1` on
errors (or warnings with `--strict`). Values are never printed.

> This port implements the core missing/unused reconciliation plus the
> `duplicates` and `public-prefix` detectors. Further detectors (type-mismatch,
> schema validation, and more) currently live only in the
> [Node reference implementation](https://github.com/arun-skg/envdoctor).

## Development

```bash
cd go
go test ./...
go build ./cmd/envdoctor
```

## Other languages

envdoctor ships as a standalone native port for each ecosystem:

- [Node (reference)](..) · [Python](../python) · [Ruby](../ruby) · [PHP](../php) · [Java](../java) · [Perl](../perl)
- 📖 Docs: [arun-skg.github.io/envdoctor](https://arun-skg.github.io/envdoctor/)
- Main repository: [github.com/arun-skg/envdoctor](https://github.com/arun-skg/envdoctor)
