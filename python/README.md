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
| `duplicates` | error | The same key is defined 2+ times within a single `.env` file |
| `public-prefix` | error | A secret-looking variable is exposed to client bundles via a public prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`, `GATSBY_`, `NUXT_PUBLIC_`, `VUE_APP_`, `PUBLIC_`) |
| `unused` | warning | Defined in `.env` but never referenced in source |

Comments and docstrings are stripped before scanning, so documented examples
don't cause false positives. Nothing is uploaded and variable **values** are
never printed. `envdoctor scan` exits `1` when there are errors (or with
`--strict`, warnings), making it CI-friendly.

> This port implements the core missing/unused reconciliation plus the
> `duplicates` and `public-prefix` detectors. Further detectors (type-mismatch,
> schema validation, and more) currently live only in the
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
