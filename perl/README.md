# envdoctor (Perl)

Native Perl port of [envdoctor](https://github.com/arun-skg/envdoctor) — a
local-first environment-variable consistency checker, distributed as the
`App::Envdoctor` CPAN package.

## Install

```bash
cpanm App::Envdoctor
```

> **CPAN release pending** — the `App::Envdoctor` distribution is coming soon.
> Until it lands, install from a checkout:
>
> ```bash
> perl Makefile.PL && make && make install
> ```

## Quick start

```bash
envdoctor scan --dir .        # audit; exit 1 on errors
envdoctor scan --strict       # treat warnings as errors too
```

## What it detects

Reconciles variables **used** in Perl source (`$ENV{X}`, `$ENV{'X'}`,
`$ENV{"X"}`) against those **defined** in `.env` files:

| Rule | Severity | Meaning |
|------|----------|---------|
| `undefined-in-source` | error | Used in code but not defined in any `.env` file |
| `duplicates` | error | Same key defined 2+ times in a single `.env` file |
| `public-prefix` | error | Secret-looking variable exposed to client bundles via a public prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, …) |
| `unused` | warning | Defined in `.env` but never referenced in source |

Line comments and POD blocks (`=pod … =cut`) are stripped before scanning.
`scan` exits `1` on errors (or warnings with `--strict`). Values are never
printed. Uses only core modules (`File::Find`, `File::Spec`, `Test::More`).

> This port implements the core missing/unused reconciliation plus the
> duplicates and public-prefix secret-leak detectors. The remaining detectors
> (type-mismatch, schema validation, and more) currently live only in the
> [Node reference implementation](https://github.com/arun-skg/envdoctor).

## Development

```bash
cd perl
prove -Ilib t/
```

## Other languages

envdoctor ships as a standalone native port for each ecosystem:

- [Node (reference)](..) · [Python](../python) · [Go](../go) · [Ruby](../ruby) · [PHP](../php) · [Java](../java)
- 📖 Docs: [arun-skg.github.io/envdoctor](https://arun-skg.github.io/envdoctor/)
- Main repository: [github.com/arun-skg/envdoctor](https://github.com/arun-skg/envdoctor)
