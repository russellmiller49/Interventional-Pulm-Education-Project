/** @jest-environment node */
import { readFileSync } from 'node:fs'
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
  formOf,
  MEASURED_FROM,
  modelledNumber,
  prototypeDevices,
  publishedNumber,
} from '../content/deviceDefinitions'
import {
  measurementById,
  referenceMeasurements,
  referenceMeasurementsSchema,
} from '../content/referenceMeasurements'
import { curriculumSections } from '../content/curriculum'
import { NOT_A_REVIEWER, reviewDecisionSchema, type ReviewDecision } from '../content/reviewRecords'
import {
  KNOWN_SOURCE_IDS,
  literatureSourceById,
  literatureSources,
  sourceRegister,
} from '../content/sources'
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
    for (const entry of device.forms) note(`${device.id}.${entry.key}`, entry.factCheck)
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

  it('load three parts for the week-4 pages, held to the full standard', () => {
    expect(prototypeDevices.map((device) => device.id)).toEqual([
      'operative-telescope',
      'trocar-sleeve-flexible',
      'double-spoon-forceps',
    ])
    for (const device of deviceDefinitions.devices) {
      if (device.inPrototype) expect(device.standard).toBe('full')
      else expect(device.standard).not.toBe('full')
    }
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
    expect(factOf('probe', 'graduationInterval').value).toBeNull()
    expect(() => publishedNumber('probe', 'graduationInterval')).toThrow(
      /no numeric value \(unresolved input\)/,
    )
    expect(() => modelledNumber('probe', 'graduationInterval')).toThrow(/no numeric value/)
    expect(() => factOf('operative-telescope', 'weight')).toThrow(/Unknown fact/)
    expect(() => formOf('operative-telescope', 'handle')).toThrow(/Unknown form/)
  })

  it('never hand out a measured or authored value as a published one', () => {
    expect(() => publishedNumber('operative-telescope', 'fieldOfView')).toThrow(
      /not a device fact \(authored simulation assumption\)/,
    )
    expect(() => publishedNumber('trocar-sleeve-flexible', 'outerDiameter')).toThrow(
      /not a device fact \(derived measurement\)/,
    )
    expect(modelledNumber('operative-telescope', 'fieldOfView')).toEqual({
      value: 75,
      unit: 'deg',
      category: 'authored simulation assumption',
      tolerance: null,
    })
    expect(modelledNumber('trocar-sleeve-flexible', 'outerDiameter')).toMatchObject({
      category: 'derived measurement',
      tolerance: measurementById('sleeve.tubeOuterDiameter').tolerance,
    })
    expect(modelledNumber('operative-telescope', 'shaftLength')).toEqual({
      value: 215,
      unit: 'mm',
      category: 'device fact',
      tolerance: null,
    })
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

  it('copy every measured value from the measurement record, with its tolerance', () => {
    const measured = deviceDefinitions.devices.flatMap((device) =>
      device.facts.filter(
        (entry) => entry.category === 'derived measurement' && entry.value !== null,
      ),
    )

    expect(measured.length).toBeGreaterThan(20)
    for (const entry of measured) {
      const [first] = entry.measurement ?? []
      const record = measurementById(first)

      expect('value' in record && record.value).toBe(entry.value)
      expect(entry.tolerance).toBe(record.tolerance)
      expect(entry.unit).toBe(record.unit)
      expect(entry.sources).toEqual([{ document: MEASURED_FROM, locator: `frame ${record.frame}` }])
      expect(entry.status).toBe('review pending')
    }
  })

  it('copy every measured outline from the record', () => {
    const body = formOf('operative-telescope', 'bodyOutline')
    const bodyRecord = measurementById('telescope.bodyOutline')
    expect('points' in bodyRecord && bodyRecord.points).toEqual(body.points)
    expect(body.tolerance).toBe(bodyRecord.tolerance)

    // The channel is measured in units of the inner wall radius and kept here in millimetres.
    const channel = formOf('operative-telescope', 'channelOutline')
    const channelRecord = measurementById('telescope.channelOutline')
    const inner =
      publishedNumber('operative-telescope', 'shaftOuterDiameter') / 2 -
      modelledNumber('operative-telescope', 'wallThickness').value
    const expected =
      'points' in channelRecord
        ? channelRecord.points.map(([height, half]) => [height * inner, half * inner])
        : []
    expect(channel.points).toHaveLength(expected.length)
    channel.points?.forEach(([height, half], index) => {
      expect(height).toBeCloseTo(expected[index][0], 3)
      expect(half).toBeCloseTo(expected[index][1], 3)
    })
  })

  it('leave unmeasured values empty, and say how every authored value was chosen', () => {
    for (const device of deviceDefinitions.devices) {
      for (const entry of [...device.facts, ...device.forms]) {
        const value = 'value' in entry ? entry.value : true
        if (entry.category === 'derived measurement' && value === null) {
          expect(entry.sources).toEqual([])
          expect(entry.status).toBe('unresolved input')
        }
        if (entry.category === 'authored simulation assumption') {
          expect(entry.note).toMatch(/authored|drawn|assumed|chosen|stand-in|not measured/i)
          expect(entry.status).toBe('unresolved input')
          for (const source of entry.sources) expect(source.document).toBe(MEASURED_FROM)
        }
      }
    }
  })

  it('refuse a measured value without its measurement or its tolerance', () => {
    const lookUp = (copy: typeof deviceDefinitions) =>
      copy.devices
        .find((device) => device.id === 'operative-telescope')
        ?.facts.find((entry) => entry.key === 'eyepieceAngle')
    const withoutTolerance = JSON.parse(
      JSON.stringify(deviceDefinitions),
    ) as typeof deviceDefinitions
    delete lookUp(withoutTolerance)?.tolerance
    expect(deviceDefinitionsSchema.safeParse(withoutTolerance).success).toBe(false)

    const withoutFrame = JSON.parse(JSON.stringify(deviceDefinitions)) as typeof deviceDefinitions
    const entry = lookUp(withoutFrame)
    if (entry) entry.sources = [{ document: 'S-US', locator: 'page 2' }]
    expect(deviceDefinitionsSchema.safeParse(withoutFrame).success).toBe(false)

    const publishedWithTolerance = JSON.parse(
      JSON.stringify(deviceDefinitions),
    ) as typeof deviceDefinitions
    const shaft = publishedWithTolerance.devices[0].facts.find(
      (candidate) => candidate.key === 'shaftLength',
    )
    if (shaft) shaft.tolerance = 1
    expect(deviceDefinitionsSchema.safeParse(publishedWithTolerance).success).toBe(false)
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

describe('reference measurements', () => {
  it('are the record the measuring script wrote, and hold numbers only', () => {
    expect(referenceMeasurementsSchema.safeParse(referenceMeasurements).success).toBe(true)
    expect(referenceMeasurements.statement).toMatch(/no image is/)
    expect(referenceMeasurements.statement).toMatch(/not a\s+device fact/)
    expect(JSON.stringify(referenceMeasurements)).not.toMatch(/data:image|base64|\.png"\s*:/)
  })

  it('name the presentation the device definitions cite, by the same hash', () => {
    const frames = deviceDefinitions.documents.find((document) => document.id === MEASURED_FROM)

    expect(frames?.kind).toBe('manufacturer product animation')
    expect(frames?.sha256).toBe(referenceMeasurements.document.sha256)
    expect(frames?.url).toBeNull()
  })

  it('rest on the published values the definitions still give', () => {
    for (const [path, value] of Object.entries(referenceMeasurements.publishedValuesUsed)) {
      const [device, key] = path.split('.')
      expect(publishedNumber(device, key)).toBe(value)
    }
  })

  it('cover every measurement the definitions name', () => {
    const named = deviceDefinitions.devices.flatMap((device) =>
      [...device.facts, ...device.forms].flatMap((entry) => entry.measurement ?? []),
    )

    expect(named.length).toBeGreaterThan(20)
    for (const id of named) expect(() => measurementById(id)).not.toThrow()
  })

  it('agree between two views of the same eyepiece, within their tolerances', () => {
    for (const [first, second] of [
      ['telescope.eyepieceAngle', 'telescope.eyepieceAngleSecondView'],
      ['telescope.eyepieceMeetsShaftAt', 'telescope.eyepieceMeetsShaftSecondView'],
    ]) {
      const a = measurementById(first)
      const b = measurementById(second)
      if (!('value' in a) || !('value' in b)) throw new Error('expected single values')

      expect(a.frame).not.toBe(b.frame)
      expect(Math.abs(a.value - b.value)).toBeLessThanOrEqual(a.tolerance + b.tolerance)
    }
  })

  it('record a tolerance for every value, from the variations listed for its frame', () => {
    for (const entry of referenceMeasurements.measurements) {
      expect(entry.tolerance).toBeGreaterThan(0)
      expect(referenceMeasurements.variations[String(entry.frame)].length).toBeGreaterThan(0)
    }
  })
})

describe('source register', () => {
  it('says how much of each source was read, and names the parts of one read in part', () => {
    expect(sourceRegister.statement).toMatch(/Read says how much of each source was read/)
    for (const source of literatureSources) {
      if (source.checked.readParts) {
        expect(source.checked.read).toBe('full text')
        expect(source.limits).toMatch(/Read only in the parts named/)
      } else if (source.checked.read === 'full text') {
        expect(source.limits).toMatch(/Read in full|has not been read/)
      } else {
        expect(source.limits).toMatch(/not read|not been read/i)
      }
    }
    expect(literatureSourceById('bts-pleural-procedures-2023').checked.readParts).toMatch(
      /medical thoracoscopy section/,
    )
  })

  it('lists the citations checked, each once', () => {
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
      'jin-consensus-2020',
      'gallagher-fulcrum-1998',
      'nccp-ics-thoracoscopy-2024',
      'bhatnagar-advanced-interventions-2016',
      'li-lat-review-2022',
      'charalampidis-pleura-anatomy-2015',
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

  it('points every claim at surfaces that exist, written only where the section is written', () => {
    expect(claims.map((claim) => claim.id)).toEqual(
      Array.from({ length: 23 }, (_, n) => `MT-C-${String(n + 1).padStart(4, '0')}`),
    )
    for (const claim of claims) {
      for (const surface of claim.surfaces) {
        if (surface.kind === 'section') {
          expect(sectionIds.has(surface.id)).toBe(true)
          const written = curriculumSections.find((section) => section.id === surface.id)?.state
          expect(surface.state).toBe(written === 'in-preparation' ? 'planned' : 'written')
        } else if (surface.kind === 'asset') {
          const built = ['thorax-surfaces', 'survey-zones', 'port-record', 'lung-states'].includes(
            surface.id,
          )
          expect(surface.state).toBe(built ? 'written' : 'planned')
        } else {
          expect(surface.state).toBe('planned')
        }
      }
    }
  })

  it('keeps every clinical statement from being shown as fact before review', () => {
    for (const claim of claims.filter((entry) => entry.category === 'clinical evidence')) {
      expect(claim.sources.length).toBeGreaterThan(0)
      expect(claimStanding(claim)).toEqual({ kind: 'not-modeled' })
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
    expect(claimsBlockingPublication().map((claim) => claim.id)).toEqual(
      claims.map((claim) => claim.id),
    )
    expect(claims.every((claim) => claim.decision.decision === 'NOT REVIEWED')).toBe(true)
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
        claim.sources = []
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

  it('claims no terms it has not read', () => {
    const segmentation = rights.items.find((entry) => entry.id === 'R-ANATOMY-SEGMENTATION')

    expect(segmentation?.terms).toBe('Not established')
    expect(segmentation?.permits).toBe('Not established')
    expect(segmentation?.status).toBe('unresolved input')
  })
})

describe('asset ledger', () => {
  it('lists the device kit and the anatomy, and nothing uploaded', () => {
    expect(ledger.assets.length).toBeGreaterThan(0)
    for (const asset of ledger.assets) {
      expect(asset.uploaded).toBe(false)
      if (asset.path.startsWith('public/models/medical-thoracoscopy/v1/devices/')) {
        expect(asset.label).toBe(deviceDefinitions.labelUntilCad)
        expect(asset.inRepository).toBe(true)
      } else {
        expect(asset.path).toMatch(/^public\/models\/medical-thoracoscopy\/v1\/anatomy\//)
        expect(asset.label).toMatch(/^Derived from CT segmentation/)
        expect(asset.inRepository).toBe(false)
        expect(asset.rights).toEqual(['R-ANATOMY-CT', 'R-ANATOMY-SEGMENTATION'])
      }
    }
    // One scene so far, the pleural space: its cold download is the sum of its files, and what the
    // browser draws with it is not measured until the gate (slice 14).
    expect(ledger.scenes.map((scene) => scene.id)).toEqual(['pleural-space'])
    for (const scene of ledger.scenes) {
      const members = scene.assets.map((id) => ledger.assets.find((asset) => asset.id === id))
      expect(members.every(Boolean)).toBe(true)
      expect(scene.coldTransferBytes).toBe(
        members.reduce((sum, asset) => sum + (asset?.bytes ?? 0), 0),
      )
      expect(scene.decodedBytes).toBe(
        members.reduce((sum, asset) => sum + (asset?.decodedBytes ?? 0), 0),
      )
      expect(scene.coldTransferBytes).toBeLessThanOrEqual(
        ledger.budgets.pleuralScenePayloadMb * 1024 * 1024,
      )
      expect([scene.drawCalls, scene.renderedTriangles]).toEqual([null, null])
    }
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
