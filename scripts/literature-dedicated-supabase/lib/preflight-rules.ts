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
 *   - `evaluateRepositoryPreflight` is **Layer 1** — every fact is locally verifiable in this
 *     checkout. It can block, but it cannot authorize a production application.
 *   - `evaluateEvidenceContentPreflight` is **Layer 2** and explicitly *non-authoritative*. It
 *     validates the shape and internal consistency of catalog evidence and nothing more. It cannot
 *     establish which database produced that evidence.
 *   - Target identity is **Layer 3** and would come only from a provider-bound adapter, which is
 *     **not implemented in this PR**. `resolvePreflightOutcome` therefore has exactly two
 *     reachable verdicts — `blocked` and `provider_attestation_required` — and no input of any
 *     shape (attestation status strings, forged objects, casts, deserialized fixtures) can move it
 *     past them. The success verdict does not exist in the union.
 */

import {
  LITERATURE_ALL_MIGRATION_PATHS,
  LITERATURE_APPROVED_APPLICATION_MECHANISM,
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_DEFERRED_MIGRATIONS,
  LITERATURE_FOUNDATION_MIGRATION,
  evaluateLiteratureFoundationSelection,
} from '../../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  LITERATURE_COLLIDING_RELKINDS,
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../../src/features/literature/dedicated-supabase/catalog-expectations'
import { evaluateManagedPrerequisiteState } from './foundation-catalog'
import type { LiteratureCatalogSnapshot } from './foundation-catalog'
import { LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256 } from './target-observation'
import type { LiteraturePreflightEvidenceDocument } from './evidence-schema'

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
  /**
   * The mechanism the operator intends to use. Required, and deliberately `unknown` (H-5): the
   * value arrives from a CLI flag or deserialized input, so the rules must be total over every
   * runtime shape without throwing.
   */
  applicationMechanism?: unknown
}

function check(id: string, description: string, passed: boolean, detail: string): PreflightCheck {
  return { id, description, passed, detail }
}

