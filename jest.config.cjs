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

module.exports = config
