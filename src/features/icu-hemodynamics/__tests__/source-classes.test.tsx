import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render } from '@testing-library/react'

import { criticalCareEvidenceById } from '@/features/critical-care/content/evidenceRegistry'

import { HemodynamicsSourceList } from '../components/stage/HemodynamicsSourceList'
import { requireDerivedThresholdContext } from '../content'
import {
  HEMODYNAMICS_CLINICAL_REVIEW_LINE,
  HEMODYNAMICS_SOURCE_CLASS_LABELS,
  hemodynamicsSourceClassLabel,
  hemodynamicsSourceDateLine,
  hemodynamicsSourceReviewMetadata,
} from '../content/sourceReviewMetadata'
import { hemodynamicsSourceById, hemodynamicsSources } from '../content/sources'
import { hemodynamicsStageItems } from '../content/stageItems'

afterEach(cleanup)

function source(id: string) {
  const record = hemodynamicsSourceById.get(id)
  if (!record) throw new Error(`Unknown source ${id}`)
  return record
}

function componentFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name)
    if (entry.isDirectory()) return componentFiles(target)
    return entry.name.endsWith('.tsx') ? [target] : []
  })
}

/**
 * HD-03: a learner can tell guidance from a review, a textbook chapter, a single-author online
 * chapter, a supplied synthesis of unknown authorship, a device manual and the teaching model; what
 * is unknown about a document stays stated as unknown; and a document check is never presented as
 * clinical review.
 */
