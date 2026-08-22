# envdoctor (Java)

Native Java port of [envdoctor](https://github.com/arun-skg/envdoctor) — a
local-first environment-variable consistency checker, built with Maven and
published to Maven Central as `io.github.arun-skg:envdoctor`.

## Install

Add the dependency (Maven Central):

```xml
<dependency>
  <groupId>io.github.arun-skg</groupId>
  <artifactId>envdoctor</artifactId>
  <version>0.1.0</version>
</dependency>
```

Or build the runnable CLI jar from a checkout:

```bash
cd java
mvn -B package
```

## Quick start

```bash
java -jar target/envdoctor-0.1.0.jar scan --dir .        # audit; exit 1 on errors
java -jar target/envdoctor-0.1.0.jar scan --strict       # treat warnings as errors too
```

## What it detects

Reconciles variables **used** in Java source (`System.getenv("X")`) against
those **defined** in `.env` files:

| Rule | Severity | Meaning |
|------|----------|---------|
| `undefined-in-source` | error | Used in code but not defined in any `.env` file |
| `unused` | warning | Defined in `.env` but never referenced in source |

Line (`//`) and block (`/* */`) comments are stripped before scanning. `scan`
exits `1` on errors (or warnings with `--strict`). Values are never printed.

> This port implements the core missing/unused reconciliation. The additional
> detectors (duplicates, type-mismatch, schema validation, public-prefix secret
> leaks, and more) currently live only in the
> [Node reference implementation](https://github.com/arun-skg/envdoctor).

## Development

```bash
cd java
mvn -B verify          # runs the JUnit 5 suite
# or, without Maven:
javac -d out src/main/java/com/envdoctor/*.java
java -cp out com.envdoctor.Cli scan --dir .
```

## Other languages

envdoctor ships as a standalone native port for each ecosystem:

- [Node (reference)](..) · [Python](../python) · [Go](../go) · [Ruby](../ruby) · [PHP](../php) · [Perl](../perl)
- 📖 Docs: [arun-skg.github.io/envdoctor](https://arun-skg.github.io/envdoctor/)
- Main repository: [github.com/arun-skg/envdoctor](https://github.com/arun-skg/envdoctor)
