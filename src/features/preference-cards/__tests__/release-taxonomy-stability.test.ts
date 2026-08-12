import { getCatalogStore } from '../server/catalog'
import { ROLE_CODE_ALIASES } from '../domain/role-taxonomy'

/**
 * P92-C1: a published release's role semantics are immune to future live taxonomy changes.
 *
 * The Codex reproduction on the reviewed head: add a live alias
 * `APC_APPLICATOR_RIGID → ENERGY_PLATFORM`, resolve `release-rigid-bronch-v1-0`, and the
 * historical resolution reported ok while canonicalizing the rigid APC applicator role to
 * ENERGY_PLATFORM — the retained-taxonomy comparison protected retained alias *keys* but not
 * active historical role codes from becoming new alias sources, and alias application read
 * the live table.
 *
 * The contract this suite pins: for every role code a release can reach — recipe slots,
 * module slots, modifier-added slots, rescue slots, compatibility participants, stored
 * inputs — canonicalization under the release resolves through the release's own pinned
 * taxonomy, so a live extension leaves every historical resolution byte-identical; and a
 * live table that *contradicts* what a release retained (a retargeted alias, a dropped
 * category, a changed override) fails that release's resolution typed rather than applying
 * either table. There is no third outcome in which resolution succeeds with changed meaning.
 *
 * Each scenario loads the whole release stack in an isolated module registry with a doctored
 * live taxonomy, so the thing under test is the real resolution chain over the real
 * committed release and ledger data — not a reimplementation of it.
 */

const TAXONOMY_PATH = '../domain/role-taxonomy'

const OLD_RIGID_RELEASE = 'release-rigid-bronch-v1-0'
const NEW_RIGID_RELEASE = 'release-rigid-bronch-v1-1'

const CAPTURED_ROLE = 'APC_APPLICATOR_RIGID'
const CAPTURE_TARGET = 'ENERGY_PLATFORM'

/** How a scenario doctors the live taxonomy relative to the real module. */
interface TaxonomyDoctor {
  /** Alias entries added on top of the real table (a "future live extension"). */
  addAliases?: Record<string, string>
  /** Real alias sources whose target is rewritten (a permanent-table contradiction). */
  retargetAliases?: Record<string, string>
  /** Categories removed from the reviewed heading set (a contradiction). */
  dropCategories?: string[]
  /** Categories added to the reviewed heading set (a benign extension). */
  addCategories?: string[]
  /** Replacement category-override table (a contradiction when it disagrees). */
  replaceOverrides?: Record<string, string>
}

interface ReleaseResolutionProbe {
  ok: boolean
  code: string | null
  /** stableStringify of the resolved card, when resolution succeeded. */
  cardDigest: string | null
  /** stableStringify of the whole release BuildContext. */
  contextDigest: string | null
  /** The alias table the release context canonicalizes with. */
  contextAliases: Record<string, string> | null
  /** What the release context canonicalizes the captured role to. */
  canonicalizedCapturedRole: string | null
  /** The roleCode a reopened stored custom line carries after rebuild. */
  reopenedCustomItemRole: string | null
  /** The typed failure code of the reopen path, when it failed. */
  reopenCode: string | null
}

interface WorldProbe {
  old: ReleaseResolutionProbe
  new: ReleaseResolutionProbe
  /** Digests from resolving old → new → old again in the same registry. */
  oldAgainDigest: string | null
  newAgainDigest: string | null
  /** Digests from interleaved (promise-based) resolution of both releases. */
  interleaved: Array<string | null>
  /** Role codes derived from the old release's own pinned surface. */
  universe: {
    moduleSlotRole: string | null
    modifierAddedRoles: string[]
    rescueRole: string | null
    compatibilityRole: string | null
  }
}

/**
 * Load the full release stack under a doctored live taxonomy and probe both rigid releases.
 *
 * Everything happens inside one isolated registry: the doctored module is what
 * `demo-context.server` builds its live snapshot from, exactly as a future edit to
 * `role-taxonomy.ts` would be.
 */
