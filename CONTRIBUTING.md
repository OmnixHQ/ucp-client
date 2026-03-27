# Contributing to @omnixhq/ucp-client

Thank you for your interest in contributing! This document explains how to get started.

## Getting Started

```bash
git clone https://github.com/OmnixHQ/ucp-client.git
cd ucp-client
npm install
npm run build
npm test
```

## Development Workflow

1. **Fork** the repository and create a feature branch
2. **Write tests first** — we follow TDD (Red → Green → Refactor)
3. **Implement** the minimal code to pass
4. **Run all checks** before submitting:

```bash
npm run typecheck    # TypeScript strict mode
npm run lint         # ESLint
npm run format:check # Prettier
npm run build        # tsdown (dual ESM + CJS)
npm run check:exports # attw (validates exports)
npm test             # vitest
```

## Code Style

- **Immutability** — all interfaces use `readonly`. Never mutate existing objects.
- **Small files** — 200-400 lines typical, 800 max.
- **No descriptive comments** — comments explain WHY, never WHAT.
- **No `as` casts at public boundaries** — use generic `validate<T>()`.
- **Conditional spread** for optional properties — never mutate via cast.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new capability
fix: handle edge case in error parsing
refactor: extract shared logic
test: add missing coverage
docs: update README
chore: update dependencies
```

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update CHANGELOG.md under `[Unreleased]`
- All CI checks must pass

## Contributor License Agreement (CLA)

By submitting a pull request, you agree that your contributions may be relicensed under the project's MIT license and any future commercial license. This ensures OmnixHQ can maintain both the open source project and any commercial offerings.

We use [CLA Assistant](https://cla-assistant.io/) — you'll be prompted to sign on your first PR.

## Reporting Issues

- **Bugs**: Use the [bug report template](https://github.com/OmnixHQ/ucp-client/issues/new?template=bug_report.yml)
- **Features**: Use the [feature request template](https://github.com/OmnixHQ/ucp-client/issues/new?template=feature_request.yml)
- **Security**: See [SECURITY.md](./SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
