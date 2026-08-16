# Contributing to envdoctor

Thanks for your interest in contributing!

## Development setup

```bash
cd envdoctor
npm install
```

## Checks before submitting

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Workflow

1. Fork the repository and create a feature branch.
2. Make your change, adding or updating tests in `tests/`.
3. Run all checks above.
4. Open a pull request with a clear description and reproduction steps.

## Publishing

Only maintainers publish releases. Create a GitHub Release to trigger the `release.yml` workflow, which publishes the package to npm with provenance.