async function probeWorld(doctor: TaxonomyDoctor): Promise<WorldProbe> {
  let probe: WorldProbe | null = null

  await jest.isolateModulesAsync(async () => {
    const actual = jest.requireActual(TAXONOMY_PATH) as typeof import('../domain/role-taxonomy')

    const aliases: Record<string, string> = {
      ...actual.ROLE_CODE_ALIASES,
      ...(doctor.retargetAliases ?? {}),
      ...(doctor.addAliases ?? {}),
    }
    const categories = [
      ...actual.ROLE_CATEGORIES.filter(
        (category) => !(doctor.dropCategories ?? []).includes(category),
      ),
      ...(doctor.addCategories ?? []),
    ]
    const overrides = doctor.replaceOverrides ?? actual.ROLE_CATEGORY_OVERRIDES
    const categorySet = new Set(categories)

    jest.doMock(TAXONOMY_PATH, () => ({
      ...actual,
      ROLE_CATEGORIES: categories,
      ROLE_CATEGORY_SET: categorySet,
      isRoleCategory: (value: unknown) => typeof value === 'string' && categorySet.has(value),
      roleCategoryOrder: (category: string) => {
        const index = categories.indexOf(category)
        return index === -1 ? categories.length : index
      },
      canonicalRoleCategory: (value: string | null | undefined) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        if (categorySet.has(trimmed)) return trimmed
        return actual.LEGACY_ROLE_CATEGORY_MAP[trimmed] ?? null
      },
      ROLE_CATEGORY_OVERRIDES: overrides,
      ROLE_CODE_ALIASES: aliases,
      DEPRECATED_ROLE_CODES: new Set(Object.keys(aliases)),
      canonicalRoleCode: (roleCode: string) => aliases[roleCode] ?? roleCode,
      isDeprecatedRoleCode: (roleCode: string) => roleCode in aliases,
    }))

    const releaseBundles =
      (await import('../data/release-bundles.server')) as typeof import('../data/release-bundles.server')
    const demoContext =
      (await import('../data/demo-context.server')) as typeof import('../data/demo-context.server')
    const { resolveCard } =
      (await import('../domain/resolve-card')) as typeof import('../domain/resolve-card')
    const { stableStringify } =
      (await import('../domain/stable-hash')) as typeof import('../domain/stable-hash')
    const { roleCanonicalizerFor } = (await import(
      TAXONOMY_PATH
    )) as typeof import('../domain/role-taxonomy')
    const { rebuildBuilderContext } =
      (await import('../server/rebuild-builder-context')) as typeof import('../server/rebuild-builder-context')
    const { BUILDER_INPUTS_SCHEMA_VERSION } =
      (await import('../schemas/saved-card')) as typeof import('../schemas/saved-card')

    function resolveRelease(releaseBundleId: string): ReleaseResolutionProbe {
      const released = releaseBundles.buildReleaseContext(releaseBundleId)
      if (!released.ok) {
        return {
          ok: false,
          code: released.code,
          cardDigest: null,
          contextDigest: null,
          contextAliases: null,
          canonicalizedCapturedRole: null,
          reopenedCustomItemRole: null,
          reopenCode: released.code,
        }
      }
      const input = demoContext.defaultBuildInput(released.scenario.id, {
        modifierCodes: ['APC'],
      })
      const card = resolveCard(input, released.context)

      // The reopen path: stored builder inputs pinned to this release, carrying a custom line
      // under the captured role. This is where the Codex reproduction observed the live table
      // rewriting a stored role code during a resolution that reported ok.
      const bundle = released.bundle
      const reopened = rebuildBuilderContext(
        {
          schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
          releaseBundleId: bundle.id,
          scenarioId: bundle.scenarioId,
          input: {
            ...input,
            recipeVersionId: bundle.recipeVersionId,
          },
          catalogPicks: [],
          familyPicks: [],
          customItems: [
            {
              id: 'custom-p92c1-probe',
              roleCode: CAPTURED_ROLE,
              description: 'P92-C1 stability probe line',
              itemNumber: null,
              notes: null,
            },
          ],
          equipmentSets: [],
        },
        '2026-08-11T00:00:00.000Z',
      )
      const reopenedItem = reopened.ok
        ? (reopened.resolveContext.hospitalItems.find((item) =>
            item.id.includes('custom-p92c1-probe'),
          ) ?? null)
        : null

      return {
        ok: true,
        code: null,
        cardDigest: stableStringify(card),
        contextDigest: stableStringify(released.context),
        contextAliases: { ...released.context.roleCodeAliases },
        canonicalizedCapturedRole: roleCanonicalizerFor(released.context.roleCodeAliases)(
          CAPTURED_ROLE,
        ),
        reopenedCustomItemRole: reopenedItem?.roleCode ?? null,
        reopenCode: reopened.ok ? null : reopened.code,
      }
    }

    const oldProbe = resolveRelease(OLD_RIGID_RELEASE)
    const newProbe = resolveRelease(NEW_RIGID_RELEASE)
    // Same-process re-resolution in both directions, after both sets have been served once.
    const oldAgain = resolveRelease(OLD_RIGID_RELEASE)
    const newAgain = resolveRelease(NEW_RIGID_RELEASE)
    // Interleaved resolution through the async scheduler, old/new alternating.
    const interleaved = await Promise.all(
      [OLD_RIGID_RELEASE, NEW_RIGID_RELEASE, OLD_RIGID_RELEASE, NEW_RIGID_RELEASE].map(
        async (releaseBundleId) => {
          await Promise.resolve()
          return resolveRelease(releaseBundleId).cardDigest
        },
      ),
    )

    // The old release's own reachable role surface, for the capture matrix. Derived from the
    // resolved context rather than hard-coded so the matrix keeps tracking the real data.
    const released = releaseBundles.buildReleaseContext(OLD_RIGID_RELEASE)
    let universe: WorldProbe['universe'] = {
      moduleSlotRole: null,
      modifierAddedRoles: [],
      rescueRole: null,
      compatibilityRole: null,
    }
    if (released.ok) {
      const { expandEffectiveSlots } =
        (await import('../domain/effective-slots')) as typeof import('../domain/effective-slots')
      const selection = {
        selectedModuleVersionIds: released.context.recipe.moduleReferences.map(
          (reference) => reference.moduleVersionId,
        ),
        modifierCodes: [] as string[],
      }
      const withoutApc = expandEffectiveSlots(selection, released.context).slots
      const withApc = expandEffectiveSlots(
        { ...selection, modifierCodes: ['APC'] },
        released.context,
      ).slots
      const baseSlotIds = new Set(withoutApc.map((slot) => slot.id))
      universe = {
        moduleSlotRole:
          withoutApc.find(
            (slot) =>
              (slot.sourceModuleVersionIds?.length ?? 0) > 0 &&
              slot.roleCode !== CAPTURED_ROLE &&
              slot.roleCode !== CAPTURE_TARGET,
          )?.roleCode ?? null,
        modifierAddedRoles: [
          ...new Set(
            withApc
              .filter((slot) => !baseSlotIds.has(slot.id))
              .map((slot) => slot.roleCode)
              .filter((roleCode) => roleCode !== CAPTURE_TARGET),
          ),
        ],
        rescueRole:
          released.context.rescueModules
            .flatMap((module) => module.slots)
            .map((slot) => slot.roleCode)
            .find((roleCode) => roleCode !== CAPTURED_ROLE && roleCode !== CAPTURE_TARGET) ?? null,
        compatibilityRole:
          released.context.compatibilityRules
            .map((rule) => rule.sourceRoleCode)
            .find((roleCode) => roleCode !== CAPTURED_ROLE && roleCode !== CAPTURE_TARGET) ?? null,
      }
    }

    probe = {
      old: oldProbe,
      new: newProbe,
      oldAgainDigest: oldAgain.cardDigest,
      newAgainDigest: newAgain.cardDigest,
      interleaved,
      universe,
    }
  })

  jest.dontMock(TAXONOMY_PATH)
  if (!probe) throw new Error('isolated taxonomy world did not produce a probe')
  return probe
}

