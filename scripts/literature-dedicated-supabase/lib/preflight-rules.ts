/**
 * Fail-closed preflight rules for the dedicated Literature foundation rollout.
 *
 * Pure evaluation: these functions take facts and return checks. Gathering the facts (running git,
 * hashing the migration, reading the operator's read-only observation) happens in `../preflight.ts`.
 * Splitting it this way means every rule is unit-testable without a repository or a database.
 *
 * The controlling principle is that an unprovable fact is a failure. A check whose input is missing
 * fails; it never passes by default.
 */

import {
  LITERATURE_ALL_MIGRATION_PATHS,
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_DEFERRED_MIGRATIONS,
  LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS,
  LITERATURE_FOUNDATION_MIGRATION,
  LITERATURE_PROHIBITED_TARGET_REFS,
  evaluateLiteratureFoundationSelection,
} from '../../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  LITERATURE_FOUNDATION_FUNCTIONS,
  LITERATURE_FOUNDATION_TABLES,
} from '../../../src/features/literature/dedicated-supabase/catalog-expectations'
import type { LiteratureTargetObservation } from './target-observation'

export interface PreflightCheck {
  id: string
  description: string
  passed: boolean
  detail: string
}

export interface RepositoryFacts {
  /** Absolute path of the checkout the rollout would run from. */
  checkoutPath: string
  /** True when the checkout is the primary checkout (not a linked worktree). */
  isPrimaryCheckout: boolean
  branch: string
  headCommit: string
  originMainCommit: string
  /** Tracked-file dirtiness. Any modification blocks the rollout. */
  workingTreeClean: boolean
  /** The commit the owner authorized, if one was supplied. */
  approvedCommit?: string
  /** True when HEAD is `approvedCommit` or a descendant of it. */
  headDescendsFromApprovedCommit?: boolean
  /** SHA-256 of the migration file as read from this checkout. */
  migrationSha256: string
  migrationByteLength: number
  /** Repository-relative paths the operator intends to apply. */
  selectedMigrationPaths: readonly string[]
  /** The mechanism the operator intends to use. */
  deploymentMethod?: string
}

function check(id: string, description: string, passed: boolean, detail: string): PreflightCheck {
  return { id, description, passed, detail }
}

/** Repository-side rules. None of these needs network access or a credential. */
export function evaluateRepositoryPreflight(facts: RepositoryFacts): PreflightCheck[] {
  const checks: PreflightCheck[] = []

  checks.push(
    check(
      'P01-primary-checkout',
      'the rollout runs from the primary checkout',
      facts.isPrimaryCheckout,
      `checkout=${facts.checkoutPath}`,
    ),
  )
  checks.push(
    check(
      'P02-main-branch',
      'the checkout is on main',
      facts.branch === 'main',
      `branch=${facts.branch}`,
    ),
  )
  checks.push(
    check(
      'P03-clean-worktree',
      'the working tree has no tracked modifications',
      facts.workingTreeClean,
      facts.workingTreeClean ? 'clean' : 'tracked files are modified',
    ),
  )
  checks.push(
    check(
      'P04-head-matches-origin-main',
      'HEAD equals origin/main',
      facts.headCommit === facts.originMainCommit && facts.headCommit.length === 40,
      `head=${facts.headCommit} origin/main=${facts.originMainCommit}`,
    ),
  )
  checks.push(
    check(
      'P05-approved-commit',
      'HEAD is the owner-approved commit or an explicitly approved descendant',
      Boolean(facts.approvedCommit) && facts.headDescendsFromApprovedCommit === true,
      facts.approvedCommit
        ? `approved=${facts.approvedCommit} descends=${String(facts.headDescendsFromApprovedCommit)}`
        : 'no approved commit was supplied',
    ),
  )

  checks.push(
    check(
      'P06-migration-checksum',
      'the foundation migration matches the manifest SHA-256 and byte length',
      facts.migrationSha256 === LITERATURE_FOUNDATION_MIGRATION.sha256 &&
        facts.migrationByteLength === LITERATURE_FOUNDATION_MIGRATION.byteLength,
      `sha256=${facts.migrationSha256} bytes=${facts.migrationByteLength}`,
    ),
  )

  const selected = facts.selectedMigrationPaths
  checks.push(
    check(
      'P07-exactly-one-migration',
      'exactly one migration is selected',
      selected.length === 1,
      `selected=${selected.length} [${selected.join(', ')}]`,
    ),
  )
  checks.push(
    check(
      'P08-migration-path',
      'the selected migration is the approved foundation path',
      selected.length === 1 && selected[0] === LITERATURE_FOUNDATION_MIGRATION.path,
      `selected=[${selected.join(', ')}]`,
    ),
  )

  const deferredSelected = selected.filter((path) =>
    LITERATURE_DEFERRED_MIGRATIONS.some((entry) => entry.path === path),
  )
  checks.push(
    check(
      'P09-no-deferred-literature-migration',
      'no deferred Literature migration is selected',
      deferredSelected.length === 0,
      deferredSelected.join(', ') || 'none selected',
    ),
  )

  const unrelatedSelected = selected.filter(
    (path) => !LITERATURE_ALL_MIGRATION_PATHS.includes(path),
  )
  checks.push(
    check(
      'P10-no-unrelated-migration',
      'no unrelated application migration is selected',
      unrelatedSelected.length === 0,
      unrelatedSelected.join(', ') || 'none selected',
    ),
  )

  const verdict = evaluateLiteratureFoundationSelection({
    migrationPaths: selected,
    migrationSha256ByPath: { [LITERATURE_FOUNDATION_MIGRATION.path]: facts.migrationSha256 },
    migrationByteLengthByPath: {
      [LITERATURE_FOUNDATION_MIGRATION.path]: facts.migrationByteLength,
    },
    targetProjectRef: LITERATURE_DEDICATED_TARGET.projectRef,
    appliedMigrationVersions: [],
    deploymentMethod: facts.deploymentMethod,
  })
  checks.push(
    check(
      'P11-manifest-approves-selection',
      'the target-bound manifest approves the selection and mechanism',
      verdict.approved,
      verdict.rejections.map((entry) => `${entry.reason}: ${entry.detail}`).join('; ') ||
        'approved',
    ),
  )

  return checks
}

