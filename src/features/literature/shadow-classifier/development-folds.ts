import { z } from 'zod'

import { immutableShadowValue, sha256ShadowValue } from './canonical'
import {
  assertDevelopmentArticleAuthorized,
  assertAuthorizedDevelopmentShadowScope,
  developmentShadowScopeDescriptor,
  type AuthorizedDevelopmentShadowScope,
} from './held-out-guard'
import {
  assertAuthorizedShadowDevelopmentTruth,
  type AuthorizedShadowDevelopmentTruth,
} from './development-truth-authority'

export const SHADOW_DEVELOPMENT_FOLD_SCHEMA_VERSION =
  'literature-shadow-development-folds/1.0.0' as const

const pmidSchema = z.string().regex(/^[0-9]{1,12}$/u)
const relevanceSchema = z.enum(['include_core', 'include_adjacent', 'exclude', 'uncertain'])
const metadataSufficiencySchema = z.enum([
  'adequate_abstract',
  'limited_abstract',
  'no_abstract',
  'conflicting_metadata',
])

export interface ShadowDevelopmentFoldRow {
  pmid: string
  relevanceLabel: z.infer<typeof relevanceSchema>
  metadataSufficiency?: z.infer<typeof metadataSufficiencySchema>
}

export interface ShadowDevelopmentFoldAssignment {
  pmid: string
  repeatIndex: number
  validationFoldIndex: number
  stratum: string
}

export interface ShadowDevelopmentFoldManifest {
  schemaVersion: typeof SHADOW_DEVELOPMENT_FOLD_SCHEMA_VERSION
  developmentOnly: true
  heldOutValidation: false
  warning: 'Internal development folds are not held-out validation.'
  seed: string
  repeats: number
  folds: number
  stratification: 'relevance_label' | 'relevance_label_and_metadata_sufficiency'
  authorityClass: 'real_development_membership' | 'synthetic_fixture'
  developmentMembershipSha256: string
  cohortSize: number
  cohortSha256: string
  truthAuthority: 'pinned_961c19f4_truth' | 'synthetic_fixture_rows'
  truthArtifactSha256: string | null
  assignments: readonly ShadowDevelopmentFoldAssignment[]
  manifestSha256: string
}

function numericPmidOrder(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length
  return left.localeCompare(right)
}

function validateRows(rows: readonly ShadowDevelopmentFoldRow[]): ShadowDevelopmentFoldRow[] {
  const parsed = rows.map((row, index) => {
    const result = z
      .object({
        pmid: pmidSchema,
        relevanceLabel: relevanceSchema,
        metadataSufficiency: metadataSufficiencySchema.optional(),
      })
      .strict()
      .safeParse(row)
    if (!result.success) {
      throw new Error(
        `Development fold row ${index + 1} is invalid: ${result.error.issues
          .map((issue) => `${issue.path.join('.') || 'row'} ${issue.message}`)
          .join('; ')}.`,
      )
    }
    return result.data
  })
  const pmids = parsed.map((row) => row.pmid)
  if (new Set(pmids).size !== pmids.length) {
    throw new Error('Development fold cohort contains duplicate PMIDs.')
  }
  return parsed.sort((left, right) => numericPmidOrder(left.pmid, right.pmid))
}

function stratumFor(
  row: ShadowDevelopmentFoldRow,
  stratification: ShadowDevelopmentFoldManifest['stratification'],
): string {
  if (stratification === 'relevance_label') return row.relevanceLabel
  if (!row.metadataSufficiency) {
    throw new Error('Metadata sufficiency is required by the selected fold stratification.')
  }
  return `${row.relevanceLabel}\0${row.metadataSufficiency}`
}

/**
 * Build deterministic repeated internal-development folds.
 *
 * The opaque development capability is required even for synthetic tests. This function never
 * describes a fold as held out and never serializes fold or target fields into model inputs.
 */
