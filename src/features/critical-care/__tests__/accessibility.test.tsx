import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'

import { CrrtPressureLocalizationLab } from '@/features/baxter-crrt/components/CrrtPressureLocalizationLab'
import { CardiohelpHub } from '@/features/cardiohelp-ecmo/components/CardiohelpHub'
import { CircuitAndMonitors } from '@/features/cardiohelp-ecmo/components/CircuitAndMonitors'
import { EcmoContinueCta } from '@/features/cardiohelp-ecmo/components/EcmoContinueCta'
import { EcmoLearnWorkspace } from '@/features/cardiohelp-ecmo/components/EcmoLearnWorkspace'
import { resolveGuidedLesson } from '@/features/cardiohelp-ecmo/components/LearnLessonPlayer'
import { EcmoDrillTeachingPanel } from '@/features/cardiohelp-ecmo/components/teaching/EcmoDrillTeachingPanel'
import { ecmoDrillTeachingPanelScenarioIds } from '@/features/cardiohelp-ecmo/components/teaching/EcmoDrillTeachingPanel'
import {
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  createInitialSimulationState as createInitialEcmoState,
  ecmoSimulationReducer,
} from '@/features/cardiohelp-ecmo/engine'
import { McsMonitor } from '@/features/mechanical-circulatory-support/components/McsMonitor'
import { createInitialMcsState } from '@/features/mechanical-circulatory-support/engine'
import { CriticalCareConceptDetail } from '../components/CriticalCareConceptDetail'
import { CriticalCareConceptIndex } from '../components/CriticalCareConceptIndex'
import { AssumedConceptStrip } from '../components/AssumedConceptStrip'
import { criticalCareActivities } from '../content/activities'
import { criticalCareConcepts } from '../content/concepts'
import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'
import { ScenarioTeachingDebrief } from '@/features/learning-module/components/ScenarioTeachingDebrief'
import type { ScenarioFeedbackEvent } from '@/features/learning-module/scenarioFeedback'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    // The ECMO entry surfaces pass the object form, which `next/link` accepts and this mock has to
    // resolve so the rendered anchor still carries a real href for axe and for keyboard checks.
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
}))

const catalog: CriticalCarePublicClientCatalog = {
  launcherModules: [],
  modules: [],
  activities: [],
  concepts: criticalCareConcepts,
  pathways: [],
  competencies: [],
  referenceItems: [],
  referenceCategories: [],
}

const feedbackEvent: ScenarioFeedbackEvent = {
  id: 'feedback-a11y',
  actionId: 'action-a11y',
  actionLabel: 'Increase airway pressure',
  timeSeconds: 18,
  timing: 'after-consequence',
  hardInterrupt: false,
  feedback: {
    whatHappened: 'Venous return and modeled right-sided output fell.',
    whyItHappened:
      'The pressure change increased the surrounding pressure and reduced the gradient for venous return.',
    likelyFrame:
      'If you were focused on oxygenation, increasing pressure was a reasonable first thought.',
    theCue:
      'The pressure display improved while flow and perfusion moved in the opposite direction.',
    conceptIds: ['cc.flow.transmural-pressure'],
    evidenceIds: ['tobin-3e-peep'],
  },
}

