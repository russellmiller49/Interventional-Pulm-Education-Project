/** @jest-environment node */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  claimById,
  claimRegister,
  claimRegisterSchema,
  claims,
  claimsBlockingPublication,
  claimStanding,
} from '../content/claimRegister'
import {
  deviceDefinitions,
  deviceDefinitionsSchema,
  factOf,
  prototypeDevices,
  publishedNumber,
} from '../content/deviceDefinitions'
import { NOT_A_REVIEWER, reviewDecisionSchema, type ReviewDecision } from '../content/reviewRecords'
import { KNOWN_SOURCE_IDS, literatureSources, sourceRegister } from '../content/sources'
import {
  assetLedgerSchema,
  performanceTableSchema,
  rightsRegisterSchema,
  traceabilitySchema,
} from '../test-support/registerSchemas'
import { normalisePage, REGISTER_PAGES } from '../test-support/renderRegisters'

/**
 * The registers enforce honesty, not correctness. They cannot tell whether a dimension is right
 * or a claim is true. They can tell that every entry says what kind of claim it is, where it was
 * read, that nothing is marked reviewed without a named person, and that nothing unmeasured is
 * reported as measured.
 */
const root = process.cwd()

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(root, path), 'utf8'))
}

const manifest = readJson('docs/medical-thoracoscopy/implementation-manifest.json') as {
  learnSections: { id: string; number: number }[]
  budgets: { items: { name: string; limit: number }[] }
}
const sectionIds = new Set(manifest.learnSections.map((section) => section.id))

const rights = rightsRegisterSchema.parse(
  readJson('docs/medical-thoracoscopy/registers/rights-register.json'),
)
const ledger = assetLedgerSchema.parse(
  readJson('docs/medical-thoracoscopy/registers/asset-ledger.json'),
)
const performance = performanceTableSchema.parse(
  readJson('docs/medical-thoracoscopy/registers/performance-table.json'),
)
const traceability = traceabilitySchema.parse(
  readJson('docs/medical-thoracoscopy/registers/traceability.json'),
)

const notReviewed: ReviewDecision = {
  decision: 'NOT REVIEWED',
  reviewer: null,
  role: null,
  date: null,
  reviewedRevision: null,
}

const recorded: ReviewDecision = {
  decision: 'accepted',
  reviewer: 'A. Reviewer',
  role: 'Clinical reviewer',
  date: '2026-10-01',
  reviewedRevision: '3bc13220',
}

/**
 * Every decision recorded anywhere in the registers, by the id of the thing decided. It is empty
 * because nobody has reviewed anything. A reviewer who records a decision adds its id here
 * themselves. An agent never does.
 */
const DECISIONS_RECORDED_BY_A_REVIEWER: readonly string[] = []

function decidedIds(): string[] {
  const decided: string[] = []
  const note = (id: string, decision: ReviewDecision) => {
    if (decision.decision !== 'NOT REVIEWED') decided.push(id)
  }
  for (const device of deviceDefinitions.devices) {
    for (const entry of device.facts) note(`${device.id}.${entry.key}`, entry.factCheck)
  }
  for (const entry of deviceDefinitions.fit) note(`fit:${entry.id}`, entry.factCheck)
  for (const claim of claims) note(claim.id, claim.decision)
  for (const item of rights.items) note(item.id, item.decision)
  return decided.sort()
}

