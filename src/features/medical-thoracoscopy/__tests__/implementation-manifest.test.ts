/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The implementation manifest is the imported inventory: what the owner's planning documents
 * define, copied with the layer and line each item came from. These pins keep the ids stable and
 * the file honest. They do not check the clinical content of any section; nothing here is
 * reviewed.
 *
 * The planning documents live outside the repository, so the comparison against them is
 * `scripts/medical-thoracoscopy/verify_inventory_import.py`, run where they are.
 */
type SourceRef = { layer: 'v1' | 'P' | 'v2'; line: number; endLine?: number }

type Manifest = {
  manifest: string
  version: number
  preparedBy: string
  statement: string
  sources: Record<'v1' | 'P' | 'v2', { title: string; lines: number; sha256: string }>
  statusVocabulary: { values: string[]; source: SourceRef }
  ownerDecisions: { imported: { id: string; decidedOn: string; text: string; source: SourceRef }[] }
  spine: { phases: string[]; source: SourceRef }
  controls: {
    statement: string
    items: string[]
    source: SourceRef
    learnerWording: { status: string; proposal: string }
  }
  grammar: { name: string; columns: string[]; rows: string[]; label: string; source: SourceRef }
  chapters: {
    names: string[]
    source: SourceRef
    assignment: {
      status: string
      decidedBy: string | null
      decidedOn: string | null
      proposal: { chapter: string; sections: number[] }[]
    }
  }
  learnSections: {
    number: number
    id: string
    title: string
    activity: string
    minutesEstimate: number
    source: SourceRef
  }[]
  learnMinutesEstimateTotal: number
  practiceScenarios: { id: string; title: string; pairsWithLearn: number[]; source: SourceRef }[]
  integratedCases: { id: string; title: string; source: SourceRef }[]
  outcomeAlignment: { target: string; rows: { learnerCan: string; source: SourceRef }[] }
  correctedAssumptions: { originalProposal: string; requiredImprovement: string }[]
  teachingAdditions: { name: string; text: string; definedBeyondThisSentence: boolean }[]
  modelBoundaries: { text: string; source: SourceRef }[]
  harmfulReflexes: {
    items: { text: string; source: SourceRef }[]
    governingRule: { text: string; status: string; source: SourceRef }
  }
  budgets: { items: { name: string; limit: number; unit: string }[] }
  prototypeGate: {
    v1Criteria: { text: string }[]
    v1OnFailure: { status: string }
    v2OnFailure: { text: string; status: string }
  }
  performanceTargets: { rows: Record<string, string>[] }
  routes: {
    base: string
    learnerLabels: { assess: string }
    legacy: { base: string; mappings: { from: string; to: string }[] }
  }
  progress: { storageKey: string; neverTouch: { key: string }[] }
}

const manifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/medical-thoracoscopy/implementation-manifest.json'),
    'utf8',
  ),
) as Manifest

/** Section ids are permanent: deep links, saved progress and the claim register all use them. */
const SECTION_IDS = [
  'why-thoracoscopy',
  'patient-selection',
  'the-instrument',
  'room-and-tower',
  'the-chest-wall',
  'normal-pleural-space',
  'four-controls',
  'choosing-the-port',
  'entry',
  'making-room',
  'systematic-survey',
  'reading-the-pleura',
  'taking-biopsies',
  'energy-and-bleeding',
  'adhesions',
  'talc-poudrage',
  'finishing',
  'complications',
  'what-completion-means',
]

function collectSources(value: unknown, out: SourceRef[] = []): SourceRef[] {
  if (Array.isArray(value)) value.forEach((entry) => collectSources(entry, out))
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'source') out.push(entry as SourceRef)
      else collectSources(entry, out)
    }
  }
  return out
}

