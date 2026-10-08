import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { CrrtFoundationLesson } from '../components/CrrtFoundationLesson'
import {
  CRRT_SIMULATED_ALERT_BOUNDARY,
  crrtSimulatedAlertLabel,
  crrtSimulatedAlertLabelFromCode,
} from '../content/alertLabels'
import { getBaxterCrrtCase } from '../content/completeCases'
import { baxterCrrtLearnerFacingSourceReferences } from '../content/learnerSourceMap'
import { CRRT_NUMBERS } from '../content/teachingNumbers'
import type { EngineAlarmCode } from '../engine/types'
import { crrtLearnerCitation } from '../sourcePresentation'

/**
 * CRRT-FELLOW-04 — F-19, as revised by docs/teaching-first-rules.md. The main path uses plain
 * words for a source; the registered record and locator stay one disclosure away; no pending
 * source reads as reviewed; and each alert carries its PrisMax alarm title, never a raw code.
 */

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}))

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const allEngineAlarmCodes: readonly EngineAlarmCode[] = [
  'ACCESS_OBSTRUCTION',
  'ACCESS_DISCONNECTION',
  'RETURN_OBSTRUCTION',
  'RETURN_DISCONNECTION',
  'FILTER_FOULING',
  'EFFLUENT_OBSTRUCTION',
  'AIR_DETECTED',
  'BLOOD_LEAK_DETECTED',
  'SUPPLY_BAG_EMPTY',
  'EFFLUENT_BAG_FULL',
  'SCALE_OPEN',
  'FLUID_GAIN_LOSS',
  'POWER_INTERRUPTION',
]

beforeEach(() => window.localStorage.clear())

describe('plain learner citations keep the exact record reachable (F-19)', () => {
  const byId = new Map(baxterCrrtLearnerFacingSourceReferences.map((s) => [s.id, s]))

  it('turns a reviewer-prototype locator into plain words, keeping the record verbatim', () => {
    const citation = crrtLearnerCitation(byId.get('SYNTH-LAB-PRESCRIPTION-001')!)
    expect(citation.title).toBe('Simulated teaching values')
    expect(citation.locator).toBe('Staged prescription builder')
    expect(citation.line).not.toMatch(/reviewer|prototype|fixture|calibration/i)
    expect(citation.audit).toMatchObject({
      id: 'SYNTH-LAB-PRESCRIPTION-001',
      pageOrSection: 'LAB-PRESCRIPTION reviewer prototype',
      documentVersion: 'v1 authored teaching calibration · no clinical review recorded',
      reviewStatus: 'pending',
      reviewer: null,
    })
  })

  it('keeps an "sme-review" build string off the main path, and never upgrades status', () => {
    const synthetic = getBaxterCrrtCase('CRRT-17').sourceBasis.find(
      (source) => source.id === 'SYNTH-CRRT-17',
    )!
    expect(synthetic.documentVersion).toMatch(/sme-review/)
    const citation = crrtLearnerCitation(synthetic)
    expect(citation.line).not.toMatch(/sme-review|private learning fixture/)
    expect(citation.locator).toBe('Case CRRT-17')
    for (const source of baxterCrrtLearnerFacingSourceReferences) {
      const plain = crrtLearnerCitation(source)
      if (source.reviewStatus === 'pending') {
        expect({ id: source.id, review: plain.review }).not.toEqual(
          expect.objectContaining({ review: expect.stringMatching(/^Review recorded/) }),
        )
      }
    }
  })

  it('keeps device-manual identity, edition and page locator on the main path', () => {
    const citation = crrtLearnerCitation(byId.get('MATH-PM-002')!)
    expect(citation.kind).toBe('Manufacturer operator’s manual')
    expect(citation.line).toBe(
      "PrisMax Operator's Manual · AW8035 Rev B JUN2019 · program 2.XX · Manual p217 · PDF p218",
    )
  })

  it('shows what the simulator does not compute and the exact records in a Learn lesson', () => {
    render(
      <CrrtFoundationLesson
        lessonId="crrt-prescription-dosing"
        onNavigate={() => {}}
        onRestart={() => {}}
      />,
    )
    const panel = screen.getByText('Sources', { selector: 'summary' }).closest('details')!
    fireEvent.click(within(panel).getByText('Sources', { selector: 'summary' }))
    // The two model limits and their consequence stay visible, with the number to work to.
    expect(panel).toHaveTextContent('Two things this simulator does not compute.')
    expect(panel).toHaveTextContent('does not respond to the flows')
    expect(panel).toHaveTextContent(
      `keep it under ${CRRT_NUMBERS.value('filtration-fraction-ceiling')}`,
    )
    expect(panel).toHaveTextContent(
      'cumulative machine removal and whole-patient balance are not shown',
    )
    // Plain words on the main path; the raw record one disclosure away.
    const record = panel.querySelector('[data-source-record="SYNTH-LAB-PRESCRIPTION-001"]')!
    expect(record).toHaveTextContent('Registered section: LAB-PRESCRIPTION reviewer prototype')
    const mainPath = Array.from(panel.children)
      .filter((child) => child.tagName === 'P')
      .map((child) => child.textContent)
      .join(' ')
    expect(mainPath).not.toMatch(/reviewer prototype/)
    expect(mainPath).toMatch(
      /Simulated teaching values · Written for this module · Staged prescription builder/,
    )
  })
})

