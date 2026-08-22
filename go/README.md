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
| `unused` | warning | Defined in `.env` but never referenced in source |

Line and block comments are stripped before scanning. `scan` exits `1` on
errors (or warnings with `--strict`). Values are never printed.

> This port implements the core missing/unused reconciliation. The additional
> detectors (duplicates, type-mismatch, schema validation, public-prefix secret
> leaks, and more) currently live only in the
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
