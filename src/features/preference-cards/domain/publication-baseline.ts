import type { CompositionLedger } from './composition-ledger'
import type { DefinitionSetLedger } from './definition-set-ledger'
import type { HistoricalCatalogReleaseFile } from './historical-catalog'
import type { ModuleLedger } from './module-ledger'
import type { ProductFamilyLedger } from './product-family'
import type { PreferenceCardReleaseBundle, ReleasePointerMap } from './release-bundle'

/**
 * Append-only publication, checked against the protected base branch.
 *
 * Everything else in this feature checks a commit against *itself*: `validateReleaseBundles`
 * recomputes each frozen hash from the definitions in the same tree and fails when they disagree.
 * That is a real guard and it has one hole, which is the reason this module exists. A developer
 * can edit a published definition **and** update the frozen hash beside it in the same commit.
 * Local recomputation then passes, every suite is green, and the only evidence that a published
 * release changed is a diff nobody diffed. Self-consistency cannot detect a consistent rewrite;
 * only a second copy of what was published can.
 *
 * `origin/main` is that second copy. Once a release, module version, catalog release, or family
 * version has appeared in the protected base, its immutable fields are frozen *relative to that
 * baseline*, and this compares the two.
 *
 * ## What it distinguishes
 *
 * - **New, branch-only ids.** Reported separately and never a violation. A feature branch adding a
 *   release is the ordinary case, and it is why "the ledger changed" cannot be the check.
 * - **Ids already in the protected base.** Immutable content, dependencies, and semantic version
 *   assignment. Removal is a violation; so is rewriting.
 * - **Explicitly mutable lifecycle metadata.** Publishing, retiring, moving a pointer, and editing
 *   release notes are the acts the lifecycle is *for*, and each is allowed in one direction only.
 *   Un-publishing is not a lifecycle transition; it is the erasure of a publication.
 *
 * ## The pre-publication window
 *
 * Until an id exists in the protected base, this check has nothing to compare it to and reports it
 * as new. That is correct, and it is the state the current sixteen release bundles are in: they
 * were frozen on a feature branch, and re-freezing them there is legitimate because nobody has
 * ever been able to pin a card to them. The moment they merge, the same act becomes
 * `publication_definition_mutated`.
 */

export type PublicationEntryKind =
  | 'release-bundle'
  | 'module-version'
  | 'recipe-version'
  | 'catalog-release'
  | 'product-family-version'
  | 'definition-set'

/**
 * One immutable published definition, projected to exactly what may not change.
 *
 * Deliberately not the whole artifact. Comparing raw JSON would flag a re-ordered key or a
 * prettier upgrade as a rewritten release, and a check that fires on formatting is a check people
 * route around.
 */
export interface PublicationBaselineEntry {
  kind: PublicationEntryKind
  id: string
  /** The hash the artifact itself records as its immutable identity. */
  definitionHash: string
  /**
   * The line this version belongs to — procedure code, module code, family code. Paired with
   * `semanticVersion` it answers "has this version number been reassigned to other content".
   */
  lineage: string | null
  semanticVersion: string | null
  /** Ids of the definitions this one is built from. Replacing one replaces the release. */
  dependencies: string[]
  /** Everything that may legitimately move, and only these. */
  lifecycle: Record<string, string | null>
}

export interface PublicationBaselineSnapshot {
  entries: PublicationBaselineEntry[]
  /** Current-release pointers. Wholly mutable — moving one is how a release becomes current. */
  pointers: ReleasePointerMap
}

/**
 * The generated artifacts a snapshot is projected from, as read at one git ref.
 *
 * Every field is nullable because the base may predate the artifact. A missing artifact means
 * "nothing published here yet", which is different from an empty artifact and different again
 * from an unreadable ref — the last of those is handled by the caller and never reaches here.
 */
export interface PublicationArtifacts {
  releaseBundles: {
    pointers: Record<string, string>
    bundles: PreferenceCardReleaseBundle[]
  } | null
  moduleLedger: ModuleLedger | null
  compositionLedger: CompositionLedger | null
  definitionSetLedger: DefinitionSetLedger | null
  catalogReleases: HistoricalCatalogReleaseFile | null
  productFamilies: ProductFamilyLedger | null
}

/** `release-bronch-ablation-v1-0` → `v1-0`. Null when the id carries no version suffix. */
function versionSuffix(id: string): string | null {
  const match = /-(v\d+(?:-\d+)*)$/.exec(id)
  return match ? match[1] : null
}

