import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  MissingBaseError,
  checkPublicationBaseline,
} from '../../../../scripts/ip-preference-cards/check-publication-baseline'
import {
  ALPHA_RELEASE_ID,
  BRAVO_RELEASE_ID,
  CHARLIE_RELEASE_ID,
  FIXTURE_PROCEDURE_CODE,
  createFixtureReleaseWorld,
} from '../__fixtures__/release-bundle-fixtures'
import {
  computeReviewedProductFamilyVersion,
  type ReviewedProductFamilyVersion,
} from '../domain/product-family'
import {
  buildPublicationBaselineSnapshot,
  comparePublicationBaseline,
  type PublicationArtifacts,
} from '../domain/publication-baseline'
import type { PreferenceCardReleaseBundle } from '../domain/release-bundle'

/**
 * Published definitions are append-only relative to the protected base.
 *
 * The gap this closes is specific: `validateReleaseBundles` recomputes every frozen hash from the
 * definitions in the same tree, so it catches an edited definition — and not an edited definition
 * whose frozen hash was updated in the same commit. Self-consistency cannot detect a consistent
 * rewrite. Only a second copy of what was published can, and `origin/main` is that copy.
 */

const world = createFixtureReleaseWorld()

function artifacts(bundles: PreferenceCardReleaseBundle[]): PublicationArtifacts {
  return {
    releaseBundles: { pointers: { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID }, bundles },
    moduleLedger: null,
    catalogReleases: null,
    productFamilies: null,
  }
}

function compare(base: PreferenceCardReleaseBundle[], head: PreferenceCardReleaseBundle[]) {
  return comparePublicationBaseline({
    base: buildPublicationBaselineSnapshot(artifacts(base)),
    head: buildPublicationBaselineSnapshot(artifacts(head)),
  })
}

const alpha = world.bundleById.get(ALPHA_RELEASE_ID)!
const bravo = world.bundleById.get(BRAVO_RELEASE_ID)!
const charlie = world.bundleById.get(CHARLIE_RELEASE_ID)!

describe('what a branch may add', () => {
  it('reports a branch-only release as new rather than as a violation', () => {
    const result = compare([alpha, bravo], [alpha, bravo, charlie])
    expect(result.violations).toEqual([])
    expect(result.added.map((entry) => entry.id)).toEqual([CHARLIE_RELEASE_ID])
  })

  it('reports everything as new when the base publishes nothing yet', () => {
    // The state the current sixteen bundles are in: frozen on a feature branch, never merged, so
    // no card can be pinned to them and re-freezing is legitimate. This is what makes the
    // pre-publication re-freeze safe and what stops being true the moment they land in `main`.
    const result = compare([], [alpha, bravo, charlie])
    expect(result.violations).toEqual([])
    expect(result.added).toHaveLength(3)
  })

  it('ignores drafts, which are content still being written', () => {
    const draft = {
      ...charlie,
      id: 'release-fixture-procedure-v2-0',
      releaseState: 'draft' as const,
    }
    const result = compare([alpha, bravo], [alpha, bravo, draft])
    expect(result.added).toEqual([])
    expect(result.violations).toEqual([])
  })
})

describe('what a branch may not do to a published entry', () => {
  it('fails when a published definition hash changes', () => {
    const rewritten = { ...bravo, definitionHash: 'f'.repeat(64) }
    const result = compare([alpha, bravo], [alpha, rewritten])
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_definition_mutated',
    )
  })

  it('fails even when the definition and its frozen hash are updated together', () => {
    // The whole point. Locally this rewritten bundle is perfectly self-consistent — the hash it
    // records is the hash of what it now pins — and every in-tree check passes. Only the base
    // comparison sees it.
    const selfConsistent = {
      ...bravo,
      modulePins: bravo.modulePins.map((pin) => ({ ...pin, definitionHash: 'e'.repeat(64) })),
      definitionHash: 'e'.repeat(64),
    }
    const result = compare([alpha, bravo], [alpha, selfConsistent])
    const codes = result.violations.map((violation) => violation.code)
    expect(codes).toContain('publication_definition_mutated')
    expect(codes).toContain('publication_dependencies_replaced')
  })

  it('fails when a published release disappears', () => {
    const result = compare([alpha, bravo], [bravo])
    const violation = result.violations.find(
      (candidate) => candidate.code === 'publication_entry_removed',
    )
    expect(violation?.id).toBe(ALPHA_RELEASE_ID)
  })

  it('fails when a published release swaps a dependency', () => {
    const repinned = {
      ...bravo,
      modulePins: [{ ...bravo.modulePins[0], moduleVersionId: 'module-fixture-core-v9-9' }],
    }
    const result = compare([alpha, bravo], [alpha, repinned])
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_dependencies_replaced',
    )
  })

  it('fails when a semantic version is reassigned to different content', () => {
    // The rewrite that survives every other check: add a new id, delete nothing, touch no published
    // hash — and two different definitions now answer to `FIXTURE_PROCEDURE v1-1`. The base already
    // publishes `release-fixture-procedure-v1-1`; this publishes a second one under the same
    // procedure and the same version suffix.
    const secondV11 = { ...charlie, id: 'release-fixture-procedure-hotfix-v1-1' }
    const result = compare([alpha, bravo], [alpha, bravo, secondV11])
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_semantic_version_reassigned',
    )
  })

  it('fails when a publication timestamp is rewritten', () => {
    const backdated = { ...bravo, publishedAt: '2020-01-01T00:00:00.000Z' }
    const result = compare([alpha, bravo], [alpha, backdated])
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_lifecycle_field_rewritten',
    )
  })

  it('fails when a published release is un-published', () => {
    const unpublished = { ...bravo, releaseState: 'draft' as const }
    const result = compare([alpha, bravo], [alpha, unpublished])
    // Reverting to draft removes the entry from the head projection entirely, which reads as the
    // erasure it is rather than as a lifecycle move.
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_entry_removed',
    )
  })

  it('fails when a retired release is brought back to published', () => {
    const revived = { ...alpha, releaseState: 'published' as const }
    const result = compare([alpha, bravo], [revived, bravo])
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_lifecycle_regressed',
    )
  })
})

