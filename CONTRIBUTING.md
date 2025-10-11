# Contributing

Thank you for investing time in the Interventional Pulmonology Collaborative project. Contributions are welcomed from clinicians, engineers, designers, and educators. The project is structured around clearly defined milestones—please align your contribution with an open milestone issue or propose a new scope before submitting major changes.

## Project Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create an environment file:
   ```bash
   cp .env.example .env.local
   ```
3. Run quality gates locally:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   ```

## Branching & Commits

- Use descriptive branches (e.g. `feat/m2-navigation`).
- Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Commitlint enforces message formatting.
- Keep pull requests focused on a single milestone or issue to streamline reviews.

## Pull Request Checklist

- [ ] Tests updated or added where relevant.
- [ ] Tailwind classes deduplicated via `cn` helper or `tailwind-merge`.
- [ ] Accessibility and security considerations documented.
- [ ] Screenshots or recordings for UI-facing changes.

## Code Style

- TypeScript operates in strict mode; prefer explicit types.
- Use the shared `cn` helper for composing class names.
- Prefer composition over inheritance; colocate styles via Tailwind utilities.

## Reporting Issues

Open a GitHub issue with:

- Summary of the problem or feature request.
- Steps to reproduce (if bug).
- Expected vs. actual behaviour.
- Screenshots, logs, or stack traces when available.

## Code of Conduct

Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). Please report violations confidentially to the maintainers via security@interventionalpulm.org.