export function buildPublicationBaselineSnapshot(
  artifacts: PublicationArtifacts,
): PublicationBaselineSnapshot {
  const entries: PublicationBaselineEntry[] = []

  for (const bundle of artifacts.releaseBundles?.bundles ?? []) {
    // Drafts are excluded on purpose. A draft is content still being written, and freezing it
    // against the base would make the ordinary act of revising an unpublished release a
    // violation. Publication is what makes a definition immutable, here as everywhere else.
    if (bundle.releaseState === 'draft') continue
    entries.push({
      kind: 'release-bundle',
      id: bundle.id,
      definitionHash: bundle.definitionHash,
      lineage: bundle.sourceProcedureCode,
      semanticVersion: versionSuffix(bundle.id),
      dependencies: [
        `recipe:${bundle.recipeVersionId}@${bundle.recipeDefinitionHash}`,
        ...[...bundle.modulePins]
          .map((pin) => `module:${pin.moduleVersionId}@${pin.definitionHash}`)
          .sort(),
        `set:${bundle.modifierSetPin.id}@${bundle.modifierSetPin.definitionHash}`,
        `set:${bundle.rescueModuleSetPin.id}@${bundle.rescueModuleSetPin.definitionHash}`,
        `set:${bundle.compatibilityRuleSetPin.id}@${bundle.compatibilityRuleSetPin.definitionHash}`,
        `set:${bundle.roleTaxonomyPin.id}@${bundle.roleTaxonomyPin.definitionHash}`,
        `catalog:${bundle.catalogImportId}`,
        `contract:${bundle.resolverContractVersion}`,
        ...(bundle.supersedesReleaseBundleId
          ? [`supersedes:${bundle.supersedesReleaseBundleId}`]
          : []),
      ],
      lifecycle: {
        releaseState: bundle.releaseState,
        publishedAt: bundle.publishedAt,
        retiredAt: bundle.retiredAt,
        releaseNotes: bundle.releaseNotes,
      },
    })
  }

  for (const entry of artifacts.moduleLedger?.entries ?? []) {
    entries.push({
      kind: 'module-version',
      id: entry.moduleVersionId,
      definitionHash: entry.definitionHash,
      lineage: entry.moduleCode,
      semanticVersion: entry.moduleVersion,
      dependencies: [],
      lifecycle: {},
    })
  }

  // Retained recipe versions get the same direct second-copy protection as retained module
  // versions: without this, a superseded ledger entry that no live build reproduces could be
  // rewritten together with its recorded hash in one commit and nothing would compare it to
  // what was published.
  for (const entry of artifacts.compositionLedger?.entries ?? []) {
    entries.push({
      kind: 'recipe-version',
      id: entry.recipeVersionId,
      definitionHash: entry.definitionHash,
      lineage: entry.sourceProcedureCode,
      semanticVersion: versionSuffix(entry.recipeVersionId),
      dependencies: [],
      lifecycle: {},
    })
  }

  // Retained whole definition sets are content-addressed, so the id carries the hash: a
  // "consistent rewrite" — new content with a matching new hash — changes the id itself,
  // which this comparison reads as removing a published entry. The hash is still recorded
  // separately so an id kept intact with edited content also fires the mutation code.
  for (const entry of artifacts.definitionSetLedger?.entries ?? []) {
    entries.push({
      kind: 'definition-set',
      id: `${entry.definitionSetId}@${entry.definitionHash}`,
      definitionHash: entry.definitionHash,
      lineage: entry.definitionSetId,
      semanticVersion: null,
      dependencies: [],
      lifecycle: {},
    })
  }

  for (const release of artifacts.catalogReleases?.releases ?? []) {
    entries.push({
      kind: 'catalog-release',
      id: release.catalogReleaseId,
      definitionHash: release.manifestHash,
      lineage: null,
      semanticVersion: null,
      dependencies: [`workbook:${release.workbookSha256}`],
      lifecycle: {},
    })
  }

  // Drafts are included here, unlike release bundles above, and the asymmetry is deliberate.
  //
  // A draft *release* is an authoring workspace: its pins are recomputed on every build and it
  // carries no frozen hash at all, so freezing it against the base would make revising an
  // unpublished release a violation.
  //
  // A draft *family* is the opposite situation. Its membership is derived once and checked against
  // the member count a reviewer counted, and the whole reason it exists in this state is that the
  // identity is settled while clinical review is not. Locking it on merge is the point: a reviewer
  // approves the membership that was put in front of them, and a membership that could be edited
  // out from under a pending review would make the approval meaningless. Correcting one after merge
  // takes a new family version, which is the same discipline every other definition here follows.
  for (const version of artifacts.productFamilies?.versions ?? []) {
    entries.push({
      kind: 'product-family-version',
      id: version.productFamilyVersionId,
      definitionHash: version.definitionHash,
      lineage: version.productFamilyCode,
      semanticVersion: version.version,
      dependencies: [
        `catalog:${version.catalogReleaseId}`,
        ...(version.supersedesProductFamilyVersionId
          ? [`supersedes:${version.supersedesProductFamilyVersionId}`]
          : []),
      ],
      lifecycle: {
        governanceState: version.governanceState,
        approvedAt: version.approvedAt,
        retiredAt: version.retiredAt,
        reviewBasis: version.reviewBasis,
      },
    })
  }

  entries.sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id),
  )

  return { entries, pointers: artifacts.releaseBundles?.pointers ?? {} }
}

