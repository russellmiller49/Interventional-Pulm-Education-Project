/**
 * Target-bound migration-selection contract for the dedicated Literature Supabase project.
 *
 * `supabase/migrations/` is a mixed directory: thirty-three migrations covering the Literature
 * module, the Literature gold-set review workflow, and unrelated application features. A directory
 * scoped deployment (`supabase db push`) would therefore apply all of them to whatever project the
 * CLI happens to be linked to. That is unacceptable for a brand-new dedicated project whose entire
 * approved scope is a single foundation migration.
 *
 * This module makes the selection explicit and machine-verifiable: exactly one migration, bound by
 * path and SHA-256, against exactly one project ref, from a repository commit that has been
 * reviewed. Everything else — extra migrations, altered contents, the main application project,
 * loopback targets, bulk deployment mechanisms — is rejected by name.
 *
 * Nothing here executes anything. It is a description of what a later, separately authorized
 * rollout is permitted to do.
 */

import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
} from '../server/dedicated-project-contract'

export const LITERATURE_FOUNDATION_MANIFEST_SCHEMA_VERSION = 'literature-dedicated-bootstrap-v1'

/** The dedicated Supabase project this manifest is bound to. */
export const LITERATURE_DEDICATED_TARGET = {
  projectName: 'IP_Literature',
  projectRef: LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  region: 'us-west-1',
  /** Verified read-only on 2026-08-13; the migration is written against PostgreSQL 17. */
  postgresMajorVersion: 17,
} as const

/**
 * Project refs a rollout may never target. The main application project holds authentication and
 * site-admin identity and must never receive the Literature schema or corpus.
 */
export const LITERATURE_PROHIBITED_TARGET_REFS: readonly string[] = [
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
]

/**
 * The single approved migration. The SHA-256 is over the exact bytes of the file at the approved
 * commit; a one-byte change invalidates the manifest and the preflight refuses to proceed.
 */
export const LITERATURE_FOUNDATION_MIGRATION = {
  path: 'supabase/migrations/20260727032621_add_literature_explorer.sql',
  version: '20260727032621',
  name: 'add_literature_explorer',
  sha256: 'c737865cdde3572ed0c0c59c134530bbd7e86e2013d97e0b9edc06c27aa426da',
  byteLength: 37669,
} as const

/** Exactly one migration may be selected. Zero and two are both contract violations. */
export const LITERATURE_FOUNDATION_SELECTED_MIGRATION_COUNT = 1

/**
 * The migration history the target must present *before* the rollout. A brand-new Supabase project
 * has none; anything else means the project is not the empty target this manifest describes.
 */
export const LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS: readonly string[] = []

/** The migration history the target must present *after* a correct rollout. */
export const LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_VERSIONS: readonly string[] = [
  LITERATURE_FOUNDATION_MIGRATION.version,
]

/** Total migrations present in the mixed `supabase/migrations/` directory at the approved commit. */
export const LITERATURE_REPOSITORY_MIGRATION_TOTAL = 33

/**
 * Literature migrations that exist in the repository but are deliberately **not** part of this
 * rollout. They implement the gold-set review workflow and the import/compensation contracts, none
 * of which is authorized here. They are listed so a preflight can prove none of them was selected,
 * and so an operator cannot quietly widen the scope by adding one.
 *
 * Three of these do not carry `literature` in the filename and are easy to miss: the
 * `20260728…` trio are pure `DO` blocks that read `save_literature_gold_review_v1` via
 * `pg_get_functiondef` and `raise exception` when it is absent. They are hard-ordered Literature
 * migrations despite their names, which is why this list is bound by inspection of the SQL rather
 * than by a filename pattern.
 */
