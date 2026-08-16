# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-08-16

### Added

- Initial release.
- `envdoctor init` to bootstrap config, `.env.example`, and `ENVIRONMENT.md`.
- `envdoctor scan` to audit environment variables across `.env`, Docker Compose, GitHub Actions, and source code.
- `envdoctor fix` to generate safe documentation and example files.
- `envdoctor diff` to compare variables between two environments.
- Detectors for missing, unused, undefined-in-source, duplicates, environment differences, and type mismatches.