/** Target-side rules, evaluated against the operator's read-only observation. */
export function evaluateTargetPreflight(
  observation: LiteratureTargetObservation | null,
): PreflightCheck[] {
  const checks: PreflightCheck[] = []

  if (!observation) {
    return [
      check(
        'T00-observation-present',
        'a read-only target observation was supplied',
        false,
        'no observation document was supplied; target state cannot be proven',
      ),
    ]
  }

  checks.push(
    check(
      'T01-target-ref-approved',
      'the inspected project is the approved dedicated Literature project',
      observation.projectRef === LITERATURE_DEDICATED_TARGET.projectRef,
      `observed=${observation.projectRef} approved=${LITERATURE_DEDICATED_TARGET.projectRef}`,
    ),
  )
  checks.push(
    check(
      'T02-target-ref-not-prohibited',
      'the inspected project is not the main application project',
      !LITERATURE_PROHIBITED_TARGET_REFS.includes(observation.projectRef),
      `observed=${observation.projectRef}`,
    ),
  )

  const hostname = observation.hostname?.trim().toLowerCase() ?? ''
  const loopback =
    ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(hostname) ||
    hostname.endsWith('.localhost')
  checks.push(
    check(
      'T03-not-loopback-or-preview',
      'the target is a hosted production project, not loopback, local, or a preview branch',
      hostname.length > 0 && !loopback && !hostname.includes('branch'),
      `hostname=${hostname || '(not recorded)'}`,
    ),
  )

  const history = observation.migrationVersions ?? []
  checks.push(
    check(
      'T04-empty-migration-history',
      'the target records the expected starting migration history',
      history.length === LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS.length &&
        history.every((version) =>
          LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS.includes(version),
        ),
      `history=[${history.join(', ')}]`,
    ),
  )
  checks.push(
    check(
      'T05-foundation-not-already-applied',
      'the foundation migration is not already recorded',
      !history.includes(LITERATURE_FOUNDATION_MIGRATION.version),
      `history=[${history.join(', ')}]`,
    ),
  )

  const catalog = observation.catalog
  const presentTables = catalog.tables?.map((table) => table.name) ?? []
  const presentFunctions = catalog.functions?.map((entry) => entry.name) ?? []
  const presentIndexes = catalog.indexes ?? []
  const presentTriggers = catalog.triggers ?? []

  checks.push(
    check(
      'T06-no-foundation-objects',
      'no Literature table, function, trigger, or index exists on the target',
      presentTables.length === 0 &&
        presentFunctions.length === 0 &&
        presentIndexes.length === 0 &&
        presentTriggers.length === 0,
      `tables=${presentTables.length} functions=${presentFunctions.length} ` +
        `triggers=${presentTriggers.length} indexes=${presentIndexes.length}`,
    ),
  )

  const collidingTables = presentTables.filter((name) =>
    LITERATURE_FOUNDATION_TABLES.includes(name),
  )
  const collidingFunctions = presentFunctions.filter((name) =>
    LITERATURE_FOUNDATION_FUNCTIONS.some((entry) => entry.name === name),
  )
  checks.push(
    check(
      'T07-no-name-collision',
      'no object shares a name with anything the foundation migration creates',
      collidingTables.length === 0 && collidingFunctions.length === 0,
      [...collidingTables, ...collidingFunctions].join(', ') || 'no collisions',
    ),
  )

  checks.push(
    check(
      'T08-no-partial-schema',
      'the target holds no partial Literature schema',
      presentTables.length === 0 || presentTables.length === LITERATURE_FOUNDATION_TABLES.length,
      `tables=${presentTables.length}`,
    ),
  )

  const prerequisites = observation.prerequisites
  checks.push(
    check(
      'T09-prerequisites-available',
      'pg_trgm is available and the anon, authenticated, and service_role roles exist',
      Boolean(prerequisites) &&
        prerequisites!.availableExtensions.includes('pg_trgm') &&
        ['anon', 'authenticated', 'service_role'].every((role) =>
          prerequisites!.roles.includes(role),
        ) &&
        prerequisites!.schemas.includes('extensions'),
      prerequisites
        ? `extensions=[${prerequisites.availableExtensions.join(', ')}] ` +
            `roles=[${prerequisites.roles.join(', ')}] schemas=[${prerequisites.schemas.join(', ')}]`
        : 'prerequisite observation was not supplied',
    ),
  )

  return checks
}

export function preflightApproved(checks: readonly PreflightCheck[]): boolean {
  return checks.length > 0 && checks.every((entry) => entry.passed)
}