describe('what a branch may legitimately do', () => {
  it('allows retirement without touching the clinical definition', () => {
    const published = { ...alpha, releaseState: 'published' as const, retiredAt: null }
    const retired = {
      ...published,
      releaseState: 'retired' as const,
      retiredAt: '2026-02-01T00:00:00.000Z',
    }
    const result = compare([published, bravo], [retired, bravo])

    expect(result.violations).toEqual([])
    expect(result.lifecycleAdvanced.map(({ entry }) => entry.id)).toContain(ALPHA_RELEASE_ID)
    // Retirement is metadata: the definition hash is untouched, which is what "retirement must not
    // alter the historical clinical definition" means in practice.
    expect(retired.definitionHash).toBe(published.definitionHash)
  })

  it('allows superseding through a new release', () => {
    const result = compare([alpha, bravo], [alpha, bravo, charlie])
    expect(result.violations).toEqual([])
    expect(result.added.map((entry) => entry.id)).toEqual([CHARLIE_RELEASE_ID])
    expect(charlie.supersedesReleaseBundleId).toBe(BRAVO_RELEASE_ID)
  })

  it('allows moving the current-release pointer', () => {
    const base = buildPublicationBaselineSnapshot(artifacts([alpha, bravo, charlie]))
    const head = buildPublicationBaselineSnapshot({
      ...artifacts([alpha, bravo, charlie]),
      releaseBundles: {
        pointers: { [FIXTURE_PROCEDURE_CODE]: CHARLIE_RELEASE_ID },
        bundles: [alpha, bravo, charlie],
      },
    })
    expect(comparePublicationBaseline({ base, head }).violations).toEqual([])
  })

  it('allows revising release notes', () => {
    const reworded = { ...bravo, releaseNotes: 'A clearer explanation of the same change.' }
    const result = compare([alpha, bravo], [alpha, reworded])
    expect(result.violations).toEqual([])
    expect(result.lifecycleAdvanced.map(({ entry }) => entry.id)).toContain(BRAVO_RELEASE_ID)
  })
})

