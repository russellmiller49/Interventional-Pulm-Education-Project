import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { ImagingIntegratedCaseActivity } from '../components/ImagingIntegratedCaseActivity'
import { PeripheralImagingIntegratedCasesLanding } from '../components/PeripheralImagingIntegratedCasesLanding'
import { PeripheralImagingLearnLanding } from '../components/PeripheralImagingLearnLanding'
import { ChainWalkCard } from '../components/stage/ChainWalkCard'
import { SectionGlossary } from '../components/stage/SectionGlossary'
import { LabDock } from '../components/suite/LabDock'
import { DosePanels } from '../components/suite/views/DoseView'
import { SignalReadout } from '../components/suite/views/SignalView'
import { StaffPanels } from '../components/suite/views/StaffView'
import { resolveSuiteInputs } from '../components/suite/suiteViewSpec'
import { termsForSection } from '../content/glossary'
import { imagingCases } from '../content/cases'
import { IMAGING_SHARED_BOUNDARY, imagingSectionSpec } from '../content/sectionSpecs'
import { suiteViewForStep } from '../content/suiteViews'
import { transferOrigin } from '../content/transferOrigins'
import { emptyLabState } from '../engine/labGoalEvaluation'
import { LESSONS } from '../data/lessons'
import {
  clickPrimary,
  commitChoice,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowSecondary,
  nowSkip,
  reachIndependent,
  storedProgress,
} from '../test-support/stageHarness'

jest.mock(
  '../components/suite/ImagingSuitePane',
  () =>
    jest.requireActual<typeof import('../test-support/SuiteTestDouble')>(
      '../test-support/SuiteTestDouble',
    ).suitePaneDouble,
)
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/*
 * PI-FELLOW-03, the rendered side. Source IDs are the AI-assisted fellow walkthrough's own. Each
 * of these drives the real stage over the real engine and reads what the learner would.
 */

const sectionHref = (sectionId: string) => `/peripheral-imaging/learn?section=${sectionId}`

function skipToTransfer(sectionId: Parameters<typeof mountSection>[0]) {
  const { lesson } = mountSection(sectionId)
  const transferId = lesson.steps[lesson.transferStepIndex].id
  for (let guard = 0; currentStepId() !== transferId; guard++) {
    if (guard > 40) throw new Error(`stuck on ${currentStepId()}`)
    const primary = nowPrimary()
    if (primary && !primary.disabled) fireEvent.click(primary)
    else if (nowSkip()) fireEvent.click(nowSkip()!)
    else throw new Error(`no way past ${currentStepId()}`)
  }
  return lesson
}

function insideDetails(node: Element | null): boolean {
  return node?.closest('details') !== null
}

