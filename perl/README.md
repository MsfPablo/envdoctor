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
envdoctor scan --json         # machine-readable JSON array (no values)
```

## What it detects

Reconciles variables **used** in Perl source (`$ENV{X}`, `$ENV{'X'}`,
`$ENV{"X"}`) against those **defined** in `.env` files:

| Rule | Severity | Meaning |
|------|----------|---------|
| `undefined-in-source` | error | Used in code but not defined in any `.env` file |
| `duplicates` | error | Same key defined 2+ times in a single `.env` file |
| `public-prefix` | error | Secret-looking variable exposed to client bundles via a public prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, …) |
| `type-mismatch` | error | A variable's inferred value type differs across environments (e.g. integer in one `.env`, string in another) |
| `unused` | warning | Defined in `.env` but never referenced in source |
| `environment-diff` | warning | Defined in some environment files but missing from others |
| `weak-secret` | warning | Secret-looking variable has a weak or placeholder value |
| `typo` | warning | Used name closely matches a defined name (likely a misspelling) |

Multiple `.env` files are grouped into environment labels by filename
(`.env`→`default`, `.env.local`→`local`, `.env.production`→`production`,
`.env.production.local`→`production`; `*.example` is skipped). Values are read
only to power detection and are **never** printed in any output.

Add `--json` to emit a JSON array of findings (keys `rule`, `severity`,
`name`, `message`, `file`, `line`) instead of the human report; the exit code
is unchanged.

Line comments and POD blocks (`=pod … =cut`) are stripped before scanning.
`scan` exits `1` on errors (or warnings with `--strict`). Uses only core
modules (`File::Find`, `File::Spec`, `JSON::PP`, `Test::More`).

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
