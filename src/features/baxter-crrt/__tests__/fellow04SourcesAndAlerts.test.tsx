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
import type { EngineAlarmCode } from '../engine/types'
import { crrtLearnerCitation } from '../sourcePresentation'

/**
 * CRRT-FELLOW-04 — F-19. The main path uses plain words for source and model status; the exact
 * registered record, locator and review state stay one disclosure away; nothing is upgraded; and
 * the simulation's generic alerts never read as PrisMax alarms.
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
    expect(citation.review).toBe('No clinical review recorded')
    expect(citation.audit).toMatchObject({
      id: 'SYNTH-LAB-PRESCRIPTION-001',
      pageOrSection: 'LAB-PRESCRIPTION reviewer prototype',
      documentVersion: 'v1 authored teaching calibration · no clinical review recorded',
      reviewStatus: 'pending',
      reviewer: null,
    })
  })

  it('explains that an "sme-review" build string is not a review, and never upgrades status', () => {
    const synthetic = getBaxterCrrtCase('CRRT-17').sourceBasis.find(
      (source) => source.id === 'SYNTH-CRRT-17',
    )!
    expect(synthetic.documentVersion).toMatch(/sme-review/)
    const citation = crrtLearnerCitation(synthetic)
    expect(citation.line).not.toMatch(/sme-review|private learning fixture/)
    expect(citation.locator).toBe('Case CRRT-17')
    expect(citation.audit.versionNote).toMatch(/does not mean a subject-matter expert has reviewed/)
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

  it('shows plain status, the conflict consequence and the exact records in a Learn lesson', () => {
    render(
      <CrrtFoundationLesson
        lessonId="crrt-prescription-dosing"
        onNavigate={() => {}}
        onRestart={() => {}}
      />,
    )
    const panel = screen.getByText('Explanation, sources and limits').closest('details')!
    fireEvent.click(within(panel).getByText('Explanation, sources and limits'))
    expect(panel).toHaveTextContent(
      'Draft teaching: no clinician or device specialist has reviewed',
    )
    expect(panel).not.toHaveTextContent('Clinical/device review remains pending')
    // The limitation, its consequence, its identifiers and its page locators all stay visible.
    expect(panel).toHaveTextContent('Not calculated here: filtration fraction.')
    expect(panel).toHaveTextContent('CONFLICT-002, manual p220')
    expect(panel).toHaveTextContent('CONFLICT-001, manual p218')
    expect(panel).toHaveTextContent('it does not respond to the flows')
    expect(panel).toHaveTextContent('Unresolved: makeup flow.')
    expect(panel).toHaveTextContent(
      'withholds cumulative machine removal and whole-patient balance',
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

describe('generic simulated alerts never impersonate PrisMax alarms (F-19)', () => {
  it('labels every engine alert as a simulated alert with no raw code', () => {
    for (const code of allEngineAlarmCodes) {
      const label = crrtSimulatedAlertLabel(code)
      expect(label).toMatch(/^Simulated [a-z-]+( gain-or-loss)? alert$/)
      expect(label).not.toMatch(/_/)
    }
    expect(crrtSimulatedAlertLabel('ACCESS_OBSTRUCTION')).toBe('Simulated access-obstruction alert')
    expect(crrtSimulatedAlertLabelFromCode('NOT_A_CODE')).toBe('Simulated alert')
    expect(CRRT_SIMULATED_ALERT_BOUNDARY).toMatch(/not PrisMax alarm names/)
    expect(CRRT_SIMULATED_ALERT_BOUNDARY).toMatch(
      /no manufacturer priority, color or automatic pump response/,
    )
  })

  it('shows the simulated label, not ACCESS_OBSTRUCTION, once the CRRT-13 obstruction develops', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-13" />)
    await settle()
    const card = (label: RegExp) =>
      screen.getAllByRole('article').find((article) => label.test(article.textContent ?? ''))!
    fireEvent.click(within(card(/Assess the patient and treatment/)).getByRole('button'))
    fireEvent.click(within(card(/Advance to the worsening pattern/)).getByRole('button'))
    const evidence = screen.getByRole('region', { name: 'Live patient, prescription, and circuit' })
    expect(evidence).toHaveTextContent('Simulated access-obstruction alert')
    expect(document.body.textContent).not.toMatch(/ACCESS_OBSTRUCTION|Access Obstruction/)
    expect(document.body.textContent).toContain('Simulated access-obstruction alert')
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
