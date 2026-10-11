import { cleanup, render } from '@testing-library/react'

import { criticalCareEvidenceById } from '@/features/critical-care/content/evidenceRegistry'

import { VentilationLearningSources } from '../components/VentilationLearningVisuals'
import { VentilationSourceList } from '../components/stage/VentilationSourceList'
import {
  ventilationEvidence,
  ventilationEvidenceById,
  ventilationSourceClassLabel,
} from '../content/evidence'

afterEach(cleanup)

/** The nine entries the external report found unnamed. */
const formerlyUnnamed = [
  ...Array.from({ length: 8 }, (_, index) => `casebook-source-${index + 1}`),
  'supplied-casebook-2026',
]

/**
 * The shared critical-care registry's claim type for every ventilation record, captured on
 * untouched main (905372be). MV-03 renames and reclassifies within the module; the shared
 * projection must not move.
 */
const baseClaimTypes: Readonly<Record<string, string>> = {
  'aarc-assessment-2024': 'clinical',
  'ats-ards-2024': 'clinical',
  // MV-PRE-REVIEW-04 (S6-1): one record added, for the guideline the limits come from. Every
  // record captured on untouched main keeps its claim type.
  'ats-esicm-sccm-ards-2017': 'clinical',
  'hamilton-c6-manual-1.2.x': 'device-workflow',
  'hamilton-c6-quick-guide': 'device-workflow',
  'hamilton-c6-intellivent-asv-1.2.x': 'device-workflow',
  'evita-v800-v600-ifu-3.1n': 'device-workflow',
  'evita-v800-v600-ifu-3n': 'device-workflow',
  'evita-v800-v600-pocket-guide-1n': 'device-workflow',
  'evita-v800-product-information-2023': 'device-workflow',
  'pb980-service-manual-rev-c': 'device-workflow',
  'pb980-operators-manual': 'device-workflow',
  'pb980-icu-brochure-2023': 'device-workflow',
  'avea-operators-manual-rev-m': 'device-workflow',
  'avea-modes-guide-2014': 'device-workflow',
  'pb980-operator-manual-pt00101843a00-online': 'device-workflow',
  'supplied-casebook-2026': 'model-behavior',
  'tobin-3e-setting-ventilator': 'clinical',
  'tobin-3e-peep': 'clinical',
  'tobin-3e-copd': 'clinical',
  'tobin-3e-monitoring': 'clinical',
  'tobin-3e-fighting-ventilator': 'clinical',
  'antonogiannaki-dyssynchrony-2017': 'clinical',
  'casebook-source-1': 'clinical',
  'casebook-source-2': 'clinical',
  'casebook-source-3': 'clinical',
  'casebook-source-4': 'clinical',
  'casebook-source-5': 'clinical',
  'casebook-source-6': 'model-behavior',
  'casebook-source-7': 'model-behavior',
  'casebook-source-8': 'model-behavior',
  'bounded-ventilation-model': 'model-behavior',
  // Teaching-first rules (2026-10-08): four records added for the numbers register's sources.
  'ardsnet-arma-2000': 'clinical',
  'ardsnet-alveoli-2004': 'clinical',
  'amato-driving-pressure-2015': 'clinical',
  'tobin-3e-severe-asthma': 'clinical',
}