describe('critical-care accessibility surfaces', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('has no automated violations on the concept index and detail views', async () => {
    const index = render(<CriticalCareConceptIndex catalog={catalog} />)
    expect(await axe(index.container)).toHaveNoViolations()
    index.unmount()

    const detail = render(
      <CriticalCareConceptDetail concept={criticalCareConcepts[0]} catalog={catalog} />,
    )
    expect(await axe(detail.container)).toHaveNoViolations()
  })

  it('keeps the inline refresher keyboard-operable and free of automated violations', async () => {
    const activity = criticalCareActivities.find((item) => item.assumedConceptIds.length > 0)
    if (!activity) throw new Error('Expected an activity with an assumed concept.')

    const view = render(
      <AssumedConceptStrip
        activityId={activity.id}
        conceptIds={activity.assumedConceptIds.slice(0, 2)}
      />,
    )
    const firstConcept = await screen.findByRole('button', {
      name: new RegExp(
        criticalCareConcepts.find((item) => item.id === activity.assumedConceptIds[0])?.title ??
          'concept',
        'i',
      ),
    })
    await userEvent.click(firstConcept)
    await waitFor(() => expect(firstConcept).toHaveAttribute('aria-expanded', 'true'))
    expect(await axe(view.container)).toHaveNoViolations()
  })

  it('keeps frame capture and the complete teaching debrief accessible', async () => {
    const onContinue = jest.fn()
    const view = render(
      <ScenarioTeachingDebrief
        scenarioTitle="Coupled heart–lung response"
        decisionTrace={[
          {
            id: 'trace-1',
            timeSeconds: 0,
            action: 'Established a working frame',
            systemState: 'Flow was falling while filling pressure rose.',
          },
        ]}
        expertTrace={[
          {
            id: 'expert-1',
            moment: 'Before acting',
            cue: 'Flow and pressure moved in opposite directions.',
            reasoning: 'The pattern suggested a loading problem rather than inadequate setting.',
            commitment: 'Validate the signal, then make a small reversible change.',
          },
        ]}
        feedbackEvents={[feedbackEvent]}
        conceptIds={['cc.flow.transmural-pressure']}
        evidence={[
          {
            id: 'tobin-3e-peep',
            title: 'Positive end-expiratory pressure',
            citation: 'Principles and Practice of Mechanical Ventilation, third edition.',
          },
        ]}
        onContinue={onContinue}
      />,
    )

    expect(await axe(view.container)).toHaveNoViolations()
    await userEvent.type(
      screen.getByLabelText('My working frame'),
      'The right heart was unloading.',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Capture this frame and reveal the trace' }),
    )
    expect(screen.getByText('A reasonable frame')).toBeVisible()
    expect(screen.getByText('The distinguishing cue')).toBeVisible()
    expect(screen.queryByText(/Read the reasoning cues/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Which cue I trusted' }))
    expect(await axe(view.container)).toHaveNoViolations()
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue to the signal-transfer variant' }),
    )
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('keeps color-coded circuit, pressure, alarm, and trend states readable without color', async () => {
    const ecmo = render(
      <CircuitAndMonitors
        state={createInitialEcmoState('afterload-oxygenator-resistance')}
        dispatch={jest.fn()}
        controlsEnabled={false}
      />,
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Checking this display' }),
      ).not.toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))
    expect(
      screen.getByRole('img', {
        name: /pVen pressure zone.*pInt.*pArt/i,
      }),
    ).toBeInTheDocument()
    const circuitLegend = screen.getByRole('list', { name: 'Circuit schematic legend' })
    for (const label of [
      'Venous drainage limb',
      'Post-pump / membrane path',
      'VV return limb',
      'Pressure or flow sensor',
    ]) {
      expect(within(circuitLegend).getByText(label)).toBeVisible()
    }
    expect(await axe(ecmo.container)).toHaveNoViolations()
    ecmo.unmount()

    const crrt = render(<CrrtPressureLocalizationLab />)
    expect(
      screen.getByRole('img', {
        name: /patient access, access catheter, access line, filter, return line, then patient return/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Access catheter' })).toBeChecked()
    expect(await axe(crrt.container)).toHaveNoViolations()
    crrt.unmount()

    const mcsState = createInitialMcsState('practice', 'impella')
    const mcs = render(
      <McsMonitor
        state={{
          ...mcsState,
          alarms: [
            {
              id: 'cvd-alarm',
              label: 'Purge pressure high',
              priority: 'critical',
              active: true,
              explanation: 'The active state remains named in text.',
            },
          ],
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('CRITICAL · Purge pressure high')
    const trend = screen.getByRole('img', {
      name: /Trend of MAP, effective systemic flow, left pump flow, and right pump flow/i,
    })
    expect(trend.querySelector('[data-series="map"]')).not.toHaveAttribute('stroke-dasharray')
    expect(trend.querySelector('[data-series="effective-flow"]')).toHaveAttribute(
      'stroke-dasharray',
      '12 3',
    )
    expect(trend.querySelector('[data-series="left-pump"]')).toHaveAttribute(
      'stroke-dasharray',
      '6 5',
    )
    expect(trend.querySelector('[data-series="right-pump"]')).toHaveAttribute(
      'stroke-dasharray',
      '3 4',
    )
    expect(await axe(mcs.container)).toHaveNoViolations()
  })

  /*
   * The B3/B4 vertical slice.
   *
   * The drill panels are the new rendered content, and the workspace is the new chrome around it.
   * The workspace is mounted with a plain stand-in for the simulator rather than the real console:
   * the console and the circuit view already have their own axe coverage above, and pulling the 3D
   * circuit into this suite would test WebGL fallbacks rather than the pane structure.
   */
  it.each(ecmoDrillTeachingPanelScenarioIds)(
    'keeps the %s drill teaching panel free of automated violations, before and after commitment',
    async (scenarioId) => {
      let state = createInitialEcmoState(scenarioId, 'guided')
      for (let tick = 0; tick < 8; tick += 1) {
        state = ecmoSimulationReducer(state, { type: 'STEP' })
      }
      const before = render(<EcmoDrillTeachingPanel state={state} />)
      expect(await axe(before.container)).toHaveNoViolations()
      before.unmount()

      const committed = ecmoSimulationReducer(state, {
        type: 'COMMIT_PREDICTION',
        goalId: 'safe-startup',
        control: 'inspect-circuit',
        direction: 'inspect',
      })
      const after = render(<EcmoDrillTeachingPanel state={committed} />)
      expect(await axe(after.container)).toHaveNoViolations()
    },
  )

  it('labels every pane of the ECMO Learn workspace and keeps its chrome accessible', async () => {
    const state = createInitialEcmoState('preload-drainage-collapse', 'guided')
    const view = render(
      <EcmoLearnWorkspace
        state={state}
        lesson={resolveGuidedLesson('preload-drainage-collapse')}
        dispatch={jest.fn()}
        simulator={<div>Live simulator stand-in</div>}
        onSelectLesson={jest.fn()}
        onCompleteLesson={jest.fn()}
        onTryPractice={jest.fn()}
        onTargetChange={jest.fn()}
        onControlHelpChange={jest.fn()}
      />,
    )

    for (const label of ['Live simulator', 'Teaching', 'Current task']) {
      expect(screen.getByRole('region', { name: `${label} panel` })).toBeInTheDocument()
    }
    expect(await axe(view.container)).toHaveNoViolations()
  })

  /**
   * The module's entry surfaces, which had no accessibility coverage at all while they were the
   * two pages every learner meets first.
   */
  it('keeps the ECMO hub accessible for a fresh learner and for one part-way through', async () => {
    const fresh = render(<CardiohelpHub />)
    expect(await axe(fresh.container)).toHaveNoViolations()
    fresh.unmount()

    window.localStorage.setItem(
      CARDIOHELP_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        ...createDefaultProgress(),
        completedFoundationSectionIds: ['why-extracorporeal-support', 'circuit-flow-path'],
      }),
    )
    try {
      const partway = render(<CardiohelpHub />)
      expect(await axe(partway.container)).toHaveNoViolations()
    } finally {
      window.localStorage.clear()
    }
  })

  it('gives the ECMO hub one primary action, reachable and named, at any width', async () => {
    const view = render(<CardiohelpHub />)

    // Exactly one primary call to action, so nothing competes with it at a compact width.
    expect(view.container.querySelectorAll('[data-ecmo-continue]')).toHaveLength(1)

    const primary = screen.getByRole('link', { name: /^Continue —/ })
    const browse = screen.getByRole('link', { name: /^Browse all \d+ sections$/ })
    // Real links, so they are in the tab order and operable by keyboard without a handler.
    for (const control of [primary, browse]) {
      expect(control.tagName).toBe('A')
      expect(control).toHaveAttribute('href')
    }

    // The track chooser is a real radio group — not just the markup of one. Exactly one option is
    // in the tab sequence and the arrow keys move within the group, which is the half that was
    // missing: the roles promised a radio group to assistive technology while the control behaved
    // like two buttons. Full keyboard coverage is in `hub-track-radiogroup.test.tsx`.
    const chooser = screen.getByRole('radiogroup', { name: 'ECMO support mode' })
    const options = within(chooser).getAllByRole('radio')
    expect(options).toHaveLength(2)
    expect(options.filter((option) => option.getAttribute('aria-checked') === 'true')).toHaveLength(
      1,
    )
    expect(options.filter((option) => option.tabIndex === 0)).toHaveLength(1)

    fireEvent.keyDown(options[0]!, { key: 'ArrowRight' })
    expect(options[1]).toHaveAttribute('aria-checked', 'true')
    expect(document.activeElement).toBe(options[1])

    // State is carried in text, not only in colour.
    expect(chooser.textContent).toContain('Selected')
  })

  it('keeps the ECMO Learn landing call to action accessible before and after hydration', async () => {
    const view = render(<EcmoContinueCta supportMode="vv" />)

    const cta = screen.getByRole('link', { name: /^Continue —/ })
    expect(cta).toHaveAttribute(
      'href',
      '/cardiohelp-ecmo/learn?lesson=why-extracorporeal-support&track=vv',
    )
    expect(await axe(view.container)).toHaveNoViolations()
  })
})