describe('a review decision', () => {
  it('may be empty, with nothing recorded beside it', () => {
    expect(reviewDecisionSchema.safeParse(notReviewed).success).toBe(true)
    expect(
      reviewDecisionSchema.safeParse({ ...notReviewed, reviewer: 'A. Reviewer' }).success,
    ).toBe(false)
    expect(reviewDecisionSchema.safeParse({ ...notReviewed, date: '2026-10-01' }).success).toBe(
      false,
    )
  })

  it('needs a reviewer, a role, a date and the revision reviewed', () => {
    expect(reviewDecisionSchema.safeParse(recorded).success).toBe(true)
    for (const field of ['reviewer', 'role', 'date', 'reviewedRevision'] as const) {
      expect(reviewDecisionSchema.safeParse({ ...recorded, [field]: null }).success).toBe(false)
    }
    expect(reviewDecisionSchema.safeParse({ ...recorded, date: 'October 2026' }).success).toBe(
      false,
    )
  })

  it.each(['Claude', 'Codex', 'GPT-5', 'AI assistant', 'an LLM', 'review bot'])(
    'is never recorded by %s',
    (reviewer) => {
      expect(NOT_A_REVIEWER.test(reviewer)).toBe(true)
      expect(reviewDecisionSchema.safeParse({ ...recorded, reviewer }).success).toBe(false)
    },
  )

  it('has been recorded by nobody yet', () => {
    expect(decidedIds()).toEqual([...DECISIONS_RECORDED_BY_A_REVIEWER].sort())
  })
})