/** The untouched world: the digests every extension scenario must reproduce byte-for-byte. */
let baseline: WorldProbe

beforeAll(async () => {
  baseline = await probeWorld({})
}, 120_000)

function expectByteIdenticalToBaseline(world: WorldProbe) {
  expect(world.old.ok).toBe(true)
  expect(world.new.ok).toBe(true)
  expect(world.old.cardDigest).toBe(baseline.old.cardDigest)
  expect(world.old.contextDigest).toBe(baseline.old.contextDigest)
  expect(world.new.cardDigest).toBe(baseline.new.cardDigest)
  expect(world.new.contextDigest).toBe(baseline.new.contextDigest)
  // The release context canonicalizes with the retained table, byte-equal to the baseline's.
  expect(world.old.contextAliases).toEqual(baseline.old.contextAliases)
  // The captured role keeps meaning itself inside the release.
  expect(world.old.canonicalizedCapturedRole).toBe(CAPTURED_ROLE)
  // The reopened stored line still carries the role the card recorded.
  expect(world.old.reopenedCustomItemRole).toBe(CAPTURED_ROLE)
}

function expectTypedFailureClosed(world: WorldProbe) {
  // Both the superseded and the current release refuse typed: the contradiction is with what
  // was *published*, and no release may resolve through either table while it stands.
  expect(world.old.ok).toBe(false)
  expect(world.old.code).toBe('release_pin_missing')
  expect(world.old.cardDigest).toBeNull()
  expect(world.old.reopenedCustomItemRole).toBeNull()
  expect(world.new.ok).toBe(false)
  expect(world.new.code).toBe('release_pin_missing')
}