export type PublicationViolationCode =
  | 'publication_entry_removed'
  | 'publication_definition_mutated'
  | 'publication_dependencies_replaced'
  | 'publication_semantic_version_reassigned'
  | 'publication_lifecycle_regressed'
  | 'publication_lifecycle_field_rewritten'

export interface PublicationViolation {
  code: PublicationViolationCode
  kind: PublicationEntryKind
  id: string
  message: string
}

export interface PublicationBaselineComparison {
  /** Ids that exist only on this branch. Not a violation — this is what a feature branch does. */
  added: PublicationBaselineEntry[]
  /** Ids present in the base and unchanged in every immutable respect. */
  unchanged: PublicationBaselineEntry[]
  /** Ids present in both whose only differences are permitted lifecycle transitions. */
  lifecycleAdvanced: Array<{ entry: PublicationBaselineEntry; transitions: string[] }>
  violations: PublicationViolation[]
}

/**
 * Lifecycle transitions that are legitimate acts rather than rewrites, per governance axis.
 *
 * Read as: from state X, these are the states you may move to. A state absent from the map is
 * terminal. `retired → published` is deliberately missing — un-retiring a release would make a
 * definition selectable again for new cards without anything recording that it had been withdrawn.
 */
const ALLOWED_LIFECYCLE_TRANSITIONS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  releaseState: {
    draft: ['draft', 'published', 'retired'],
    published: ['published', 'retired'],
    retired: ['retired'],
  },
  governanceState: {
    draft: ['draft', 'approved', 'retired'],
    approved: ['approved', 'retired'],
    retired: ['retired'],
  },
}

/**
 * Lifecycle fields that may be *set* once and then never changed again.
 *
 * A publication date is a historical fact. Moving it after the fact rewrites when a clinical
 * definition became available, which is exactly the kind of quiet edit this check exists for —
 * so null → value is a publication, and value → anything else is a violation.
 */
const WRITE_ONCE_LIFECYCLE_FIELDS = ['publishedAt', 'retiredAt', 'approvedAt'] as const

/** Lifecycle fields that are prose about the entry and may be revised freely. */
export const FREELY_MUTABLE_LIFECYCLE_FIELDS: Readonly<Record<string, string>> = {
  releaseNotes:
    'Prose about a release, not an input the resolver reads. Improving the explanation of a published release must not read as changing it.',
  reviewBasis:
    'Prose describing what a reviewer read. Recording better provenance for the same membership is not a membership change.',
}

function compareLifecycle(
  base: PublicationBaselineEntry,
  head: PublicationBaselineEntry,
): { transitions: string[]; violations: PublicationViolation[] } {
  const transitions: string[] = []
  const violations: PublicationViolation[] = []
  const fields = [...new Set([...Object.keys(base.lifecycle), ...Object.keys(head.lifecycle)])]

  for (const field of fields.sort()) {
    const before = base.lifecycle[field] ?? null
    const after = head.lifecycle[field] ?? null
    if (before === after) continue
    if (field in FREELY_MUTABLE_LIFECYCLE_FIELDS) {
      transitions.push(`${field}: revised`)
      continue
    }

    const stateMachine = ALLOWED_LIFECYCLE_TRANSITIONS[field]
    if (stateMachine) {
      const allowed = before === null ? null : stateMachine[before]
      if (allowed && after !== null && allowed.includes(after)) {
        transitions.push(`${field}: ${before} → ${after}`)
        continue
      }
      violations.push({
        code: 'publication_lifecycle_regressed',
        kind: head.kind,
        id: head.id,
        message: `${head.id} moves ${field} from "${before}" to "${after}", which is not a permitted lifecycle transition. Publishing and retiring move forward only; a published definition is never un-published.`,
      })
      continue
    }

    if ((WRITE_ONCE_LIFECYCLE_FIELDS as readonly string[]).includes(field)) {
      if (before === null) {
        transitions.push(`${field}: set to ${after}`)
        continue
      }
      violations.push({
        code: 'publication_lifecycle_field_rewritten',
        kind: head.kind,
        id: head.id,
        message: `${head.id} rewrites ${field} from "${before}" to "${after ?? 'null'}". That field records when something happened and is set once.`,
      })
      continue
    }

    violations.push({
      code: 'publication_lifecycle_field_rewritten',
      kind: head.kind,
      id: head.id,
      message: `${head.id} changes ${field} from "${before}" to "${after ?? 'null'}", which is not a documented mutable lifecycle field.`,
    })
  }

  return { transitions, violations }
}