describe('product-family governance across the baseline', () => {
  const draft = computeReviewedProductFamilyVersion({
    productFamilyVersionId: 'family-fixture-line-v1-0',
    productFamilyCode: 'FIXTURE_LINE',
    version: '1.0',
    catalogReleaseId: 'a'.repeat(64),
    roleCodes: ['AIRWAY_STENT_SILICONE_STRAIGHT'],
    displayName: 'Fixture Line',
    manufacturerGroupId: 'MFR-FIXTURE',
    manufacturerDisplay: 'Fixture Devices',
    memberProductIds: ['PRD-FIXTUREAA', 'PRD-FIXTUREBB'],
    governanceState: 'draft',
    supersedesProductFamilyVersionId: null,
    reviewBasis: 'Seeded from the manufacturer-authored brand family. Clinical review pending.',
    approvedAt: null,
    retiredAt: null,
  })

  function familyArtifacts(versions: ReviewedProductFamilyVersion[]): PublicationArtifacts {
    return {
      releaseBundles: null,
      moduleLedger: null,
      catalogReleases: null,
      productFamilies: { formatVersion: '1.0', hashVersion: 'x', versions },
    }
  }

  function compareFamilies(
    base: ReviewedProductFamilyVersion[],
    head: ReviewedProductFamilyVersion[],
  ) {
    return comparePublicationBaseline({
      base: buildPublicationBaselineSnapshot(familyArtifacts(base)),
      head: buildPublicationBaselineSnapshot(familyArtifacts(head)),
    })
  }

  it('permits a draft family to move forward to approved after review', () => {
    // The reason the eighteen seeded families can merge as drafts: approving one later is a
    // permitted lifecycle move, not a rewrite. Governance sits outside the definition hash, so the
    // identity and membership a card would pin are already final.
    const approved = computeReviewedProductFamilyVersion({
      ...draft,
      governanceState: 'approved',
      approvedAt: '2026-09-01T00:00:00.000Z',
      reviewBasis: 'Reviewed device by device on 2026-09-01.',
    })

    const result = compareFamilies([draft], [approved])
    expect(result.violations).toEqual([])
    expect(result.lifecycleAdvanced.map(({ entry }) => entry.id)).toEqual([
      draft.productFamilyVersionId,
    ])
    expect(approved.definitionHash).toBe(draft.definitionHash)
    expect(approved.memberProductIds).toEqual(draft.memberProductIds)
  })

  it('refuses an approved family being reverted to draft', () => {
    const approved = computeReviewedProductFamilyVersion({
      ...draft,
      governanceState: 'approved',
      approvedAt: '2026-09-01T00:00:00.000Z',
    })
    const result = compareFamilies([approved], [draft])
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_lifecycle_regressed',
    )
  })

  it('locks a draft family, unlike a draft release', () => {
    // The asymmetry, asserted so it stays deliberate. A draft release is content being authored and
    // is excluded from the baseline entirely; a draft family has a settled identity awaiting
    // clinical sign-off, and locking it on merge is what makes the eventual approval mean something.
    const familyBase = buildPublicationBaselineSnapshot(familyArtifacts([draft]))
    expect(familyBase.entries.map((entry) => entry.id)).toEqual([draft.productFamilyVersionId])

    const draftRelease = { ...charlie, releaseState: 'draft' as const }
    const releaseBase = buildPublicationBaselineSnapshot(artifacts([draftRelease]))
    expect(releaseBase.entries).toEqual([])
  })

  it('refuses a published family whose membership changed', () => {
    const rewritten = computeReviewedProductFamilyVersion({
      ...draft,
      memberProductIds: [...draft.memberProductIds, 'PRD-FIXTURECC'],
    })
    const result = compareFamilies([draft], [rewritten])
    expect(result.violations.map((violation) => violation.code)).toContain(
      'publication_definition_mutated',
    )
  })
})

describe('the command', () => {
  function writeFixture(
    directory: string,
    side: 'base' | 'head',
    bundles: PreferenceCardReleaseBundle[],
  ) {
    const target = path.join(directory, side)
    mkdirSync(target, { recursive: true })
    writeFileSync(
      path.join(target, 'release-bundles.json'),
      JSON.stringify({ pointers: { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID }, bundles }),
    )
  }

  it('runs against fixtures without needing a git remote', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'ip-cards-baseline-'))
    writeFixture(directory, 'base', [alpha, bravo])
    writeFixture(directory, 'head', [alpha, bravo, charlie])

    const result = await checkPublicationBaseline({
      base: 'unused',
      fixture: directory,
      generatedDirectory: 'unused',
    })
    expect(result.comparison.violations).toEqual([])
    expect(result.comparison.added.map((entry) => entry.id)).toEqual([CHARLIE_RELEASE_ID])
  })

  it('reports a rewritten published release through the fixture path too', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'ip-cards-baseline-'))
    writeFixture(directory, 'base', [alpha, bravo])
    writeFixture(directory, 'head', [alpha, { ...bravo, definitionHash: 'f'.repeat(64) }])

    const result = await checkPublicationBaseline({
      base: 'unused',
      fixture: directory,
      generatedDirectory: 'unused',
    })
    expect(result.comparison.violations.map((violation) => violation.code)).toContain(
      'publication_definition_mutated',
    )
  })

  it('fails rather than passing when the protected base cannot be resolved', async () => {
    // A check that silently passes when it cannot look is a green tick meaning "I verified
    // nothing", and the commit it would wave through is the one rewriting a published release on a
    // machine with no remote configured.
    await expect(
      checkPublicationBaseline({
        base: 'refs/heads/definitely-not-a-branch-abc123',
        fixture: null,
        generatedDirectory: 'data/ip-preference-cards/generated',
      }),
    ).rejects.toBeInstanceOf(MissingBaseError)
  })
})