describe('medical thoracoscopy implementation manifest', () => {
  it('says what it is and what it is not', () => {
    expect(manifest.manifest).toBe('medical-thoracoscopy-implementation-manifest')
    expect(manifest.version).toBe(1)
    expect(manifest.preparedBy).toMatch(/AI authoring assistant/)
    expect(manifest.statement).toMatch(/Nothing was reconstructed or invented/)
    expect(manifest.statement).toMatch(/Nothing in this file is clinical approval/)
  })

  it('names three planning layers, each with a file hash and a line count', () => {
    expect(Object.keys(manifest.sources).sort()).toEqual(['P', 'v1', 'v2'])
    for (const source of Object.values(manifest.sources)) {
      expect(source.title.length).toBeGreaterThan(0)
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(source.lines).toBeGreaterThan(0)
    }
  })

  it('points every imported item at a line that exists in its layer', () => {
    const sources = collectSources(manifest)

    expect(sources.length).toBeGreaterThan(60)
    for (const source of sources) {
      const layer = manifest.sources[source.layer]
      expect(layer).toBeDefined()
      expect(Number.isInteger(source.line)).toBe(true)
      expect(source.line).toBeGreaterThanOrEqual(1)
      expect(source.endLine ?? source.line).toBeGreaterThanOrEqual(source.line)
      expect(source.endLine ?? source.line).toBeLessThanOrEqual(layer.lines)
    }
  })

  it('keeps the nineteen section ids, in order', () => {
    expect(manifest.learnSections.map((section) => section.id)).toEqual(SECTION_IDS)
    expect(manifest.learnSections.map((section) => section.number)).toEqual(
      SECTION_IDS.map((_id, index) => index + 1),
    )
    for (const section of manifest.learnSections) {
      expect(section.id).toMatch(/^[a-z]+(-[a-z]+)*$/)
      expect(section.title.trim()).toBe(section.title)
      expect(section.title.length).toBeGreaterThan(0)
      expect(section.activity.length).toBeGreaterThan(0)
    }
  })

  it('adds the section minutes up to the stated estimate', () => {
    const total = manifest.learnSections.reduce((sum, section) => sum + section.minutesEstimate, 0)

    expect(total).toBe(154)
    expect(manifest.learnMinutesEstimateTotal).toBe(total)
    expect(manifest.statement).toMatch(/minutes are authoring estimates/)
  })

  it('pairs each practice scenario with sections that exist', () => {
    expect(manifest.practiceScenarios.map((scenario) => scenario.id)).toEqual([
      'P1',
      'P2',
      'P3',
      'P4',
      'P5',
      'P6',
      'P7',
    ])
    for (const scenario of manifest.practiceScenarios) {
      expect(scenario.pairsWithLearn.length).toBeGreaterThan(0)
      for (const number of scenario.pairsWithLearn) {
        expect(number).toBeGreaterThanOrEqual(1)
        expect(number).toBeLessThanOrEqual(19)
      }
    }
  })

  it('holds four integrated cases, labelled Cases for the learner', () => {
    expect(manifest.integratedCases.map((entry) => entry.id)).toEqual(['C1', 'C2', 'C3', 'C4'])
    expect(manifest.routes.learnerLabels.assess).toBe('Cases')
  })

  it('holds four controls, eight spine phases and one seven-row diagnostic table', () => {
    expect(manifest.controls.items).toHaveLength(4)
    for (const item of manifest.controls.items) {
      expect(manifest.controls.statement).toContain(item)
    }
    expect(manifest.spine.phases).toEqual([
      'Decide',
      'Set up',
      'Enter',
      'Make room',
      'Survey',
      'Sample',
      'Treat',
      'Finish',
    ])
    expect(manifest.grammar.columns).toEqual(['what you see', 'where', 'consider', 'next move'])
    expect(manifest.grammar.rows).toHaveLength(7)
    expect(manifest.grammar.label).toBe('authored construct')
  })

  it('leaves the imported control wording alone and proposes the learner wording beside it', () => {
    expect(manifest.controls.statement).toContain('where the scope points (pivot, depth, roll)')
    expect(manifest.controls.learnerWording.status).toBe('proposed change')
    expect(manifest.controls.learnerWording.proposal).toBe(
      'where the scope looks (pivot, depth, roll)',
    )
  })

  it('records the chapter assignment as a proposal that covers every section once', () => {
    const { names, assignment } = manifest.chapters

    expect(names).toEqual([
      'Decide',
      'Equipment and anatomy',
      'Access and orientation',
      'Survey and intervention',
      'Finish and complications',
    ])
    expect(assignment.status).toBe('proposed change')
    expect(assignment.decidedBy).toBeNull()
    expect(assignment.decidedOn).toBeNull()
    expect(assignment.proposal.map((entry) => entry.chapter)).toEqual(names)
    // Chapters tile the canonical order: no gaps, no overlaps, nothing out of sequence.
    expect(assignment.proposal.flatMap((entry) => entry.sections)).toEqual(
      SECTION_IDS.map((_id, index) => index + 1),
    )
  })

  it('uses only the five status words for the items it marks', () => {
    const allowed = new Set([...manifest.statusVocabulary.values, 'superseded by v2'])
    const statuses: string[] = []
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) {
          if (key === 'status' && typeof entry === 'string') statuses.push(entry)
          else walk(entry)
        }
      }
    }
    walk(manifest)

    expect(manifest.statusVocabulary.values).toHaveLength(5)
    expect(statuses.length).toBeGreaterThan(0)
    for (const status of statuses) expect(allowed.has(status)).toBe(true)
  })

  it('carries the revised rule for unsafe actions, and the revised answer to a failed gate', () => {
    expect(manifest.harmfulReflexes.items).toHaveLength(5)
    expect(manifest.harmfulReflexes.governingRule.text).toMatch(
      /^Unsafe actions must not be endorsed/,
    )
    expect(manifest.harmfulReflexes.governingRule.status).toBe('proposed change')
    expect(manifest.prototypeGate.v1OnFailure.status).toBe('superseded by v2')
    expect(manifest.prototypeGate.v2OnFailure.text).toMatch(/not silent scope reduction/)
  })

  it('marks the three teaching additions as defined by one sentence each', () => {
    expect(manifest.teachingAdditions).toHaveLength(3)
    for (const addition of manifest.teachingAdditions) {
      expect(addition.definedBeyondThisSentence).toBe(false)
    }
  })

  it('reports no performance result, and leaves unknown conditions unresolved', () => {
    expect(manifest.performanceTargets.rows).toHaveLength(4)
    for (const row of manifest.performanceTargets.rows) {
      expect(row.result).toBe('NOT TESTED')
      expect(row.browser).toBe('UNRESOLVED')
      expect(row.viewport).toBe('UNRESOLVED')
    }
  })

  it('keeps the imported budgets', () => {
    const limits = Object.fromEntries(
      manifest.budgets.items.map((item) => [item.name, `${item.limit} ${item.unit}`]),
    )

    expect(limits).toEqual({
      'pleural-space scene payload': '8 MB',
      'anatomy GLB': '3 MB',
      'device GLB': '2.5 MB',
      'device GLB triangles': '50000 triangles',
      'texture edge': '1024 px',
      'rendered triangles, high quality': '250000 triangles',
      'rendered triangles, low quality': '120000 triangles',
      'draw calls': '150 calls',
      'collision proxy triangles': '12000 triangles',
      'coverage update': '4 ms',
    })
  })

  it('names the module record and the legacy record it must never touch', () => {
    expect(manifest.progress.storageKey).toBe('ip-medical-thoracoscopy-self-paced-v1')
    expect(manifest.progress.neverTouch.map((entry) => entry.key)).toEqual([
      'ip-pleural-module-progress-v1',
    ])
    expect(manifest.routes.base).toBe('/medical-thoracoscopy')
    expect(manifest.routes.legacy.mappings).toEqual([
      { from: '/assessment', to: '/assess' },
      { from: '/references', to: '/reference' },
    ])
  })

  it('records six imported owner decisions, none reworded into a new one', () => {
    expect(manifest.ownerDecisions.imported.map((decision) => decision.id)).toEqual([
      'OD-01',
      'OD-02',
      'OD-03',
      'OD-04',
      'OD-05',
      'OD-06',
    ])
    for (const decision of manifest.ownerDecisions.imported) {
      expect(decision.decidedOn).toBe('2026-09-23')
      expect(decision.source.layer).toBe('v1')
    }
  })
})