function describeMechanism(mechanism: unknown): string {
  if (typeof mechanism === 'string') return mechanism === '' ? '(empty string)' : mechanism
  if (mechanism === undefined) return '(none)'
  if (mechanism === null) return '(null)'
  if (Array.isArray(mechanism)) return '(array)'
  return `(${typeof mechanism})`
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

  // H-5: mechanism is required, exact, and judged without any string operation on a non-string.
  checks.push(
    check(
      'P10-application-mechanism',
      'the application mechanism is exactly the approved connector operation',
      facts.applicationMechanism === LITERATURE_APPROVED_APPLICATION_MECHANISM,
      `declared=${describeMechanism(facts.applicationMechanism)} ` +
        `required=${LITERATURE_APPROVED_APPLICATION_MECHANISM}`,
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
 * Layer 2. Content-only validation of preflight catalog evidence.
 *
 * **Non-authoritative.** These checks say "this evidence describes an empty, collision-free
 * schema"; they do not and cannot say "the approved project is empty". A full pass here is audit
 * evidence, never permission — the outcome resolver structurally cannot say otherwise.
 */
export function evaluateEvidenceContentPreflight(
  evidence: LiteraturePreflightEvidenceDocument | null,
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

  // L-1: emptiness is expressed existence-safely. Either the history table does not exist at all
  // (a brand-new project) or it exists and records nothing.
  const history = evidence.migrationHistory
  checks.push(
    check(
      'E01-empty-migration-history',
      'the migration-history table is absent, or present and empty',
      !history.tableExists || (history.versions !== null && history.versions.length === 0),
      history.tableExists
        ? `tableExists=true versions=[${(history.versions ?? []).join(', ')}]`
        : 'tableExists=false (absence is the expected brand-new-project answer)',
    ),
  )

  const relations = catalog.relations
  const literatureRelations = relations.filter((relation) => relation.name.startsWith('literature'))
  checks.push(
    check(
      'E02-no-literature-relations',
      'the evidence shows no Literature relation of any kind',
      literatureRelations.length === 0,
      literatureRelations.map((relation) => `${relation.relkind}:${relation.name}`).join(', ') ||
        'none present',
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
        expectedNames.has(relation.name) &&
        LITERATURE_COLLIDING_RELKINDS.some((entry) => entry.relkind === relation.relkind),
    )
    .map((relation) => {
      const label =
        LITERATURE_COLLIDING_RELKINDS.find((entry) => entry.relkind === relation.relkind)?.label ??
        relation.relkind
      return `${label} ${relation.name}`
    })

  const typeCollisions = catalog.types
    .filter((entry) => expectedNames.has(entry.name))
    .map((entry) => `type ${entry.name}`)

  const functionCollisions = catalog.functions
    .filter((entry) => LITERATURE_FOUNDATION_FUNCTION_NAMES.includes(entry.name))
    .map((entry) => `function ${entry.name}`)

  // H-2: index names are observed independently of their owning table, so an index named
  // literature_articles_search_vector_idx on an *unrelated* table is a collision here even though
  // no Literature table exists yet. Relation names in pg_class share one namespace; the migration
  // would fail with "relation already exists".
  const indexNameCollisions = catalog.indexNames
    .filter((entry) => expectedNames.has(entry.name))
    .map((entry) => `index ${entry.schema}.${entry.name} (owning table irrelevant)`)

  const scopedIndexCollisions = catalog.indexes
    .filter((entry) => expectedNames.has(entry.name))
    .map((entry) => `index ${entry.name}`)

  const collisions = [
    ...relationCollisions,
    ...typeCollisions,
    ...functionCollisions,
    ...indexNameCollisions,
    ...scopedIndexCollisions,
  ]
  checks.push(
    check(
      'E05-no-name-collision',
      'no object of any class — including indexes on unrelated tables — shares a name with ' +
        'anything the migration creates',
      collisions.length === 0,
      collisions.join(', ') || 'no collisions',
    ),
  )

  const tableRelations = relations.filter((relation) => relation.relkind === 'r')
  const literatureTables = tableRelations.filter((relation) =>
    relation.name.startsWith('literature'),
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

  // H-1/H-2: scoped managed prerequisite semantics, including the pg_trgm three-way distinction —
  // absent is permitted, installed in `extensions` is permitted, installed anywhere else is
  // rejected because CREATE EXTENSION IF NOT EXISTS would not relocate it.
  for (const prerequisite of evaluateManagedPrerequisiteState(
    catalog as unknown as LiteratureCatalogSnapshot,
    'pre_application',
  )) {
    checks.push(
      check(
        `E08-${prerequisite.id}`,
        prerequisite.description,
        prerequisite.passed,
        prerequisite.detail,
      ),
    )
  }

  // L-1: the evidence must have been produced by exactly the preflight plan. A postflight (or any
  // other) capture cannot be substituted, however similar its content looks.
  checks.push(
    check(
      'E09-preflight-plan-identity',
      'the evidence binds the identity of the preflight query plan, not any other plan',
      evidence.queryPlanSha256 === LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
      `evidence=${evidence.queryPlanSha256} expected=${LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256}`,
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
 * There is no success member. `ready_to_apply` (and every equivalent) was removed from this union
 * entirely: while the provider-bound Layer-3 adapter is unimplemented, the strongest statement
 * this repository can make is that its own checks passed *non-authoritatively* and that provider
 * attestation is still required. The future adapter PR — separately reviewed — will be the first
 * change allowed to introduce a success verdict.
 */
export type LiteraturePreflightVerdict = 'blocked' | 'provider_attestation_required'

/**
 * Names for what each non-authoritative layer established. Deliberately verbose, so no log line
 * or transcript can read them as permission to act.
 */
export type LiteraturePreflightLayerSummary =
  | 'repository_checks_failed'
  | 'repository_checks_passed_nonauthoritative'
  | 'content_checks_failed'
  | 'content_checks_passed_nonauthoritative'

export interface PreflightOutcome {
  verdict: LiteraturePreflightVerdict
  layerSummaries: readonly LiteraturePreflightLayerSummary[]
  summary: string
}

/**
 * Combine the layers into a single outcome.
 *
 * Layer 1 and Layer 2 passing is *not* permission to act. This function accepts no attestation
 * status, no attestation object, and no third layer of any kind — with Layer 3 absent there is
 * nothing an operator could supply that would change the reachable verdicts, and the verdict type
 * itself cannot express success.
 */
export function resolvePreflightOutcome(input: {
  repositoryChecks: readonly PreflightCheck[]
  evidenceChecks: readonly PreflightCheck[]
}): PreflightOutcome {
  const repositoryPassed = allChecksPassed(input.repositoryChecks)
  const evidencePassed = allChecksPassed(input.evidenceChecks)
  const layerSummaries: LiteraturePreflightLayerSummary[] = [
    repositoryPassed ? 'repository_checks_passed_nonauthoritative' : 'repository_checks_failed',
    evidencePassed ? 'content_checks_passed_nonauthoritative' : 'content_checks_failed',
  ]

  if (!repositoryPassed) {
    return {
      verdict: 'blocked',
      layerSummaries,
      summary: 'Repository checks failed. No migration may be applied.',
    }
  }
  if (!evidencePassed) {
    return {
      verdict: 'blocked',
      layerSummaries,
      summary: 'Evidence content checks failed. No migration may be applied.',
    }
  }
  return {
    verdict: 'provider_attestation_required',
    layerSummaries,
    summary:
      'Repository and evidence-content checks passed, but they are NON-AUTHORITATIVE: they ' +
      'cannot establish which database produced the evidence. The provider-bound Layer-3 adapter ' +
      'is not implemented in this repository, so no migration may be applied under any input.',
  }
}