describe('baseline world', () => {
  it('resolves both rigid releases and reopens the stored line under its saved role', () => {
    expect(baseline.old.ok).toBe(true)
    expect(baseline.new.ok).toBe(true)
    expect(baseline.old.canonicalizedCapturedRole).toBe(CAPTURED_ROLE)
    expect(baseline.old.reopenedCustomItemRole).toBe(CAPTURED_ROLE)
    expect(baseline.old.reopenCode).toBeNull()
  })

  it('derives a non-empty historical role universe from the release itself', () => {
    expect(baseline.universe.moduleSlotRole).not.toBeNull()
    expect(baseline.universe.modifierAddedRoles).toContain(CAPTURED_ROLE)
    expect(baseline.universe.rescueRole).not.toBeNull()
    expect(baseline.universe.compatibilityRole).not.toBeNull()
  })

  it('is stable across repeated and interleaved same-process resolution', () => {
    expect(baseline.oldAgainDigest).toBe(baseline.old.cardDigest)
    expect(baseline.newAgainDigest).toBe(baseline.new.cardDigest)
    expect(baseline.interleaved).toEqual([
      baseline.old.cardDigest,
      baseline.new.cardDigest,
      baseline.old.cardDigest,
      baseline.new.cardDigest,
    ])
  })
})

