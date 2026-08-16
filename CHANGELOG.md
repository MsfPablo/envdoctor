# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-08-16

### Fixed

- `scan` no longer crashes with `EPERM`/`EACCES` when it encounters an unreadable directory (e.g. running from a home directory that contains `~/.Trash`). Unreadable paths are now skipped.
- Ignore common system directories (`.Trash`, `Library`, `.cache`, `.npm`) during discovery.

## [0.1.0] - 2026-08-16

### Added

- Initial release.
- `envdoctor init` to bootstrap config, `.env.example`, and `ENVIRONMENT.md`.
- `envdoctor scan` to audit environment variables across `.env`, Docker Compose, GitHub Actions, and source code.
- `envdoctor fix` to generate safe documentation and example files.
- `envdoctor diff` to compare variables between two environments.
- Detectors for missing, unused, undefined-in-source, duplicates, environment differences, and type mismatches.