describe('alerts carry a PrisMax alarm title, never a raw engine code (F-19)', () => {
  it('labels every engine alert as a named alarm with no raw code', () => {
    const labels = allEngineAlarmCodes.map((code) => crrtSimulatedAlertLabel(code))
    for (const label of labels) {
      expect(label).toMatch(/\S alarm$/)
      expect(label).not.toMatch(/_|simulated/i)
    }
    expect(new Set(labels).size).toBe(allEngineAlarmCodes.length)
    expect(crrtSimulatedAlertLabel('ACCESS_OBSTRUCTION')).toBe('Access Extremely Negative alarm')
    expect(crrtSimulatedAlertLabelFromCode('NOT_A_CODE')).toBe('Alarm')
    // The one model limit a learner could mistake for device behaviour stays stated.
    expect(CRRT_SIMULATED_ALERT_BOUNDARY).toMatch(
      /priority and the automatic pump response are simplified/,
    )
  })

  it('shows the alarm title, not ACCESS_OBSTRUCTION, once the CRRT-13 obstruction develops', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-13" />)
    await settle()
    const card = (label: RegExp) =>
      screen.getAllByRole('article').find((article) => label.test(article.textContent ?? ''))!
    fireEvent.click(within(card(/Assess the patient and treatment/)).getByRole('button'))
    fireEvent.click(within(card(/Advance to the worsening pattern/)).getByRole('button'))
    const evidence = screen.getByRole('region', { name: 'Live patient, prescription, and circuit' })
    const title = crrtSimulatedAlertLabel('ACCESS_OBSTRUCTION')
    expect(evidence).toHaveTextContent(title)
    expect(document.body.textContent).not.toMatch(/ACCESS_OBSTRUCTION|Access Obstruction/)
    expect(document.body.textContent).toContain(title)
    expect(document.body.textContent).toMatch(/Priority:\s*none shown/)
  })
})

describe('one truthful debrief (F-18 residual found in the F-19 audit)', () => {
  it('shows only the case’s own debrief, never raw event types or the worked chain as this run', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-13" />)
    await settle()
    const card = screen
      .getAllByRole('article')
      .find((article) => /Assess the patient and treatment/.test(article.textContent ?? ''))!
    fireEvent.click(within(card).getByRole('button'))
    fireEvent.click(screen.getByRole('button', { name: 'End run and review debrief' }))
    await settle()
    expect(screen.getAllByRole('heading', { name: 'Causal debrief' })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'What you did in this run' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Supplied teaching path · worked example' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your clinical model' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'What happened' })).toBeNull()
    expect(document.body.textContent).not.toMatch(/intervention performed|debrief revealed/i)
  })
})
