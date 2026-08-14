/**
 * Fail-closed preflight rules for the dedicated Literature foundation rollout.
 *
 * Pure evaluation: these functions take facts and return checks. Gathering the facts (running git,
 * hashing the migration, reading evidence) happens in `../preflight.ts`. Splitting it this way
 * means every rule is unit-testable without a repository or a database.
 *
 * The controlling principle is that an unprovable fact is a failure. A check whose input is missing
 * fails; it never passes by default.
 *
 * The layering matters as much as the individual rules:
 *
 *   - `evaluateRepositoryPreflight` is **Layer 1** and authoritative — every fact is locally
 *     verifiable in this checkout.
 *   - `evaluateEvidenceContentPreflight` is **Layer 2** and explicitly *non-authoritative*. It
 *     validates the shape and internal consistency of catalog evidence and nothing more. It cannot
 *     establish which database produced that evidence, and its verdict is named so no caller can
 *     mistake it for permission to act.
 *   - Target identity is **Layer 3** and comes only from a provider attestation
 *     (`../../../src/features/literature/dedicated-supabase/attestation`).
 */

import {
  LITERATURE_ALL_MIGRATION_PATHS,
  LITERATURE_APPROVED_APPLICATION_MECHANISM,
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_DEFERRED_MIGRATIONS,
  LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS,
  LITERATURE_FOUNDATION_MIGRATION,
  evaluateLiteratureFoundationSelection,
} from '../../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  LITERATURE_COLLIDING_RELKINDS,
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../../src/features/literature/dedicated-supabase/catalog-expectations'
import type { LiteratureEvidenceDocument } from './evidence-schema'

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
  ownerApprovedCommit?: string
  /** SHA-256 of the migration file as read from this checkout. */
  migrationSha256: string
  migrationByteLength: number
  /** Repository-relative paths the operator intends to apply. */
  selectedMigrationPaths: readonly string[]
  /** The mechanism the operator intends to use. Required. */
  applicationMechanism?: string
}

function check(id: string, description: string, passed: boolean, detail: string): PreflightCheck {
  return { id, description, passed, detail }
}

