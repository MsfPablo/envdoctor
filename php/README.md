# envdoctor (PHP)

Native PHP port of [envdoctor](https://github.com/arun-skg/envdoctor) — a
local-first environment-variable consistency checker, installable via Composer.

## Install

```bash
composer require --dev arun-skg/envdoctor
```

## Quick start

```bash
vendor/bin/envdoctor scan --dir .        # audit; exit 1 on errors
vendor/bin/envdoctor scan --strict       # treat warnings as errors too
```

## What it detects

Reconciles variables **used** in PHP source (`getenv("X")`, `$_ENV["X"]`,
`$_SERVER["X"]`) against those **defined** in `.env` files:

| Rule | Severity | Meaning |
|------|----------|---------|
| `undefined-in-source` | error | Used in code but not defined in any `.env` file |
| `unused` | warning | Defined in `.env` but never referenced in source |

Line (`//`, `#`) and block (`/* */`) comments are stripped before scanning.
`scan` exits `1` on errors (or warnings with `--strict`). Values are never
printed.

> This port implements the core missing/unused reconciliation. The additional
> detectors (duplicates, type-mismatch, schema validation, public-prefix secret
> leaks, and more) currently live only in the
> [Node reference implementation](https://github.com/arun-skg/envdoctor).

## Development

```bash
cd php
php tests/ScannerTest.php   # dependency-free test runner
composer validate --strict
```

## Publishing

Packagist needs `composer.json` at a repo root, so this package is mirrored to a
read-only split repo, [arun-skg/envdoctor-php](https://github.com/arun-skg/envdoctor-php),
where the `php/` subtree sits at the root. Register **that** repo on
[packagist.org](https://packagist.org); its webhook publishes on each push/tag.
The split is kept current automatically by the `PHP Split` workflow (needs a
`SPLIT_REPO_TOKEN` secret). Do not edit the split repo directly — edit `php/` here.

## Other languages

envdoctor ships as a standalone native port for each ecosystem:

- [Node (reference)](..) · [Python](../python) · [Go](../go) · [Ruby](../ruby) · [Java](../java) · [Perl](../perl)
- 📖 Docs: [arun-skg.github.io/envdoctor](https://arun-skg.github.io/envdoctor/)
- Main repository: [github.com/arun-skg/envdoctor](https://github.com/arun-skg/envdoctor)