export function buildRepeatedStratifiedDevelopmentFolds(input: {
  scope: AuthorizedDevelopmentShadowScope
  rows: readonly ShadowDevelopmentFoldRow[]
  seed: string
  folds: number
  repeats: number
  stratification?: ShadowDevelopmentFoldManifest['stratification']
  truth?: AuthorizedShadowDevelopmentTruth
}): Readonly<ShadowDevelopmentFoldManifest> {
  assertAuthorizedDevelopmentShadowScope(input.scope)
  const scope = developmentShadowScopeDescriptor(input.scope)
  const rows = validateRows(input.rows)
  rows.forEach((row) => assertDevelopmentArticleAuthorized(input.scope, row.pmid))
  const seed = z.string().trim().min(1).max(500).parse(input.seed)
  const folds = z.number().int().min(2).max(50).parse(input.folds)
  const repeats = z.number().int().min(1).max(100).parse(input.repeats)
  const stratification = input.stratification ?? 'relevance_label'
  if (!['relevance_label', 'relevance_label_and_metadata_sufficiency'].includes(stratification)) {
    throw new Error('Unknown development-fold stratification.')
  }
  if (rows.length !== scope.developmentCohortSize) {
    throw new Error(
      `Development folds require the complete authorized cohort of ${scope.developmentCohortSize} rows.`,
    )
  }
  if (scope.authorityClass === 'real_development_membership') {
    if (!input.truth)
      throw new Error('Real development folds require opaque pinned truth authority.')
    assertAuthorizedShadowDevelopmentTruth(input.truth)
    const truthByPmid = new Map(input.truth.rows.map((row) => [row.pmid, row]))
    for (const row of rows) {
      const truth = truthByPmid.get(row.pmid)
      if (
        !truth ||
        truth.relevanceLabel !== row.relevanceLabel ||
        (row.metadataSufficiency !== undefined &&
          truth.metadataSufficiency !== row.metadataSufficiency)
      ) {
        throw new Error('Fold rows do not match opaque pinned coordinator truth.')
      }
    }
  } else if (input.truth) {
    throw new Error('Synthetic folds cannot carry real truth authority.')
  }

  const grouped = new Map<string, ShadowDevelopmentFoldRow[]>()
  for (const row of rows) {
    const key = stratumFor(row, stratification)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  for (const [stratum, values] of grouped) {
    if (values.length < folds) {
      throw new Error(
        `Development fold stratum ${JSON.stringify(stratum)} has ${values.length} rows for ${folds} folds.`,
      )
    }
  }

  const assignments: ShadowDevelopmentFoldAssignment[] = []
  for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex += 1) {
    for (const [stratum, values] of [...grouped].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const ordered = [...values].sort((left, right) => {
        const leftHash = sha256ShadowValue({ seed, repeatIndex, stratum, pmid: left.pmid })
        const rightHash = sha256ShadowValue({ seed, repeatIndex, stratum, pmid: right.pmid })
        return leftHash.localeCompare(rightHash) || numericPmidOrder(left.pmid, right.pmid)
      })
      ordered.forEach((row, index) => {
        assignments.push({
          pmid: row.pmid,
          repeatIndex,
          validationFoldIndex: index % folds,
          stratum,
        })
      })
    }
  }
  assignments.sort(
    (left, right) =>
      left.repeatIndex - right.repeatIndex ||
      left.validationFoldIndex - right.validationFoldIndex ||
      numericPmidOrder(left.pmid, right.pmid),
  )

  for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex += 1) {
    const repeatAssignments = assignments.filter(
      (assignment) => assignment.repeatIndex === repeatIndex,
    )
    if (
      repeatAssignments.length !== rows.length ||
      new Set(repeatAssignments.map((assignment) => assignment.pmid)).size !== rows.length
    ) {
      throw new Error(`Development fold repeat ${repeatIndex} does not cover the cohort exactly.`)
    }
  }

  const withoutHash = {
    schemaVersion: SHADOW_DEVELOPMENT_FOLD_SCHEMA_VERSION,
    developmentOnly: true as const,
    heldOutValidation: false as const,
    warning: 'Internal development folds are not held-out validation.' as const,
    seed,
    repeats,
    folds,
    stratification,
    authorityClass: scope.authorityClass,
    developmentMembershipSha256: scope.developmentMembershipSha256,
    cohortSize: rows.length,
    cohortSha256: sha256ShadowValue(rows),
    truthAuthority:
      scope.authorityClass === 'real_development_membership'
        ? ('pinned_961c19f4_truth' as const)
        : ('synthetic_fixture_rows' as const),
    truthArtifactSha256: input.truth?.truthArtifactSha256 ?? null,
    assignments,
  }
  return immutableShadowValue({
    ...withoutHash,
    manifestSha256: sha256ShadowValue(withoutHash),
  })
}

export function developmentFoldPmids(input: {
  scope: AuthorizedDevelopmentShadowScope
  rows: readonly ShadowDevelopmentFoldRow[]
  manifest: ShadowDevelopmentFoldManifest
  truth?: AuthorizedShadowDevelopmentTruth
  repeatIndex: number
  validationFoldIndex: number
}): { trainingPmids: string[]; validationPmids: string[] } {
  verifyRepeatedStratifiedDevelopmentFolds({
    scope: input.scope,
    rows: input.rows,
    manifest: input.manifest,
    truth: input.truth,
  })
  if (
    input.repeatIndex < 0 ||
    input.repeatIndex >= input.manifest.repeats ||
    input.validationFoldIndex < 0 ||
    input.validationFoldIndex >= input.manifest.folds
  ) {
    throw new Error('Development fold index is outside the manifest.')
  }
  const repeat = input.manifest.assignments.filter(
    (assignment) => assignment.repeatIndex === input.repeatIndex,
  )
  const validationPmids = repeat
    .filter((assignment) => assignment.validationFoldIndex === input.validationFoldIndex)
    .map((assignment) => assignment.pmid)
    .sort(numericPmidOrder)
  const validationSet = new Set(validationPmids)
  const trainingPmids = repeat
    .map((assignment) => assignment.pmid)
    .filter((pmid) => !validationSet.has(pmid))
    .sort(numericPmidOrder)
  if (trainingPmids.some((pmid) => validationSet.has(pmid))) {
    throw new Error('Development training and validation folds overlap.')
  }
  return { trainingPmids, validationPmids }
}

export function verifyRepeatedStratifiedDevelopmentFolds(input: {
  scope: AuthorizedDevelopmentShadowScope
  rows: readonly ShadowDevelopmentFoldRow[]
  manifest: ShadowDevelopmentFoldManifest
  truth?: AuthorizedShadowDevelopmentTruth
}): void {
  const expected = buildRepeatedStratifiedDevelopmentFolds({
    scope: input.scope,
    rows: input.rows,
    seed: input.manifest.seed,
    folds: input.manifest.folds,
    repeats: input.manifest.repeats,
    stratification: input.manifest.stratification,
    truth: input.truth,
  })
  if (sha256ShadowValue(expected) !== sha256ShadowValue(input.manifest)) {
    throw new Error('Development fold manifest does not recompute exactly from authorized rows.')
  }
}