/** Layer 1. Repository-side rules. None of these needs network access or a credential. */
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

  // H-4: exact equality in both directions. A descendant of the approved commit is a different
  // tree than the one that was reviewed, so any movement on main requires a new authorization.
  const commitsAgree =
    facts.headCommit.length === 40 &&
    facts.headCommit === facts.originMainCommit &&
    facts.ownerApprovedCommit === facts.headCommit
  checks.push(
    check(
      'P04-exact-approved-commit',
      'HEAD == origin/main == the owner-approved commit, exactly',
      commitsAgree,
      `head=${facts.headCommit} origin/main=${facts.originMainCommit} ` +
        `approved=${facts.ownerApprovedCommit ?? '(none supplied)'}`,
    ),
  )

  checks.push(
    check(
      'P05-migration-checksum',
      'the foundation migration matches the manifest SHA-256 and byte length',
      facts.migrationSha256 === LITERATURE_FOUNDATION_MIGRATION.sha256 &&
        facts.migrationByteLength === LITERATURE_FOUNDATION_MIGRATION.byteLength,
      `sha256=${facts.migrationSha256} bytes=${facts.migrationByteLength}`,
    ),
  )

  const selected = facts.selectedMigrationPaths
  checks.push(
    check(
      'P06-exactly-one-migration',
      'exactly one migration is selected',
      selected.length === 1,
      `selected=${selected.length} [${selected.join(', ')}]`,
    ),
  )
  checks.push(
    check(
      'P07-migration-path',
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
      'P08-no-deferred-literature-migration',
      'none of the nine deferred Literature migrations is selected',
      deferredSelected.length === 0,
      deferredSelected.join(', ') || 'none selected',
    ),
  )

  const unrelatedSelected = selected.filter(
    (path) => !LITERATURE_ALL_MIGRATION_PATHS.includes(path),
  )
  checks.push(
    check(
      'P09-no-unrelated-migration',
      'none of the twenty-three unrelated application migrations is selected',
      unrelatedSelected.length === 0,
      unrelatedSelected.join(', ') || 'none selected',
    ),
  )

  // H-5: mechanism is required and exact.
  checks.push(
    check(
      'P10-application-mechanism',
      'the application mechanism is exactly the approved connector operation',
      facts.applicationMechanism === LITERATURE_APPROVED_APPLICATION_MECHANISM,
      `declared=${facts.applicationMechanism ?? '(none)'} required=${LITERATURE_APPROVED_APPLICATION_MECHANISM}`,
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
    applicationMechanism: facts.applicationMechanism,
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

/**
 * Layer 2. Content-only validation of catalog evidence.
 *
 * **Non-authoritative.** These checks say "this evidence describes an empty, collision-free
 * schema"; they do not and cannot say "the approved project is empty". Callers must treat a full
 * pass here as audit evidence, never as permission.
 */
export function evaluateEvidenceContentPreflight(
  evidence: LiteratureEvidenceDocument | null,
): PreflightCheck[] {
  if (!evidence) {
    return [
      check(
        'E00-evidence-present',
        'a parsed evidence document was supplied',
        false,
        'no evidence document was supplied; content checks could not run',
      ),
    ]
  }

  const checks: PreflightCheck[] = []
  const catalog = evidence.catalog

  const history = evidence.migrationVersions
  checks.push(
    check(
      'E01-empty-migration-history',
      'the evidence records the expected starting migration history',
      history.length === LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS.length,
      `history=[${history.join(', ')}]`,
    ),
  )

  const relations = catalog.relations as { name?: unknown; relkind?: unknown }[]
  const literatureRelations = relations.filter(
    (relation) => typeof relation.name === 'string' && relation.name.startsWith('literature'),
  )
  checks.push(
    check(
      'E02-no-literature-relations',
      'the evidence shows no Literature relation of any kind',
      literatureRelations.length === 0,
      literatureRelations
        .map((relation) => `${String(relation.relkind)}:${String(relation.name)}`)
        .join(', ') || 'none present',
    ),
  )

  checks.push(
    check(
      'E03-no-literature-functions',
      'the evidence shows no Literature function',
      catalog.functions.length === 0,
      `functions=${catalog.functions.length}`,
    ),
  )
  checks.push(
    check(
      'E04-no-literature-triggers-or-indexes',
      'the evidence shows no Literature trigger or index',
      catalog.triggers.length === 0 && catalog.indexes.length === 0,
      `triggers=${catalog.triggers.length} indexes=${catalog.indexes.length}`,
    ),
  )

  // H-2: collision detection across every object class that can block or alter the migration,
  // not just tables. A view named public.literature_journals previously passed here and then
  // broke the apply.
  const expectedNames = new Set<string>([
    ...LITERATURE_FOUNDATION_TABLES,
    ...LITERATURE_FOUNDATION_INDEXES,
  ])
  const relationCollisions = relations
    .filter(
      (relation) =>
        typeof relation.name === 'string' &&
        expectedNames.has(relation.name) &&
        LITERATURE_COLLIDING_RELKINDS.some((entry) => entry.relkind === relation.relkind),
    )
    .map((relation) => {
      const label =
        LITERATURE_COLLIDING_RELKINDS.find((entry) => entry.relkind === relation.relkind)?.label ??
        String(relation.relkind)
      return `${label} ${String(relation.name)}`
    })

  const typeCollisions = (catalog.types as { name?: unknown }[])
    .filter((entry) => typeof entry.name === 'string' && expectedNames.has(entry.name))
    .map((entry) => `type ${String(entry.name)}`)

  const functionCollisions = (catalog.functions as { name?: unknown }[])
    .filter(
      (entry) =>
        typeof entry.name === 'string' && LITERATURE_FOUNDATION_FUNCTION_NAMES.includes(entry.name),
    )
    .map((entry) => `function ${String(entry.name)}`)

  const indexCollisions = (catalog.indexes as { name?: unknown }[])
    .filter((entry) => typeof entry.name === 'string' && expectedNames.has(entry.name))
    .map((entry) => `index ${String(entry.name)}`)

  const collisions = [
    ...relationCollisions,
    ...typeCollisions,
    ...functionCollisions,
    ...indexCollisions,
  ]
  checks.push(
    check(
      'E05-no-name-collision',
      'no object of any class shares a name with anything the migration creates',
      collisions.length === 0,
      collisions.join(', ') || 'no collisions',
    ),
  )

  const tableRelations = relations.filter((relation) => relation.relkind === 'r')
  const literatureTables = tableRelations.filter(
    (relation) => typeof relation.name === 'string' && relation.name.startsWith('literature'),
  )
  checks.push(
    check(
      'E06-no-partial-schema',
      'the evidence holds no partial Literature schema',
      literatureTables.length === 0 ||
        literatureTables.length === LITERATURE_FOUNDATION_TABLES.length,
      `literatureTables=${literatureTables.length}`,
    ),
  )

  const prerequisites = evidence.prerequisites
  checks.push(
    check(
      'E07-prerequisites-available',
      'pg_trgm is available and the anon, authenticated, and service_role roles exist',
      prerequisites.availableExtensions.includes('pg_trgm') &&
        ['anon', 'authenticated', 'service_role'].every((role) =>
          prerequisites.roles.includes(role),
        ) &&
        prerequisites.schemas.includes('extensions'),
      `extensions=[${prerequisites.availableExtensions.join(', ')}] ` +
        `roles=[${prerequisites.roles.join(', ')}] schemas=[${prerequisites.schemas.join(', ')}]`,
    ),
  )

  checks.push(
    check(
      'E08-row-count-present',
      'the evidence carries a non-negative integer total row count',
      Number.isInteger(evidence.totalRowCount) && evidence.totalRowCount >= 0,
      `totalRowCount=${evidence.totalRowCount}`,
    ),
  )

  return checks
}

export function allChecksPassed(checks: readonly PreflightCheck[]): boolean {
  return checks.length > 0 && checks.every((entry) => entry.passed)
}

/**
 * The overall preflight verdict.
 *
 * `ready_to_apply` is unreachable without a provider attestation, which this repository cannot
 * currently produce. The other two names are deliberately explicit that they do not authorize
 * anything.
 */
export type LiteraturePreflightVerdict =
  | 'blocked'
  | 'repository_checks_passed_nonauthoritative'
  | 'provider_attestation_required'
  | 'ready_to_apply'

export interface PreflightOutcome {
  verdict: LiteraturePreflightVerdict
  authoritative: boolean
  summary: string
}

/**
 * Combine the layers into a single outcome.
 *
 * Layer 1 and Layer 2 passing is *not* permission to act: without Layer 3, the most that can be
 * said is that this repository and this document are internally consistent.
 */
export function resolvePreflightOutcome(input: {
  repositoryChecks: readonly PreflightCheck[]
  evidenceChecks: readonly PreflightCheck[]
  attestationStatus: 'attested' | 'rejected'
  attestationDetail: string
}): PreflightOutcome {
  if (!allChecksPassed(input.repositoryChecks)) {
    return {
      verdict: 'blocked',
      authoritative: true,
      summary: 'Repository checks failed. No migration may be applied.',
    }
  }
  if (!allChecksPassed(input.evidenceChecks)) {
    return {
      verdict: 'blocked',
      authoritative: false,
      summary: 'Evidence content checks failed. No migration may be applied.',
    }
  }
  if (input.attestationStatus !== 'attested') {
    return {
      verdict: 'provider_attestation_required',
      authoritative: false,
      summary:
        'Repository and evidence-content checks passed, but they are NON-AUTHORITATIVE: they ' +
        'cannot establish which database produced the evidence. ' +
        input.attestationDetail,
    }
  }
  return {
    verdict: 'ready_to_apply',
    authoritative: true,
    summary: 'Repository, evidence, and provider-bound target attestation all passed.',
  }
}
