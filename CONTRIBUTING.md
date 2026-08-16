# Contributing to envdoctor

Thanks for your interest in improving `envdoctor`! Issues and pull requests are
welcome.

## Getting started

```bash
git clone https://github.com/arun-skg/envdoctor.git
cd envdoctor
npm install
```

## Development workflow

```bash
npm test          # run the test suite (vitest)
npm run test:watch # watch mode
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # tsup → dist/

# Smoke-test the CLI against the bundled fixture
node dist/index.js scan --dir tests/fixtures/sample-project
```

Please make sure `npm test`, `npm run lint`, and `npm run typecheck` all pass
before opening a pull request. New behaviour should come with tests.

## Project layout

```
src/
  parsers/      one module per input format (dotenv, compose, k8s, actions, source)
  core/         discovery, model assembly, audit pipeline
  detectors/    one module per rule; each implements the Detector interface
  generators/   output artifacts (.env.example, ENVIRONMENT.md, env.d.ts, schema)
  commands/     CLI command implementations (init, scan, fix, diff, sync)
tests/          mirrors src/ with unit + integration tests and fixtures/
```

The architecture is deliberately layered: `parsers → model → detectors →
generators`. Each layer is independent, so most contributions touch only one.

### Adding a parser

Implement the `Parser` interface (`src/parsers/parser.ts`) and register it in
`src/parsers/registry.ts`. Parsers must never throw on malformed input.

### Adding a detector

Implement the `Detector` interface (`src/detectors/detector.ts`), export it, and
add it to `src/detectors/index.ts`. Use `makeFinding` for stable finding ids.
Give it a sensible default severity and make it configurable via the `rules`
config.

## Commit and PR conventions

- Keep commits focused and write a clear message describing the *why*.
- Reference any related issue in the PR description.
- Update `CHANGELOG.md` under a suitable heading when your change is
  user-visible.

## Releases

Maintainers publish via the GitHub Release workflow (`.github/workflows/release.yml`),
which uses npm OIDC trusted publishing. To cut a release: bump the version in
`package.json`, update `CHANGELOG.md`, then create a GitHub Release for the new
`vX.Y.Z` tag.

## Reporting security issues

Please do **not** file public issues for vulnerabilities — see
[SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