export const LITERATURE_DEFERRED_MIGRATIONS: readonly {
  path: string
  classification: string
}[] = [
  {
    path: 'supabase/migrations/20260727164510_add_literature_gold_set.sql',
    classification: 'review-workflow',
  },
  {
    path: 'supabase/migrations/20260727190000_add_literature_gold_review_categories.sql',
    classification: 'review-workflow',
  },
  {
    path: 'supabase/migrations/20260727193432_add_literature_full_text_categorization_flag.sql',
    classification: 'review-workflow',
  },
  {
    path: 'supabase/migrations/20260728170939_add_interactive_clinical_case_publication_status.sql',
    classification: 'review-workflow-vocabulary',
  },
  {
    path: 'supabase/migrations/20260728171212_add_immune_inflammatory_disease_tag.sql',
    classification: 'review-workflow-vocabulary',
  },
  {
    path: 'supabase/migrations/20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
    classification: 'review-workflow-vocabulary',
  },
  {
    path: 'supabase/migrations/20260730194025_add_literature_gold_test_unlock.sql',
    classification: 'review-workflow',
  },
  {
    path: 'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
    classification: 'import-contract-v1',
  },
  {
    path: 'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    classification: 'import-contract-v2',
  },
]

/**
 * Every Literature migration in the repository: the one foundation migration plus the nine
 * deferred ones. A preflight uses this to prove the selection is the foundation and nothing else.
 */
export const LITERATURE_ALL_MIGRATION_PATHS: readonly string[] = [
  LITERATURE_FOUNDATION_MIGRATION.path,
  ...LITERATURE_DEFERRED_MIGRATIONS.map((entry) => entry.path),
]

/**
 * Deployment mechanisms that must never be used for this rollout, with the reason each is refused.
 * `supabase db push` and `supabase migration repair` are the two that would silently exceed the
 * approved scope.
 */
export const LITERATURE_PROHIBITED_DEPLOYMENT_METHODS: readonly {
  method: string
  reason: string
}[] = [
  {
    method: 'supabase db push',
    reason:
      'Directory-scoped: applies every migration in supabase/migrations/, including six deferred ' +
      'Literature migrations and twenty-six unrelated application migrations.',
  },
  {
    method: 'supabase migration repair',
    reason: 'Rewrites migration history without applying SQL, destroying the audit trail.',
  },
  {
    method: 'supabase db reset',
    reason: 'Destructive against a remote project.',
  },
  {
    method: 'supabase branch / GitHub integration',
    reason:
      'Automatic deployment would push the whole mixed directory on every merge. The dedicated ' +
      'project is intentionally not connected to GitHub.',
  },
  {
    method: 'ad-hoc SQL pasted into the dashboard',
    reason: 'Unchecksummed and unreviewable; no receipt binds it to the approved migration.',
  },
]

export type LiteratureSelectionRejectionReason =
  | 'no_migration_selected'
  | 'multiple_migrations_selected'
  | 'migration_path_not_approved'
  | 'migration_checksum_mismatch'
  | 'migration_byte_length_mismatch'
  | 'target_ref_missing'
  | 'target_ref_prohibited'
  | 'target_ref_not_approved'
  | 'target_is_loopback'
  | 'deployment_method_prohibited'
  | 'pre_application_history_not_empty'

export interface LiteratureSelectionCandidate {
  /** Repository-relative paths the operator intends to apply. */
  migrationPaths: readonly string[]
  /** SHA-256 of the bytes actually read from disk, keyed by path. */
  migrationSha256ByPath: Readonly<Record<string, string>>
  /** Byte length actually read from disk, keyed by path. */
  migrationByteLengthByPath?: Readonly<Record<string, number>>
  /** Project ref the operator intends to target. */
  targetProjectRef?: string
  /** Hostname of the target, when known, so loopback can be refused. */
  targetHostname?: string
  /** Migration versions already recorded on the target. */
  appliedMigrationVersions?: readonly string[]
  /** The mechanism the operator intends to use. */
  deploymentMethod?: string
}

