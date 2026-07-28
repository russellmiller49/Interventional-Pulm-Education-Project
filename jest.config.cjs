const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

/** @type {import('jest').Config} */
const config = createJestConfig({
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // `.claude/worktrees/` holds full nested checkouts of this repo. Without ignoring it, a run from
  // the main checkout collects every suite twice — once here and once inside each worktree — which
  // roughly doubles the suite count and fails the handful of tests that assert on repo paths.
  modulePathIgnorePatterns: [
    '<rootDir>/.deploy_push/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '<rootDir>/.claude/worktrees/',
  ],
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.claude/worktrees/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
})

/**
 * `next/jest` sets its own `transformIgnorePatterns` and overwrites whatever is passed in,
 * so the override has to happen after it resolves.
 *
 * `use-intl` ships ESM only. jest.setup.ts mocks next-intl with naive placeholder
 * substitution, so tests that need the real ICU formatter — the one that actually throws on
 * a malformed plural instead of quietly echoing the source string — import use-intl directly
 * and need it transformed.
 */
module.exports = async () => {
  const resolved = await config()
  return {
    ...resolved,
    transformIgnorePatterns: [
      // use-intl and the @formatjs packages it pulls in are all ESM-only.
      '/node_modules/(?!use-intl|@formatjs|intl-messageformat)',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  }
}