describe('report CW3 — terms are defined where a learner lands, and reachable from Help on any step', () => {
  it('a deep-linked section opens with its own terms, outside any review disclosure', () => {
    mountSection('dts-acquisition')
    const glossary = document.querySelector('[data-section-glossary="teaching"]')!
    expect(glossary).not.toBeNull()
    expect(glossary.closest('[data-teaching-review]')).toBeNull()
    const ids = [...glossary.querySelectorAll('[data-glossary-term]')].map((n) =>
      n.getAttribute('data-glossary-term'),
    )
    expect(ids).toEqual(termsForSection('dts-acquisition').map((t) => t.id))
    expect(ids).toEqual(expect.arrayContaining(['dts', 'missing-wedge', 'tool-plane-spread']))
    // A term taught in full elsewhere links that section.
    const cbct = glossary.querySelector('[data-glossary-term="cbct"] [data-glossary-taught-in]')!
    expect(cbct.getAttribute('href')).toBe(sectionHref('cbct-acquisition'))
    // Every definition says where its words come from.
    for (const entry of glossary.querySelectorAll('[data-glossary-term]')) {
      expect(entry.querySelector('small')?.textContent?.trim().length).toBeGreaterThan(5)
    }
  })

  it('Help keeps its navigation role first and adds the terms and the one statement about the models', () => {
    const { lesson } = mountSection('field')
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    const dialog = document.querySelector('[data-stage-help-dialog]')!
    expect(dialog.hasAttribute('open')).toBe(true)
    const text = dialog.textContent ?? ''
    expect(text).toMatch(/Any step can be skipped/)
    const glossary = dialog.querySelector('[data-section-glossary="help"]')!
    expect(glossary).not.toBeNull()
    expect(glossary.querySelector('[data-glossary-term="binning"]')).not.toBeNull()
    const nav = [...dialog.querySelectorAll('p')].find((p) =>
      /Any step can be skipped/.test(p.textContent ?? ''),
    )!
    expect(nav.compareDocumentPosition(glossary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dialog.querySelector('[data-help-models]')?.textContent).toContain(
      IMAGING_SHARED_BOUNDARY,
    )
  })
})

describe('reports CW4 and 1.6 — the opening question is shown where it is asked, and the recap names it', () => {
  it('prints the framing question on the first step outside any disclosure, asking for nothing', () => {
    const { lesson } = mountSection('signal')
    const question = document.querySelector('[data-opening-question]')
    expect(question).not.toBeNull()
    expect(insideDetails(question)).toBe(false)
    expect(question!.textContent).toContain(lesson.lesson.recall.prompt)
    expect(question!.textContent).toMatch(/No answer is needed now/)
    expect(
      document.querySelector('[data-opening-question] input, [data-opening-question] button'),
    ).toBeNull()
  })

  it('the recap restates the question and does not claim it was answered', () => {
    const { lesson } = mountSection('signal')
    const explainId = lesson.steps.find((s) => s.interaction.kind === 'explain')!.id
    for (let guard = 0; currentStepId() !== explainId; guard++) {
      if (guard > 40) throw new Error(`stuck on ${currentStepId()}`)
      const primary = nowPrimary()
      if (primary && !primary.disabled) fireEvent.click(primary)
      else fireEvent.click(nowSkip()!)
    }
    const recap = document.querySelector('[data-recall-answer]')!
    expect(recap.querySelector('[data-recall-prompt]')?.textContent).toBe(
      lesson.lesson.recall.prompt,
    )
    expect(recap.textContent).toContain(lesson.lesson.recall.answer)
    expect(recap.textContent).not.toMatch(/Earlier question, revisited|you answered/i)
  })
})

describe('report CW1 — a reused closing question is labelled review, links its section, and keeps every affordance', () => {
  it('labels Section 10’s closing question as optional review of Section 5 with a link, unchanged in identity', () => {
    const lesson = skipToTransfer('dts-acquisition')
    const origin = transferOrigin('dts-acquisition')!
    expect(document.querySelector('[data-now-focus] h2')?.textContent).toBe(
      'Optional review · Projection & depth',
    )
    const link = document.querySelector(
      '[data-transfer-origin="projection"] [data-transfer-origin-link]',
    )!
    expect(link.getAttribute('href')).toBe(sectionHref('projection'))
    expect(link.textContent).toContain(`Section ${origin.origin.number}`)
    expect(document.querySelector('[data-now-focus] p')?.textContent).toMatch(
      /it first appears at the end of Section 6/,
    )
    const step = lesson.steps[lesson.transferStepIndex]
    if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
    expect(document.querySelector('[data-prediction-choices] legend')?.textContent).toBe(
      step.interaction.item.stem,
    )
    // Reveal before an answer, retry after one, and leaving without an answer all remain.
    expect(nowPrimary()?.disabled).toBe(true)
    expect(nowSecondary()?.textContent).toBe('Show the explanation')
    fireEvent.click(nowSecondary()!)
    expect(document.querySelector('[data-explanation-reveal]')).not.toBeNull()
    expect(nowSkip()?.textContent).toBe('Finish without answering')
    const keyed = step.interaction.item.choices.find((c) => c.plausibility === 'best')!
    commitChoice(new RegExp(keyed.label.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(
      document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome'),
    ).toBe('correct')
    expect(screen.getByRole('button', { name: 'Try this question again' })).toBeInTheDocument()
    expect(JSON.stringify(storedProgress())).not.toMatch(/choice|correct|attempt|answer/i)
  })

  it('leaves a closing question that is new to the learner as it was, and offers the eccentric rEBUS case there (report PR4)', () => {
    skipToTransfer('imaging-questions')
    expect(document.querySelector('[data-now-focus] h2')?.textContent).toBe(
      'Apply it to another situation',
    )
    expect(document.querySelector('[data-transfer-origin]')).toBeNull()
    const related = document.querySelector(
      '[data-related-practice-case="two-dimensional-practice-1"] a',
    )!
    expect(related.getAttribute('href')).toBe(
      '/peripheral-imaging/practice?case=two-dimensional-practice-1',
    )
    expect(related.textContent).toBe('Eccentric radial EBUS view')
    // Optional: nothing waits on it.
    expect(nowSkip()).not.toBeNull()
    fireEvent.click(nowSkip()!)
    expect(document.querySelector('[data-section-completion]')).not.toBeNull()
  })

  it('a section can be finished without answering its review question, as before', () => {
    skipToTransfer('time')
    fireEvent.click(nowSkip()!)
    expect(document.querySelector('[data-section-completion]')).not.toBeNull()
    expect(storedProgress().reviewedSectionIds).toEqual(['time'])
  })
})

describe('report CW5 — the recap is concise and the full feedback stays one disclosure away', () => {
  it('shows the choice, the best-supported reading and the takeaway, with the full verdict folded', () => {
    const { lesson } = mountSection('projection')
    reachIndependent(lesson)
    const check = lesson.steps[lesson.predictionStepIndex].interaction
    if (check.kind !== 'prediction') throw new Error('unreachable')
    const keyed = check.item.choices.find((c) => c.plausibility === 'best')!
    commitChoice(new RegExp(keyed.label.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    clickPrimary()
    const recap = document.querySelector('[data-explain-recap] [data-check-recap]')!
    expect(recap.textContent).toContain(keyed.label)
    expect(recap.textContent).toContain(check.item.explanation)
    expect(recap.querySelector('[data-recap-best]')?.textContent).toMatch(/best-supported reading/)
    const full = document.querySelector<HTMLDetailsElement>(
      '[data-explain-recap] [data-recap-full]',
    )!
    expect(full.open).toBe(false)
    expect(full.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome')).toBe(
      'correct',
    )
    // The rhythm is untouched: the same step still carries the what-changed table.
    expect(document.querySelector('[data-before-after]')).not.toBeNull()
  })
})

describe('report CW2 — the general provenance sentence is said once in full, the specific limits stay', () => {
  it('prints the full statement on the first step, and the specific limit with a reminder afterwards', () => {
    const { lesson } = mountSection('field')
    const specific = imagingSectionSpec('field')
      .modelBoundary.replace(IMAGING_SHARED_BOUNDARY, '')
      .trim()
    let aside = document.querySelector('[data-teaching-block="boundary"]')!
    expect(aside.getAttribute('data-boundary-full')).toBe('true')
    expect(aside.querySelector('[data-boundary-specific]')?.textContent).toBe(specific)
    expect(aside.querySelector('[data-boundary-shared]')?.textContent).toBe(IMAGING_SHARED_BOUNDARY)
    expect(document.querySelector('[data-safety-cue]')).not.toBeNull()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)
    aside = document.querySelector('[data-teaching-block="boundary"]')!
    expect(aside.getAttribute('data-boundary-full')).toBe('false')
    expect(aside.querySelector('[data-boundary-specific]')?.textContent).toBe(specific)
    expect(aside.querySelector('[data-boundary-shared]')).toBeNull()
    expect(aside.querySelector('[data-boundary-reminder]')?.textContent).toMatch(
      /not equipment settings, patient measurements or dose/,
    )
  })

  it('the demonstration kicker no longer repeats the scene header', () => {
    mountSection('projection')
    expect(document.querySelector('[data-demonstration-kicker]')?.textContent).toMatch(
      /^Worked demonstration/,
    )
    expect(document.querySelector('[data-demonstration-kicker]')?.textContent).not.toMatch(
      /authored teaching example/,
    )
  })
})

describe('report 7.4 — the primary-beam warning is its own callout', () => {
  it('renders the callout on the block that carries it, before the body', () => {
    const { lesson } = mountSection('staff-protection')
    const accessId = lesson.steps.find((s) => s.activity.id === 'staff-protection:access')!.id
    while (currentStepId() !== accessId) clickPrimary()
    const callout = document.querySelector('[data-safety-callout]')!
    const block = LESSONS.find((l) => l.id === 'staff-protection')!.blocks.find(
      (b) => b.title === 'Keep hands out of the primary beam',
    )!
    expect(callout.textContent).toBe(block.callout)
    const body = [...document.querySelectorAll('[data-content-ref] p')].find(
      (p) => p.textContent === block.body,
    )!
    expect(callout.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('reports 2.8 and 3.4 — a reused demonstration says it is a reminder and what is new', () => {
  it('frames Section 5’s opening demonstration as a reminder from Section 2, with the link', () => {
    mountSection('projection')
    const reminder = document.querySelector('[data-demonstration-reminder="chain-walk"]')!
    expect(reminder).not.toBeNull()
    expect(reminder.querySelector('[data-demonstration-origin-link]')?.getAttribute('href')).toBe(
      sectionHref('chain-walk'),
    )
    expect(reminder.textContent).toContain(imagingSectionSpec('projection').newConcept)
    expect(document.querySelector('[data-demonstration-kicker]')?.textContent).toBe(
      'Worked demonstration · reminder',
    )
    // The full demonstration is still there.
    expect(document.querySelector('[data-look-for]')).not.toBeNull()
    expect(document.querySelector('[data-suite-scene]')).not.toBeNull()
  })

  it('leaves the original unframed', () => {
    mountSection('chain-walk')
    expect(document.querySelector('[data-demonstration-reminder]')).toBeNull()
    expect(document.querySelector('[data-demonstration-kicker]')?.textContent).toBe(
      'Worked demonstration',
    )
  })
})

describe('reports 4.1 and 5.1 — the reconstruction comparison leads with the analogy and the figures', () => {
  it('Section 10 leads with DTS: analogy, two figures, a short table, the full account folded', () => {
    mountSection('dts-acquisition')
    const comparison = document.querySelector(
      '[data-reconstruction-comparison][data-lead="tomosynthesis"]',
    )!
    expect(comparison).not.toBeNull()
    expect(comparison.querySelector('[data-reconstruction-analogy]')?.textContent).toMatch(
      /transparencies/,
    )
    const figures = [...comparison.querySelectorAll('[data-reconstruction-figure]')].map((f) =>
      f.getAttribute('data-reconstruction-figure'),
    )
    expect(figures).toEqual(['tomosynthesis', 'cone-beam'])
    expect(
      comparison.querySelector('[data-reconstruction-table] tbody')?.querySelectorAll('tr').length,
    ).toBe(5)
    const full = comparison.querySelector<HTMLDetailsElement>('[data-reconstruction-full]')!
    expect(full.open).toBe(false)
    expect(full.querySelector('[data-reconstruction="cone-beam"]')).not.toBeNull()
    expect(full.textContent).toMatch(/Model boundary/)
    expect(
      comparison
        .querySelector('[data-reconstruction-elsewhere="cone-beam"] a')
        ?.getAttribute('href'),
    ).toBe(sectionHref('cbct-acquisition'))
  })

  it('Section 12 leads with CBCT and points back to Section 10 for the DTS half', () => {
    mountSection('cbct-acquisition')
    const comparison = document.querySelector(
      '[data-reconstruction-comparison][data-lead="cone-beam"]',
    )!
    expect(comparison).not.toBeNull()
    expect(comparison.querySelector('[data-reconstruction-analogy]')?.textContent).toMatch(
      /projections from a wide rotation/,
    )
    expect(
      comparison
        .querySelector('[data-reconstruction-figure]')
        ?.getAttribute('data-reconstruction-figure'),
    ).toBe('cone-beam')
    expect(
      comparison
        .querySelector('[data-reconstruction-elsewhere="tomosynthesis"] a')
        ?.getAttribute('href'),
    ).toBe(sectionHref('dts-acquisition'))
  })
})

describe('report 5.4 — the provenance flow speaks the modality of the section it is on', () => {
  it('describes a CBCT spin on the mobile CBCT section and limited-angle projections on the DTS one', () => {
    const { lesson } = mountSection('mobile-suite')
    const coordinatesId = lesson.steps.find((s) => s.activity.id === 'mobile-suite:coordinates')!.id
    while (currentStepId() !== coordinatesId) clickPrimary()
    const flow = document.querySelector('[data-provenance-flow]')!
    expect(flow.getAttribute('data-provenance-modality')).toBe('cbct')
    expect(flow.textContent).toMatch(/projections from the CBCT spin/)
    expect(flow.textContent).not.toMatch(/limited-angle/)
    expect(flow.querySelector('[data-cbct-provenance-review]')?.textContent).toMatch(
      /awaiting source-owner review/,
    )
    expect(flow.textContent).not.toMatch(/planning CT is not part|enters only/)
    expect(flow.textContent).toMatch(/Do not assume that viewing or exporting/)
    cleanup()
    localStorage.clear()
    mountSection('dts-interpretation')
    const dts = document.querySelector('[data-provenance-flow]')!
    expect(dts.getAttribute('data-provenance-modality')).toBe('dts')
    expect(dts.textContent).toMatch(/limited-angle projections/)
  })
})

describe('reports 1.1 and 6.1 — the sampling component is defined and labelled on the first screen', () => {
  it('names the tip and the teal segment on the figure, defines the term, and links Section 15', () => {
    mountSection('imaging-questions')
    fireEvent.click(screen.getByRole('button', { name: 'Sampling component' }))
    const definition = document.querySelector('[data-sampling-component-definition]')!
    expect(definition.textContent).toMatch(/part of the biopsy tool that actually acquires tissue/)
    expect(definition.textContent).toMatch(/depending on the instrument/)
    expect(definition.querySelector('[data-sampling-component-link]')?.getAttribute('href')).toBe(
      sectionHref('tool-confirmation'),
    )
    expect(document.querySelector('[data-figure-label="tip"]')?.textContent).toBe('tip')
    expect(document.querySelector('[data-figure-label="sampling-component"]')?.textContent).toMatch(
      /sampling component/,
    )
    expect(document.querySelector('[data-figure-legend]')?.textContent).toMatch(
      /Dashed amber circle: the navigation target/,
    )
  })
})

describe('report 7.2 — the four quantities as a table and a template that prefills nothing', () => {
  it('renders the table and a template with no number in it, on the dose section’s first step', () => {
    mountSection('dose-reporting')
    expect(document.querySelectorAll('[data-dose-quantities] tbody tr').length).toBe(4)
    const template = document.querySelector('[data-dose-note-lines]')!
    expect(template.textContent).not.toMatch(/\d/)
    expect(template.textContent).toMatch(/Total kerma–area product/)
    expect(document.querySelector('[data-copy-dose-note]')).not.toBeNull()
  })
})

describe('reports 2.11, 3.9, 7.1, 7.3 and 3.6 — the suite panels explain their own readouts', () => {
  it('the dock lists a meaning for every readout it prints, and the tube-load note says what the number is for', () => {
    const view = suiteViewForStep('time')
    const lab = emptyLabState('temporal', 'time')
    render(
      <LabDock
        view={view}
        lab={lab}
        onLabChange={() => {}}
        onLabReset={() => {}}
        controlsEnabled
        goals={[]}
        chainCaption=""
      />,
    )
    const printed = [...document.querySelectorAll('[data-readout]')].map((n) =>
      n.getAttribute('data-readout'),
    )
    const explained = [...document.querySelectorAll('[data-readout-meaning]')].map((n) =>
      n.getAttribute('data-readout-meaning'),
    )
    expect(printed.length).toBeGreaterThan(0)
    expect(explained).toEqual(printed)
    expect(document.querySelector('[data-tube-load-note]')?.textContent).toMatch(
      /pulse rate × pulse width × current/,
    )
    expect(document.querySelector('[data-tube-load-note]')?.textContent).toMatch(/not patient dose/)
  })

  it('the KAP panel leads with the same-product rule and keeps the exact values one disclosure away', () => {
    const view = suiteViewForStep('dose-reporting')
    const inputs = resolveSuiteInputs(view, { kerma: 10, area: 100 })
    render(<DosePanels inputs={inputs} profile={null} failed={false} />)
    expect(document.querySelector('[data-dose-rule]')?.textContent).toMatch(
      /Same product on both planes/,
    )
    const kaps = [...document.querySelectorAll('[data-dose-plane]')].map(
      (n) => n.textContent?.match(/KAP: ([\d.]+) Gy·cm²/)?.[1],
    )
    expect(kaps).toEqual(['1.00', '1.00'])
    const exact = document.querySelector<HTMLDetailsElement>('[data-dose-exact]')!
    expect(exact.open).toBe(false)
    expect(exact.textContent).toMatch(/mm from the focal spot/)
    expect(exact.textContent).toMatch(/1\.0000 Gy·cm²/)
  })

  it('the staff panel leads with where to stand, with its qualifier', () => {
    const view = suiteViewForStep('staff-protection')
    const inputs = resolveSuiteInputs(view, {})
    render(<StaffPanels inputs={inputs} />)
    expect(document.querySelector('[data-staff-practical]')?.textContent).toMatch(
      /detector side often receive less/,
    )
    expect(document.querySelector('[data-staff-practical]')?.textContent).toMatch(
      /CBCT spin changes directions/,
    )
  })

  it('the target-ray readout says what the strip is and names no organ', () => {
    render(<SignalReadout profile={null} />)
    const meaning = document.querySelector('[data-ray-meaning]')?.textContent ?? ''
    expect(meaning).toMatch(/One X-ray path from the tube through the target/)
    expect(meaning).toMatch(/does not name the organ/)
    expect(meaning).not.toMatch(/heart|mediastinum/)
  })
})

describe('reports IC4 and O2 — the Safety decision tag is explained, and the modalities are spelled out', () => {
  it('the integrated cases landing and a safety case say what the tag is and is not', async () => {
    render(<PeripheralImagingIntegratedCasesLanding />)
    const note = await screen.findByText(/teaching emphasis only/)
    expect(note.textContent).toMatch(/no case carries more weight/)
    expect(note.textContent).not.toMatch(/score|grade|weighted differently/i)
    cleanup()
    const critical = imagingCases.find((c) => c.critical)!
    render(<ImagingIntegratedCaseActivity caseId={critical.id} />)
    expect(document.querySelector('[data-safety-tag-note]')?.textContent).toMatch(
      /teaching emphasis only/,
    )
    cleanup()
    const routine = imagingCases.find((c) => !c.critical)!
    render(<ImagingIntegratedCaseActivity caseId={routine.id} />)
    expect(document.querySelector('[data-safety-tag-note]')).toBeNull()
  })

  it('the Learn landing spells out DTS and CBCT at first use', async () => {
    render(<PeripheralImagingLearnLanding />)
    await screen.findByText(/Start —/)
    expect(document.querySelector('[data-learn-lede]')?.textContent).toMatch(
      /digital tomosynthesis \(DTS\) and cone-beam CT \(CBCT\)/,
    )
  })
})

describe('independent review — owner holds stay visible', () => {
  it.each(['source', 'detector'] as const)(
    'marks the %s ownership account as a draft',
    (stopId) => {
      render(<ChainWalkCard stopId={stopId} stepId="review" />)
      const note = document.querySelector('[data-pulse-ownership-review]')!
      expect(note.textContent).toMatch(
        /Draft control-ownership account.*awaiting source-owner review/,
      )
      expect(note.closest('dd')?.textContent).toMatch(/generator/)
    },
  )

  it.each([
    ['field', 'binning'],
    ['current-anatomy', 'stored-contour'],
  ] as const)('renders the held definition in %s with its review status', (sectionId, term) => {
    render(<SectionGlossary sectionId={sectionId} variant="teaching" />)
    const entry = document.querySelector(`[data-glossary-term="${term}"]`)!
    expect(entry.getAttribute('data-glossary-status')).toBe('drafted')
    expect(entry.querySelector('small')?.textContent).toMatch(/awaiting the owner’s review/)
  })
})
