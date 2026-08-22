# envdoctor (Python)

Native Python port of [envdoctor](https://github.com/arun-skg/envdoctor) — a
local-first consistency checker for environment variables, distributed on PyPI
so Python projects can use it without Node.

## Install

```bash
pip install arun-envdoctor
```

> The PyPI **distribution** is named `arun-envdoctor` (PyPI blocks `envdoctor` as
> too similar to an existing project), but the installed **command** and the
> importable **package** are both still `envdoctor`.

## Quick start

```bash
envdoctor scan --dir .        # audit; exit 1 on errors
envdoctor scan --strict       # treat warnings as errors too
```

## What it detects

Reconciles the environment variables **used** in your Python source
(`os.getenv("X")`, `os.environ.get("X")`, `os.environ["X"]`, and the
`from os import environ` forms) against those **defined** in your `.env` files,
then reports:

| Rule | Severity | Meaning |
|------|----------|---------|
| `undefined-in-source` | error | Used in code but not defined in any `.env` file |
| `unused` | warning | Defined in `.env` but never referenced in source |

Comments and docstrings are stripped before scanning, so documented examples
don't cause false positives. Nothing is uploaded and variable **values** are
never printed. `envdoctor scan` exits `1` when there are errors (or with
`--strict`, warnings), making it CI-friendly.

> This port implements the core missing/unused reconciliation. The additional
> detectors (duplicates, type-mismatch, schema validation, public-prefix secret
> leaks, and more) currently live only in the
> [Node reference implementation](https://github.com/arun-skg/envdoctor).

## Library use

```python
from pathlib import Path
from envdoctor import scan

result = scan(Path("."))
for finding in result.errors:
    print(finding.name, finding.message)
```

## Development

```bash
pip install -e ".[dev]" pytest
pytest
```

## Other languages

envdoctor ships as a standalone native port for each ecosystem:

- [Node (reference)](..) · [Go](../go) · [Ruby](../ruby) · [PHP](../php) · [Java](../java) · [Perl](../perl)
- 📖 Docs: [arun-skg.github.io/envdoctor](https://arun-skg.github.io/envdoctor/)
- Main repository: [github.com/arun-skg/envdoctor](https://github.com/arun-skg/envdoctor)