describe('device definitions', () => {
  it('say what they are', () => {
    expect(deviceDefinitions.statement).toMatch(/Nothing here has been fact-checked/)
    expect(deviceDefinitions.statement).toMatch(/dimensional comparison is not a statement/i)
    expect(deviceDefinitions.units).toEqual({ length: 'mm', angle: 'deg' })
    expect(deviceDefinitions.preparedBy).toMatch(/AI authoring assistant/)
  })

  it('load three parts for the week-4 pages', () => {
    expect(prototypeDevices.map((device) => device.id)).toEqual([
      'operative-telescope',
      'trocar-sleeve-flexible',
      'double-spoon-forceps',
    ])
  })

  it('give the published dimensions the space engine is built on', () => {
    expect(publishedNumber('operative-telescope', 'shaftOuterDiameter')).toBe(5.5)
    expect(publishedNumber('operative-telescope', 'shaftLength')).toBe(215)
    expect(publishedNumber('operative-telescope', 'totalLength')).toBe(370)
    expect(publishedNumber('operative-telescope', 'workingChannelDiameter')).toBe(3.5)
    expect(publishedNumber('trocar-sleeve-flexible', 'capacity')).toBe(5.7)
    expect(publishedNumber('trocar-sleeve-flexible', 'workingLength')).toBe(60)
    expect(publishedNumber('double-spoon-forceps', 'shaftOuterDiameter')).toBe(3.5)
    expect(publishedNumber('double-spoon-forceps', 'sheathLength')).toBe(330)
    expect(publishedNumber('double-spoon-forceps', 'jawLength')).toBe(12)
  })

  it('refuse to hand out a value that is not known', () => {
    expect(factOf('operative-telescope', 'fieldOfView').value).toBeNull()
    expect(() => publishedNumber('operative-telescope', 'fieldOfView')).toThrow(
      /no numeric value \(unresolved input\)/,
    )
    expect(() => publishedNumber('trocar-sleeve-flexible', 'outerDiameter')).toThrow()
    expect(() => factOf('operative-telescope', 'weight')).toThrow(/Unknown fact/)
  })

  it('name a document for every device fact that has a value', () => {
    for (const device of deviceDefinitions.devices) {
      for (const entry of device.facts) {
        if (entry.category === 'device fact' && entry.value !== null) {
          expect(entry.sources.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('never describe a measurement or an assumption as a device fact', () => {
    for (const device of deviceDefinitions.devices) {
      for (const entry of device.facts) {
        if (entry.category !== 'device fact') {
          // Nothing has been measured or chosen yet, so each of these is still missing.
          expect(entry.sources).toEqual([])
          expect(entry.value).toBeNull()
          expect(entry.status).toBe('unresolved input')
        }
      }
    }
  })

  it('point every missing value at sections that exist', () => {
    const missing = deviceDefinitions.devices.flatMap((device) =>
      device.facts.filter((entry) => entry.value === null),
    )

    expect(missing.length).toBeGreaterThan(0)
    for (const entry of missing) {
      for (const id of entry.neededBy ?? []) expect(sectionIds.has(id)).toBe(true)
    }
  })

  it('mark a value the documents disagree on, without listing the other values', () => {
    const disputed = deviceDefinitions.devices.flatMap((device) =>
      device.facts
        .filter((entry) => /documents differ/i.test(entry.note ?? ''))
        .map((entry) => ({ device: device.id, entry })),
    )

    expect(disputed.map(({ device, entry }) => `${device}.${entry.key}`).sort()).toEqual([
      'light-cable.diameter',
      'light-cable.totalLength',
      'operative-telescope.imageTransmission',
      'probe.workingLength',
      'suction-tube.outerDiameter',
      'trocar-sleeve-flexible.workingLength',
    ])
    for (const { entry } of disputed) {
      expect(entry.status).toBe('unresolved input')
      expect(entry.note).not.toMatch(/\d/)
    }
  })

  it('never rest a fit on diameters', () => {
    for (const entry of deviceDefinitions.fit) {
      expect(entry.basis).not.toMatch(/\d|diameter|narrower|smaller|fits/i)
      if (entry.status === 'documented compatible') {
        expect(entry.sources.length).toBeGreaterThan(0)
      }
    }
    expect(deviceDefinitions.fit.find((entry) => entry.id === 'telescope-to-tower')?.status).toBe(
      'not established',
    )
  })

  it('reject a fit documented by nothing, and a device fact read nowhere', () => {
    const copy = JSON.parse(JSON.stringify(deviceDefinitions)) as typeof deviceDefinitions
    copy.fit[0].sources = []
    expect(deviceDefinitionsSchema.safeParse(copy).success).toBe(false)

    const second = JSON.parse(JSON.stringify(deviceDefinitions)) as typeof deviceDefinitions
    second.devices[0].facts[0].sources = []
    expect(deviceDefinitionsSchema.safeParse(second).success).toBe(false)

    const third = JSON.parse(JSON.stringify(deviceDefinitions)) as typeof deviceDefinitions
    third.devices[0].facts[0].sources = [{ document: 'S-NOWHERE', locator: 'page 1' }]
    expect(deviceDefinitionsSchema.safeParse(third).success).toBe(false)
  })

  it('carry no manufacturer wording: no superlatives, no promotion', () => {
    const text = JSON.stringify(deviceDefinitions.devices)

    expect(text).not.toMatch(
      /\b(unique|best|superior|leading|optimum|optimal|maximum versatility|atraumatic|future of)\b/i,
    )
  })
})

describe('source register', () => {
  it('says how much of each source was read', () => {
    expect(sourceRegister.statement).toMatch(/No source has been read in full/)
    for (const source of literatureSources) {
      expect(source.checked.read).not.toBe('full text')
      expect(source.limits).toMatch(/not read|not been read/i)
    }
  })

  it('lists the nine citations checked, each once', () => {
    expect(literatureSources.map((source) => source.id)).toEqual([
      'bts-pleural-guideline-2023',
      'bts-pleural-guideline-2023-summary',
      'bts-pleural-procedures-2023',
      'ers-eacts-mpe-2018',
      'ats-sts-str-mpe-2018',
      'wabip-aabip-benign-2026',
      'tapps-2020',
      'tactic-2026',
      'wang-artificial-pneumothorax-2026',
    ])
  })

  it('keeps the cautions the revised plan asks for', () => {
    const limits = (id: string) => literatureSources.find((source) => source.id === id)?.limits

    expect(limits('wabip-aabip-benign-2026')).toMatch(/benign pleural disease/)
    expect(limits('wabip-aabip-benign-2026')).toMatch(/consensus statement/)
    expect(limits('tactic-2026')).toMatch(/not evidence of equivalence/)
    expect(limits('wang-artificial-pneumothorax-2026')).toMatch(/minimal or absent/)
    expect(limits('wang-artificial-pneumothorax-2026')).toMatch(/not a general rule/)
  })

  it('records the anatomy dataset with its licence and an unverified identity', () => {
    expect(sourceRegister.datasets).toHaveLength(1)
    const [dataset] = sourceRegister.datasets

    expect(dataset.doi).toBe('10.5281/zenodo.10069289')
    expect(dataset.licenceShort).toBe('CC BY 4.0')
    expect(dataset.identity.status).toBe('unresolved input')
    expect(dataset.identity.note).toMatch(/has not been compared/)
  })

  it('offers claims every article, dataset and manufacturer document to cite', () => {
    expect(KNOWN_SOURCE_IDS.has('bts-pleural-procedures-2023')).toBe(true)
    expect(KNOWN_SOURCE_IDS.has('aeropath-2023')).toBe(true)
    expect(KNOWN_SOURCE_IDS.has('S-US')).toBe(true)
    expect(KNOWN_SOURCE_IDS.has('S-GUDID')).toBe(true)
  })
})

describe('claim register', () => {
  it('says that nothing in it is approval', () => {
    expect(claimRegister.statement).toMatch(/Nothing in this register is clinical approval/)
    expect(claimRegister.statement).toMatch(/an empty decision is not approval/)
  })

  it('points every claim at surfaces that exist in the plan', () => {
    expect(claims.map((claim) => claim.id)).toEqual(['MT-C-0001', 'MT-C-0002', 'MT-C-0003'])
    for (const claim of claims) {
      for (const surface of claim.surfaces) {
        if (surface.kind === 'section') expect(sectionIds.has(surface.id)).toBe(true)
        expect(surface.state).toBe('planned')
      }
    }
  })

  it('lets a lesson show an unreviewed relationship only under its label', () => {
    expect(claimStanding(claimById('MT-C-0001'))).toEqual({
      kind: 'shown-with-label',
      learnerLabel: 'Awaiting clinical review',
    })
    expect(claimStanding(claimById('MT-C-0002'))).toEqual({
      kind: 'shown-with-label',
      learnerLabel: 'Authored, illustrative',
    })
  })

  it('treats a claim as accepted only when a reviewer accepted it', () => {
    const claim = claimById('MT-C-0001')

    expect(claimStanding({ ...claim, decision: recorded })).toEqual({ kind: 'accepted' })
    expect(claimStanding({ ...claim, decision: { ...recorded, decision: 'held' } })).toEqual({
      kind: 'not-modeled',
    })
    expect(claimStanding({ ...claim, decision: { ...recorded, decision: 'rejected' } })).toEqual({
      kind: 'not-modeled',
    })
    expect(
      claimStanding({
        ...claim,
        shownBeforeReview: { ...claim.shownBeforeReview, allowed: false },
      }),
    ).toEqual({ kind: 'not-modeled' })
  })

  it('blocks publication while any claim is not accepted', () => {
    expect(claimsBlockingPublication().map((claim) => claim.id)).toEqual([
      'MT-C-0001',
      'MT-C-0002',
      'MT-C-0003',
    ])
  })

  it('refuses the entries that would make it dishonest', () => {
    const base = JSON.parse(JSON.stringify(claimRegister)) as typeof claimRegister
    const withClaim = (change: (claim: (typeof base.claims)[number]) => void) => {
      const copy = JSON.parse(JSON.stringify(base)) as typeof base
      change(copy.claims[0])
      return claimRegisterSchema.safeParse(copy).success
    }

    // Clinical evidence with no source.
    expect(
      withClaim((claim) => {
        claim.category = 'clinical evidence'
        claim.shownBeforeReview.allowed = false
      }),
    ).toBe(false)
    // Accepted status with no decision behind it.
    expect(
      withClaim((claim) => {
        claim.status = 'accepted with attributable approval'
      }),
    ).toBe(false)
    // Not accepted, yet not blocking publication.
    expect(
      withClaim((claim) => {
        claim.blocksPublication = false
      }),
    ).toBe(false)
    // A source nobody registered.
    expect(
      withClaim((claim) => {
        claim.sources = [
          {
            source: 'a-textbook',
            locator: 'chapter 47',
            read: 'full text',
            supports: 'Everything',
          },
        ]
      }),
    ).toBe(false)
    // A device fact kept in the wrong register.
    expect(
      withClaim((claim) => {
        claim.category = 'device fact'
      }),
    ).toBe(false)
  })
})

describe('rights register', () => {
  it('stops the anatomy and the device models being uploaded', () => {
    expect(
      rights.items
        .filter((item) => item.blocksUpload)
        .map((item) => item.id)
        .sort(),
    ).toEqual(['R-ANATOMY-CT', 'R-ANATOMY-SEGMENTATION', 'R-DEVICE-MODELS'])
  })

  it('keeps manufacturer images and documents out of the repository', () => {
    for (const id of ['R-MANUFACTURER-IMAGES', 'R-MANUFACTURER-DOCUMENTS']) {
      const item = rights.items.find((entry) => entry.id === id)

      expect(item?.inRepository).toBe(false)
    }
    expect(rights.items.find((entry) => entry.id === 'R-MANUFACTURER-IMAGES')?.use).toMatch(
      /Never committed, never uploaded/,
    )
  })

  it('records where each item can already be obtained, and approves none of it', () => {
    for (const item of rights.items) {
      expect(item.exposure.length).toBeGreaterThan(0)
      expect(item.decision.decision).toBe('NOT REVIEWED')
    }
    expect(rights.statement).toMatch(/repository is public/)
    // the models and the anatomy-derived records are in the public repository, upload block or not
    for (const id of ['R-DEVICE-MODELS', 'R-ANATOMY-SEGMENTATION']) {
      expect(rights.items.find((entry) => entry.id === id)?.exposure).toMatch(
        /public repository[\s\S]*not approved/,
      )
    }
  })

  it('claims no terms it has not read', () => {
    const segmentation = rights.items.find((entry) => entry.id === 'R-ANATOMY-SEGMENTATION')

    expect(segmentation?.terms).toBe('Not established')
    expect(segmentation?.permits).toBe('Not established')
    expect(segmentation?.status).toBe('unresolved input')
  })
})

describe('asset ledger', () => {
  it('is empty until the first asset is built', () => {
    expect(ledger.assets).toEqual([])
    expect(ledger.scenes).toEqual([])
  })

  it('carries the imported budgets unchanged', () => {
    const imported = Object.fromEntries(
      manifest.budgets.items.map((item) => [item.name, item.limit]),
    )

    expect(ledger.budgets).toEqual({
      source: 'docs/medical-thoracoscopy/implementation-manifest.json, budgets',
      pleuralScenePayloadMb: imported['pleural-space scene payload'],
      anatomyGlbMb: imported['anatomy GLB'],
      deviceGlbMb: imported['device GLB'],
      deviceGlbTriangles: imported['device GLB triangles'],
      textureEdgePx: imported['texture edge'],
      renderedTrianglesHigh: imported['rendered triangles, high quality'],
      renderedTrianglesLow: imported['rendered triangles, low quality'],
      drawCalls: imported['draw calls'],
      collisionProxyTriangles: imported['collision proxy triangles'],
      coverageUpdateMs: imported['coverage update'],
    })
  })

  it('reports download size apart from decoded cost', () => {
    expect(ledger.statement).toMatch(/small download is not evidence/)
  })

  it('says that the public repository exposes what it lists, uploaded or not', () => {
    expect(ledger.exposure).toMatch(/repository is public/)
  })

  it('lists every anatomy-derived record the repository carries, once', () => {
    const folder = 'src/features/medical-thoracoscopy/content/data/anatomy'
    const carried = existsSync(join(process.cwd(), folder))
      ? readdirSync(join(process.cwd(), folder))
          .filter((name) => name.endsWith('.json'))
          .map((name) => `${folder}/${name}`)
          .sort()
      : []

    expect(ledger.bundledRecords.map((record) => record.path).sort()).toEqual(carried)
  })
})

describe('performance table', () => {
  it('reports nothing as measured', () => {
    expect(performance.results.map((entry) => entry.target)).toEqual(
      performance.targets.map((target) => target.id),
    )
    for (const entry of performance.results) {
      expect(entry.result).toBe('NOT TESTED')
      expect(entry.reason).toBeTruthy()
      expect(entry.measurement).toBeUndefined()
    }
  })

  it('leaves open what the plans leave open', () => {
    for (const target of performance.targets) {
      expect(target.browser).toBe('UNRESOLVED')
    }
    expect(performance.statement).toMatch(/emulation of a phone or tablet is not a measurement/)
  })

  it('accepts a result only with its measurement', () => {
    const copy = JSON.parse(JSON.stringify(performance)) as typeof performance
    copy.results[0] = { target: 'PT-1', result: 'met' }

    // The shape allows it; the rule below does not.
    const unsupported = copy.results.filter(
      (entry) => entry.result !== 'NOT TESTED' && entry.measurement === undefined,
    )
    expect(unsupported.map((entry) => entry.target)).toEqual(['PT-1'])
    expect(
      performance.results.filter(
        (entry) => entry.result !== 'NOT TESTED' && entry.measurement === undefined,
      ),
    ).toEqual([])
    expect(
      performance.results.filter(
        (entry) => entry.result === 'met' && entry.measurement?.emulated === true,
      ),
    ).toEqual([])
  })
})

describe('traceability', () => {
  it('follows the first round: three sections and one prototype', () => {
    expect(traceability.rows.map((row) => row.experience)).toEqual([
      'normal-pleural-space',
      'four-controls',
      'systematic-survey',
      'tool-contact',
    ])
  })

  it('names sections and claims that exist', () => {
    const known = new Set(claims.map((claim) => claim.id))

    for (const row of traceability.rows) {
      if (row.kind === 'section') {
        expect(sectionIds.has(row.experience)).toBe(true)
        expect(
          manifest.learnSections.find((section) => section.id === row.experience)?.number,
        ).toBe(row.number)
      }
      for (const id of row.claims) expect(known.has(id)).toBe(true)
    }
  })

  it('lists as missing exactly the links that are empty', () => {
    for (const row of traceability.rows) {
      const empty = [
        row.content.length === 0 ? 'content' : null,
        row.assets.length === 0 ? 'assets' : null,
        row.tests.length === 0 ? 'tests' : null,
        row.reviewDecisions.length === 0 ? 'review decisions' : null,
        row.releaseEvidence.length === 0 ? 'release evidence' : null,
      ].filter((entry): entry is string => entry !== null)

      expect(row.missing).toEqual(empty)
      if (row.state === 'complete') expect(row.missing).toEqual([])
    }
  })
})

describe('printed register pages', () => {
  it.each(REGISTER_PAGES.map((page) => [page.path, page] as const))(
    '%s matches its register',
    (_path, page) => {
      const current = readFileSync(join(root, page.path), 'utf8')

      expect(normalisePage(current)).toBe(normalisePage(page.render()))
    },
  )
})

describe('attribution', () => {
  const attribution = readFileSync(join(root, 'docs/medical-thoracoscopy/ATTRIBUTION.md'), 'utf8')

  it('credits the dataset, links the licence and says the material was changed', () => {
    const [dataset] = sourceRegister.datasets

    expect(attribution).toContain(dataset.doi)
    expect(attribution).toContain(dataset.describedIn.doi)
    expect(attribution).toContain('https://creativecommons.org/licenses/by/4.0/')
    expect(attribution).toMatch(/modified/i)
  })

  it('does not claim the identity of the scan is verified', () => {
    expect(attribution).toMatch(/has not been verified/i)
  })
})