describe('MV-03 source identities', () => {
  it('names all nine formerly unnamed entries and says how each identity is known', () => {
    const expected: Record<string, string> = {
      'casebook-source-1': 'checked-against-supplied-file',
      'casebook-source-2': 'checked-against-supplied-file',
      'casebook-source-3': 'checked-against-supplied-file',
      'casebook-source-4': 'checked-against-supplied-file',
      'casebook-source-5': 'not-identified',
      'casebook-source-6': 'as-cited-not-checked',
      'casebook-source-7': 'as-cited-not-checked',
      'casebook-source-8': 'as-cited-not-checked',
      'supplied-casebook-2026': 'checked-against-supplied-file',
    }
    for (const id of formerlyUnnamed) {
      const record = ventilationEvidenceById.get(id)!
      expect(record.title).not.toMatch(/^Casebook source \d+$/)
      expect(record.identity?.status).toBe(expected[id])
      if (record.identity!.status === 'as-cited-not-checked')
        expect(record.identity!.checkedOn).toBeUndefined()
      else expect(record.identity!.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(record.identity!.note).not.toMatch(/\b(approved|signed off|clinically reviewed)\b/i)
    }
    expect(ventilationEvidenceById.get('casebook-source-1')!.identity!.sameWorkAs).toBe(
      'antonogiannaki-dyssynchrony-2017',
    )
    expect(ventilationEvidenceById.get('casebook-source-2')!.identity!.sameWorkAs).toBe(
      'tobin-3e-fighting-ventilator',
    )
    for (const record of ventilationEvidence)
      if (record.identity?.sameWorkAs) {
        expect(record.identity.sameWorkAs).not.toBe(record.id)
        expect(ventilationEvidenceById.has(record.identity.sameWorkAs)).toBe(true)
      }
  })

  it('classifies the case set, the transcripts and the preprints for what they are', () => {
    const casebook = ventilationEvidenceById.get('supplied-casebook-2026')!
    expect(casebook.citation).not.toMatch(/course author/i)
    expect(casebook.pages).toBeUndefined()
    expect(casebook.limitations).toMatch(/not a clinical source/)
    expect(ventilationEvidenceById.get('casebook-source-5')!.sourceClass).toBe(
      'supplied-transcripts',
    )
    for (const id of ['casebook-source-6', 'casebook-source-7', 'casebook-source-8'])
      expect(ventilationEvidenceById.get(id)!.sourceClass).toBe('modeling-preprint')
    expect(
      ventilationEvidence
        .filter((record) => record.sourceClass === 'educational-model')
        .map((record) => record.id),
    ).toEqual(['bounded-ventilation-model'])
    const labels = Object.values(ventilationSourceClassLabel)
    expect(new Set(labels).size).toBe(labels.length)
    for (const record of ventilationEvidence)
      expect(ventilationSourceClassLabel[record.sourceClass]).toBeTruthy()
  })

  it('leaves the shared critical-care claim-type projection unchanged', () => {
    expect(new Set(ventilationEvidence.map((record) => record.id))).toEqual(
      new Set(Object.keys(baseClaimTypes)),
    )
    for (const [id, claimType] of Object.entries(baseClaimTypes))
      expect(criticalCareEvidenceById.get(id)?.claimType).toBe(claimType)
  })

  it('names every record and its class in the section footer while claims stay folded', () => {
    const { container } = render(
      <VentilationSourceList
        records={formerlyUnnamed.map((id) => ventilationEvidenceById.get(id)!)}
        claimsVisible={false}
      />,
    )
    expect(container.querySelectorAll('[data-source-claims]')).toHaveLength(0)
    const items = container.querySelectorAll<HTMLElement>('[data-evidence-id]')
    expect(items).toHaveLength(formerlyUnnamed.length)
    items.forEach((item) => {
      const record = ventilationEvidenceById.get(item.dataset.evidenceId!)!
      expect(item.textContent).toContain(ventilationSourceClassLabel[record.sourceClass])
    })
    expect(container.textContent).not.toMatch(/Casebook source \d/)
  })

  it('labels classes in the applications source list', () => {
    const { container } = render(
      <VentilationLearningSources
        evidenceIds={['casebook-source-6', 'supplied-casebook-2026', 'tobin-3e-copd']}
      />,
    )
    const text = container.textContent ?? ''
    for (const sourceClass of ['modeling-preprint', 'curriculum', 'clinical-reference'] as const)
      expect(text).toContain(`${ventilationSourceClassLabel[sourceClass]} · `)
    expect(text).not.toMatch(/supplied casebook and existing lesson rationales/)
  })
})