describe('hemodynamics source classes and identity', () => {
  it('separates guidance, review, chapter, commentary, synthesis, device workflow and the model', () => {
    expect(
      Object.fromEntries(
        [
          'esc-ers-ph-2022',
          'pac-derived-part-2-2021',
          'clinical-hemodynamics-waveforms',
          'emcrit-rhc-supplied-2026',
          'master-hemodynamics-reference',
          'monitor-workflow-supplied',
          'edwards-swan-ganz-ifu-2023',
          'icu-hemodynamics-model-v1',
        ].map((id) => [id, source(id).sourceType]),
      ),
    ).toEqual({
      'esc-ers-ph-2022': 'guideline',
      'pac-derived-part-2-2021': 'review',
      'clinical-hemodynamics-waveforms': 'textbook-chapter',
      'emcrit-rhc-supplied-2026': 'online-commentary',
      'master-hemodynamics-reference': 'supplied-synthesis',
      'monitor-workflow-supplied': 'workflow-manual',
      'edwards-swan-ganz-ifu-2023': 'manufacturer-labeling',
      'icu-hemodynamics-model-v1': 'educational-model',
    })
    const labels = Object.values(HEMODYNAMICS_SOURCE_CLASS_LABELS)
    expect(new Set(labels).size).toBe(labels.length)
    expect(hemodynamicsSources.map((record) => record.sourceType as string)).not.toContain(
      'reference-package',
    )
  })

  it('keeps unknown authorship and dates explicit instead of filling them in', () => {
    const master = source('master-hemodynamics-reference')
    expect(master.year).toBeNull()
    expect(master.citation).toMatch(/names no author, publisher, date, or references/)
    expect(hemodynamicsSourceDateLine(master)).toMatch(/^Date: not stated \(/)
    expect(hemodynamicsSourceReviewMetadata(master.id).identity).toMatch(/^Not stated\./)
    expect(master.limitation).toMatch(/3 WU PVR boundary, which this module does not use/)

    const emcrit = source('emcrit-rhc-supplied-2026')
    expect(emcrit.year).toBe(2024)
    expect(emcrit.citation).toMatch(/^Farkas J\. /)
    expect(hemodynamicsSourceDateLine(emcrit)).toMatch(/byline dated 26 August 2024/)
    expect(hemodynamicsSourceReviewMetadata(emcrit.id).revision).toMatch(
      /capture made 23 July 2026/,
    )

    const monitors = source('monitor-workflow-supplied')
    expect(monitors.year).toBe(2019)
    expect(monitors.citation).toMatch(
      /Instructions for Use.*July 2019.*Configuration Guide.*October 2010/,
    )
    expect(monitors.limitation).toMatch(/lists settings, not procedures/)

    for (const id of ['pac-waveforms-part-1-2021', 'pac-derived-part-2-2021']) {
      expect(source(id).year).toBe(2022)
      expect(hemodynamicsSourceDateLine(source(id))).toMatch(/online \d{1,2} (February|March) 2021/)
    }
  })

  it('records document checks as checks, never as clinical review', () => {
    for (const record of hemodynamicsSources) {
      const review = hemodynamicsSourceReviewMetadata(record.id)
      for (const check of review.checks) {
        expect(check.on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(check.by === null || check.by.trim().length > 0).toBe(true)
        expect(check.what).not.toMatch(/approv|clinically reviewed/i)
      }
      if (
        ['online-commentary', 'supplied-synthesis', 'workflow-manual'].includes(record.sourceType)
      ) {
        expect({ id: record.id, checked: review.checks.length > 0 }).toEqual({
          id: record.id,
          checked: true,
        })
      }
    }
  })

  it('shows every source’s class, date, checks and missing clinical review while its claims are folded', () => {
    const { container, rerender } = render(
      <HemodynamicsSourceList records={hemodynamicsSources} claimsVisible={false} />,
    )
    const items = container.querySelectorAll<HTMLLIElement>('[data-evidence-id]')
    expect(items).toHaveLength(hemodynamicsSources.length)
    items.forEach((item) => {
      const record = source(item.dataset.evidenceId ?? '')
      const identity = item.querySelector('[data-source-identity]')?.textContent ?? ''
      expect(item.querySelector('small')?.textContent).toBe(hemodynamicsSourceClassLabel(record))
      expect(identity).toContain(hemodynamicsSourceDateLine(record))
      expect(identity).toContain(HEMODYNAMICS_CLINICAL_REVIEW_LINE)
      for (const check of hemodynamicsSourceReviewMetadata(record.id).checks) {
        expect(identity).toContain(check.what)
      }
    })
    expect(container.querySelectorAll('[data-source-claims]')).toHaveLength(0)

    rerender(<HemodynamicsSourceList records={hemodynamicsSources} claimsVisible />)
    expect(container.querySelectorAll('[data-source-claims]')).toHaveLength(
      hemodynamicsSources.length,
    )
  })

  it('never shows the registry version string as a document version', () => {
    const root = join(process.cwd(), 'src/features/icu-hemodynamics/components')
    const offenders = componentFiles(root).filter((file) =>
      /(?:source|record)\.version\b/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('leaves the shared critical-care projection of these sources unchanged', () => {
    const expected: Record<string, string> = Object.fromEntries(
      hemodynamicsSources.map((record) => [record.id, 'clinical']),
    )
    expected['edwards-swan-ganz-ifu-2023'] = 'device-workflow'
    expected['monitor-workflow-supplied'] = 'device-workflow'
    expected['icu-hemodynamics-model-v1'] = 'model-behavior'
    expect(
      Object.fromEntries(
        hemodynamicsSources.map((record) => [
          record.id,
          criticalCareEvidenceById.get(record.id)?.claimType,
        ]),
      ),
    ).toEqual(expected)
  })

  it('cites only the teaching model for the simulator’s cardiac-index alarm boundaries', () => {
    const alarm = requireDerivedThresholdContext('ci-educational-alarm-boundaries')
    expect(alarm.classification).toBe('model-parameter')
    expect(alarm.statement).toBe(
      'This simulator warns below 2.2 L/min/m² and alarms below 1.8 L/min/m².',
    )
    expect(alarm.evidenceIds).toEqual(['icu-hemodynamics-model-v1'])
  })

  it('no longer frames “the catheter measures resistance” as a defensible reading', () => {
    const choice = hemodynamicsStageItems['why-measure'].transfer.choices.find(
      (candidate) => candidate.id === 'measures-resistance',
    )
    expect(choice?.plausibility).toBe('incorrect-mechanism')
    expect(choice?.rationale).toMatch(
      /^Resistance is calculated from a pressure difference and a flow\./,
    )
  })
})