/**
 * Compare a branch's publication state against the protected base.
 *
 * Pure, so the script and the tests exercise the same comparison and the tests never need a git
 * remote. The script's only extra job is reading the two snapshots.
 */
export function comparePublicationBaseline(input: {
  base: PublicationBaselineSnapshot
  head: PublicationBaselineSnapshot
}): PublicationBaselineComparison {
  const key = (entry: PublicationBaselineEntry) => `${entry.kind}:${entry.id}`
  const baseByKey = new Map(input.base.entries.map((entry) => [key(entry), entry]))
  const headByKey = new Map(input.head.entries.map((entry) => [key(entry), entry]))

  const added: PublicationBaselineEntry[] = []
  const unchanged: PublicationBaselineEntry[] = []
  const lifecycleAdvanced: PublicationBaselineComparison['lifecycleAdvanced'] = []
  const violations: PublicationViolation[] = []

  for (const [entryKey, baseEntry] of baseByKey) {
    const headEntry = headByKey.get(entryKey)
    if (!headEntry) {
      violations.push({
        code: 'publication_entry_removed',
        kind: baseEntry.kind,
        id: baseEntry.id,
        message: `${baseEntry.id} is published in the protected base and is absent from this branch. A published definition is retained forever; the cards pinned to it have nothing else to reconstruct from.`,
      })
      continue
    }

    let mutated = false

    if (headEntry.definitionHash !== baseEntry.definitionHash) {
      mutated = true
      violations.push({
        code: 'publication_definition_mutated',
        kind: headEntry.kind,
        id: headEntry.id,
        message: `${headEntry.id} is published in the protected base with definition hash ${baseEntry.definitionHash} and this branch records ${headEntry.definitionHash}. Updating a definition and its frozen hash together still changes what a published id means: publish a new version instead.`,
      })
    }

    const baseDependencies = [...baseEntry.dependencies].sort().join('\n')
    const headDependencies = [...headEntry.dependencies].sort().join('\n')
    if (baseDependencies !== headDependencies) {
      mutated = true
      const before = new Set(baseEntry.dependencies)
      const after = new Set(headEntry.dependencies)
      const removed = [...before].filter((value) => !after.has(value))
      const introduced = [...after].filter((value) => !before.has(value))
      violations.push({
        code: 'publication_dependencies_replaced',
        kind: headEntry.kind,
        id: headEntry.id,
        message: `${headEntry.id} is published in the protected base and this branch replaces what it is built from. Removed: ${removed.join(', ') || 'none'}. Added: ${introduced.join(', ') || 'none'}.`,
      })
    }

    const lifecycle = compareLifecycle(baseEntry, headEntry)
    violations.push(...lifecycle.violations)

    if (mutated || lifecycle.violations.length > 0) continue
    if (lifecycle.transitions.length > 0) {
      lifecycleAdvanced.push({ entry: headEntry, transitions: lifecycle.transitions })
    } else {
      unchanged.push(headEntry)
    }
  }

  for (const [entryKey, headEntry] of headByKey) {
    if (baseByKey.has(entryKey)) continue
    added.push(headEntry)
  }

  // A version number reassigned to different content is the one rewrite that survives every check
  // above: publish `FLEX_BRONCH_CORE 1.1` on the branch under a new id, delete nothing, change no
  // published hash — and two different definitions now answer to the same version. Cross-checked
  // here against the base's assignment of each (line, version) pair.
  const baseLineageVersions = new Map<string, PublicationBaselineEntry>()
  for (const entry of input.base.entries) {
    if (!entry.lineage || !entry.semanticVersion) continue
    baseLineageVersions.set(`${entry.kind}:${entry.lineage}:${entry.semanticVersion}`, entry)
  }
  for (const entry of input.head.entries) {
    if (!entry.lineage || !entry.semanticVersion) continue
    const previous = baseLineageVersions.get(
      `${entry.kind}:${entry.lineage}:${entry.semanticVersion}`,
    )
    if (!previous || previous.id === entry.id) continue
    violations.push({
      code: 'publication_semantic_version_reassigned',
      kind: entry.kind,
      id: entry.id,
      message: `${entry.lineage} version ${entry.semanticVersion} is published in the protected base as ${previous.id} and this branch also publishes it as ${entry.id}. One version number names one definition.`,
    })
  }

  added.sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id),
  )
  violations.sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id),
  )

  return { added, unchanged, lifecycleAdvanced, violations }
}