export interface LiteratureSelectionVerdict {
  approved: boolean
  rejections: readonly { reason: LiteratureSelectionRejectionReason; detail: string }[]
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

/**
 * Evaluate an intended rollout against the manifest. Fail-closed: every violation is reported, and
 * `approved` is true only when the candidate is exactly one unaltered foundation migration against
 * the approved empty target through an approved mechanism.
 */
export function evaluateLiteratureFoundationSelection(
  candidate: LiteratureSelectionCandidate,
): LiteratureSelectionVerdict {
  const rejections: { reason: LiteratureSelectionRejectionReason; detail: string }[] = []
  const reject = (reason: LiteratureSelectionRejectionReason, detail: string) => {
    rejections.push({ reason, detail })
  }

  const paths = candidate.migrationPaths
  if (paths.length === 0) {
    reject('no_migration_selected', 'The rollout selected zero migrations.')
  } else if (paths.length > LITERATURE_FOUNDATION_SELECTED_MIGRATION_COUNT) {
    reject(
      'multiple_migrations_selected',
      `The rollout selected ${paths.length} migrations; exactly ` +
        `${LITERATURE_FOUNDATION_SELECTED_MIGRATION_COUNT} is permitted.`,
    )
  }

  for (const path of paths) {
    if (path !== LITERATURE_FOUNDATION_MIGRATION.path) {
      reject(
        'migration_path_not_approved',
        `${path} is not the approved foundation migration ` +
          `(${LITERATURE_FOUNDATION_MIGRATION.path}).`,
      )
      continue
    }

    const sha256 = candidate.migrationSha256ByPath[path]
    if (sha256 !== LITERATURE_FOUNDATION_MIGRATION.sha256) {
      reject(
        'migration_checksum_mismatch',
        `${path} hashes to ${sha256 ?? '(absent)'} but the manifest binds ` +
          `${LITERATURE_FOUNDATION_MIGRATION.sha256}.`,
      )
    }

    const byteLength = candidate.migrationByteLengthByPath?.[path]
    if (byteLength !== undefined && byteLength !== LITERATURE_FOUNDATION_MIGRATION.byteLength) {
      reject(
        'migration_byte_length_mismatch',
        `${path} is ${byteLength} bytes but the manifest binds ` +
          `${LITERATURE_FOUNDATION_MIGRATION.byteLength}.`,
      )
    }
  }

  const targetRef = candidate.targetProjectRef?.trim()
  if (!targetRef) {
    reject('target_ref_missing', 'No target project ref was supplied.')
  } else if (LITERATURE_PROHIBITED_TARGET_REFS.includes(targetRef)) {
    reject(
      'target_ref_prohibited',
      `${targetRef} is the main application project and may never receive Literature migrations.`,
    )
  } else if (targetRef !== LITERATURE_DEDICATED_TARGET.projectRef) {
    reject(
      'target_ref_not_approved',
      `${targetRef} is not the approved dedicated target ` +
        `(${LITERATURE_DEDICATED_TARGET.projectRef}).`,
    )
  }

  const hostname = candidate.targetHostname?.trim().toLowerCase()
  if (hostname && (LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost'))) {
    reject('target_is_loopback', `${hostname} is a local target presented as production.`)
  }

  const applied = candidate.appliedMigrationVersions
  if (applied !== undefined && applied.length !== 0) {
    reject(
      'pre_application_history_not_empty',
      `The target already records migration(s) ${applied.join(', ')}; the manifest expects an ` +
        'empty migration history.',
    )
  }

  const method = candidate.deploymentMethod?.trim()
  if (method) {
    const prohibited = LITERATURE_PROHIBITED_DEPLOYMENT_METHODS.find(
      (entry) => entry.method.toLowerCase() === method.toLowerCase(),
    )
    if (prohibited) {
      reject('deployment_method_prohibited', `${prohibited.method}: ${prohibited.reason}`)
    }
  }

  return { approved: rejections.length === 0, rejections }
}