describe('capture attempts (live extensions that try to reinterpret historical roles)', () => {
  it('1. a direct new alias over an active historical role changes nothing historical', async () => {
    const world = await probeWorld({ addAliases: { [CAPTURED_ROLE]: CAPTURE_TARGET } })
    expectByteIdenticalToBaseline(world)
  }, 120_000)

  it('2. a two-hop capture through a new intermediate changes nothing historical', async () => {
    const world = await probeWorld({
      addAliases: {
        [CAPTURED_ROLE]: 'P92C1_INTERMEDIATE',
        P92C1_INTERMEDIATE: CAPTURE_TARGET,
      },
    })
    expectByteIdenticalToBaseline(world)
  }, 120_000)

  it('3. a chain inserted behind a retained alias target changes nothing historical', async () => {
    // PLEUROSCOPE → THORACOSCOPE_SEMIRIGID is retained; capturing the *target* is the chain
    // variant of the same attack, and single-hop pinned application must not follow it.
    const world = await probeWorld({
      addAliases: { THORACOSCOPE_SEMIRIGID: CAPTURE_TARGET },
    })
    expectByteIdenticalToBaseline(world)
    expect(
      Object.entries(world.old.contextAliases ?? {}).find(([source]) => source === 'PLEUROSCOPE'),
    ).toEqual(['PLEUROSCOPE', 'THORACOSCOPE_SEMIRIGID'])
  }, 120_000)

  it('4. a new alias over a historical module-slot role changes nothing historical', async () => {
    const role = baseline.universe.moduleSlotRole!
    const world = await probeWorld({
      addAliases: { [role]: role === CAPTURE_TARGET ? 'THORACOSCOPE_RIGID' : CAPTURE_TARGET },
    })
    expectByteIdenticalToBaseline(world)
  }, 120_000)

  it('5. a new alias over every historical modifier-added role changes nothing historical', async () => {
    const world = await probeWorld({
      addAliases: Object.fromEntries(
        baseline.universe.modifierAddedRoles.map((role) => [role, CAPTURE_TARGET]),
      ),
    })
    expectByteIdenticalToBaseline(world)
  }, 120_000)

  it('6. a new alias over a historical rescue role changes nothing historical', async () => {
    const role = baseline.universe.rescueRole!
    const world = await probeWorld({ addAliases: { [role]: CAPTURE_TARGET } })
    expectByteIdenticalToBaseline(world)
  }, 120_000)

  it('7. a new alias over a historical compatibility participant changes nothing historical', async () => {
    const role = baseline.universe.compatibilityRole!
    const world = await probeWorld({ addAliases: { [role]: CAPTURE_TARGET } })
    expectByteIdenticalToBaseline(world)
  }, 120_000)

  it('11. no live alias source collides with an active catalog role, and a synthetic collision cannot reach a release', async () => {
    // The live-data invariant over the real committed catalog: alias sources are retired
    // codes, never active ones. A future commit that turns an active role into an alias
    // source fails this suite before it can ship.
    const activeRoleCodes = new Set(getCatalogStore().roleByCode.keys())
    for (const aliasSource of Object.keys(ROLE_CODE_ALIASES)) {
      expect(activeRoleCodes.has(aliasSource)).toBe(false)
    }
    // And when one is doctored in anyway, the pinned releases resolve exactly as before —
    // the collision never reaches historical semantics (case 1 is the APC instance of this).
    const world = await probeWorld({ addAliases: { [CAPTURED_ROLE]: CAPTURE_TARGET } })
    expect(world.old.cardDigest).toBe(baseline.old.cardDigest)
  }, 120_000)
})

describe('contradictions (live changes that rewrite what a release retained)', () => {
  it('8. retargeting a retained alias fails both releases typed', async () => {
    const world = await probeWorld({
      retargetAliases: { PLEUROSCOPE: 'P92C1_SOMEWHERE_ELSE' },
    })
    expectTypedFailureClosed(world)
  }, 120_000)

  it('9. removing a retained category fails both releases typed', async () => {
    const world = await probeWorld({ dropCategories: ['Laser'] })
    expectTypedFailureClosed(world)
  }, 120_000)

  it('10. changing a retained category override fails both releases typed', async () => {
    const world = await probeWorld({
      replaceOverrides: { ENERGY_PLATFORM: 'Laser' },
    })
    expectTypedFailureClosed(world)
  }, 120_000)
})

describe('benign extensions (the forward path stays open)', () => {
  it('12. a new alias that intersects nothing historical leaves everything byte-identical', async () => {
    const world = await probeWorld({
      addAliases: { P92C1_RETIRED_CODE_NEVER_USED: CAPTURE_TARGET },
    })
    expectByteIdenticalToBaseline(world)
  }, 120_000)

  it('13. a new category leaves everything byte-identical', async () => {
    const world = await probeWorld({ addCategories: ['P92-C1 synthetic section'] })
    expectByteIdenticalToBaseline(world)
  }, 120_000)
})

describe('same-process stability under a live extension', () => {
  it('14/15. old→new→old, new→old→new, and interleaved resolution stay byte-identical', async () => {
    const world = await probeWorld({ addAliases: { [CAPTURED_ROLE]: CAPTURE_TARGET } })
    expect(world.oldAgainDigest).toBe(baseline.old.cardDigest)
    expect(world.newAgainDigest).toBe(baseline.new.cardDigest)
    expect(world.interleaved).toEqual([
      baseline.old.cardDigest,
      baseline.new.cardDigest,
      baseline.old.cardDigest,
      baseline.new.cardDigest,
    ])
  }, 120_000)
})
