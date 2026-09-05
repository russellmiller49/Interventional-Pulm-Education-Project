import { render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CardiohelpWorkbench } from '../components/CardiohelpWorkbench'
import {
  ecmoDrillTeachingPanelScenarioIds,
  hasEcmoDrillTeachingPanel,
  validateEcmoDrillPanelRegistry,
} from '../components/teaching/EcmoDrillTeachingPanel'
import { cardiohelpLearnLessonByScenarioId, cardiohelpLearnLessons } from '../content/learnLessons'
import { ecmoLearnPredictionFor, ecmoLearnPredictions } from '../content/learnPredictionItems'
import { cardiohelpScenarioById } from '../content/scenarios'

/**
 * B5: the contracts the six-scenario vertical slice is validated against.
 *
 * This file holds the guarantees that belong to the slice as a whole rather than to one component:
 * that the pilot registry is still exactly six panels and the other fourteen still say so plainly,
 * that every prediction can still be answered wrongly, and that the console the Learn route puts in
 * a pane is scaled to fit that pane instead of being cut off by it.
 *
 * The per-component behaviour — pane tabs, scroll restoration, cross-pane help targeting — is
 * asserted in `learn-workspace.test.tsx`, and the learner-facing copy contracts in
 * `resumption-copy-contract.test.ts` and `drill-teaching-panels.test.tsx`. Nothing here duplicates
 * those; this is the slice-level frame around them.
 */

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

const PILOT_SCENARIO_IDS = [
  'startup-sensor-orientation',
  'preload-drainage-collapse',
  'vv-recirculation',
  'gas-source-interruption',
  'arterial-bubble-stop',
  'va-differential-hypoxemia',
] as const

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  mockRouterPush.mockReset()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
})

describe('B5: the pilot slice is exactly six panels, and the rest say so', () => {
  it('registers each pilot scenario once and validates its own registry', () => {
    expect(validateEcmoDrillPanelRegistry()).toEqual([])
    expect([...ecmoDrillTeachingPanelScenarioIds].sort()).toEqual([...PILOT_SCENARIO_IDS].sort())
    expect(new Set(ecmoDrillTeachingPanelScenarioIds).size).toBe(
      ecmoDrillTeachingPanelScenarioIds.length,
    )
  })

  it('leaves every other guided drill on the explicit no-panel fallback', () => {
    const nonPilot = cardiohelpLearnLessons
      .map((lesson) => lesson.scenarioId)
      .filter((scenarioId) => !(PILOT_SCENARIO_IDS as readonly string[]).includes(scenarioId))

    // The slice is six of twenty; if that ratio changes, this package's scope changed with it.
    expect(nonPilot).toHaveLength(cardiohelpLearnLessons.length - PILOT_SCENARIO_IDS.length)
    expect(nonPilot.length).toBeGreaterThan(0)
    for (const scenarioId of nonPilot) {
      expect(hasEcmoDrillTeachingPanel(scenarioId)).toBe(false)
    }
  })
})

describe('B5: every prediction can still be answered wrongly', () => {
  it.each(PILOT_SCENARIO_IDS)('%s offers a best choice and a real alternative', (scenarioId) => {
    const prediction = ecmoLearnPredictionFor(scenarioId)
    expect(prediction).toBeDefined()
    const choices = prediction?.item.choices ?? []

    const best = choices.filter((choice) => choice.plausibility === 'best')
    const wrong = choices.filter((choice) => choice.plausibility !== 'best')

    // Exactly one best answer, and at least two ways to get it wrong: a single distractor makes the
    // commitment a coin toss rather than a decision.
    expect(best).toHaveLength(1)
    expect(wrong.length).toBeGreaterThanOrEqual(2)
    // A choice a learner cannot tell apart from another is not a distractor.
    expect(new Set(choices.map((choice) => choice.label)).size).toBe(choices.length)
  })

  it('keeps all twenty authored predictions answerable, not only the pilot six', () => {
    // Keyed by scenario id, so the count is the number of entries rather than an array length.
    const all = Object.values(ecmoLearnPredictions)
    expect(all.length).toBeGreaterThanOrEqual(20)
    for (const prediction of all) {
      const best = prediction.item.choices.filter((choice) => choice.plausibility === 'best')
      expect(best).toHaveLength(1)
      expect(prediction.item.choices.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('B5: the Learn route scales the console to the pane it lives in', () => {
  /**
   * The console's device grid has a `min-content` width of about 840px, measured in a browser. The
   * primary pane is roughly 650px at 1600 × 900 and less below that, and the pane is
   * `overflow-x: hidden`, so an unscaled console loses its right-hand column outright — including
   * the badge that marks the readings as simulated. `FitWidthSurface` is the same answer the
   * foundation lesson route already uses.
   */
  it('wraps the guided-drill console in a fit-to-width surface', async () => {
    render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(document.querySelector('[data-now-card]')).not.toBeNull()
    })

    const console_ = document.getElementById('cardiohelp-console')
    expect(console_).not.toBeNull()
    const surface = console_?.closest('[data-fit-width-surface]')
    expect(surface).not.toBeNull()
    expect(surface).toHaveAttribute('data-fit-mode', 'fit')

    // Only the console is scaled: the circuit view and monitors lay out in any of these panes, and
    // shrinking their prose would cost readability for a constraint they do not have.
    const circuit = document.getElementById('cardiohelp-circuit-panel')
    expect(circuit).not.toBeNull()
    expect(circuit?.closest('[data-fit-width-surface]')).toBeNull()
  })

  /*
   * R4 put Practice and Challenge on the same lean shell as Learn, so the console is fit-scaled
   * there too (the B5 pin that Practice kept an unscaled console is superseded). What has to stay
   * true on every route is that the one console and one circuit render once, so every guided
   * control id resolves to exactly one element.
   */
  it.each(['practice', 'assess'] as const)(
    'fit-scales the console on the %s route and keeps every guided control id unique',
    async (section) => {
      render(<CardiohelpWorkbench section={section} />)
      await waitFor(() => {
        expect(document.getElementById('cardiohelp-console')).not.toBeNull()
      })
      const surface = document
        .getElementById('cardiohelp-console')
        ?.closest('[data-fit-width-surface]')
      expect(surface).not.toBeNull()
      expect(surface).toHaveAttribute('data-fit-mode', 'fit')
      expect(document.querySelectorAll('#cardiohelp-console')).toHaveLength(1)
      expect(document.querySelectorAll('#cardiohelp-circuit-panel')).toHaveLength(1)
      const ids = Array.from(document.querySelectorAll('[id^="cardiohelp-"]')).map((el) => el.id)
      expect(new Set(ids).size).toBe(ids.length)
    },
  )

  it('still renders exactly one console and one circuit panel on the Learn route', async () => {
    render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(document.querySelector('[data-now-card]')).not.toBeNull()
    })
    // Guided help resolves controls with getElementById, so a second copy would silently retarget it.
    expect(document.querySelectorAll('#cardiohelp-console')).toHaveLength(1)
    expect(document.querySelectorAll('#cardiohelp-circuit-panel')).toHaveLength(1)
  })

  it('keeps every guided control id unique across the whole Learn document', async () => {
    render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(document.querySelector('[data-now-card]')).not.toBeNull()
    })
    const ids = [...document.querySelectorAll('[id^="cardiohelp-"]')].map((node) => node.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('B5: the participant materials carry no answers', () => {
  /**
   * The packet is split so the answer key physically cannot reach the person being observed. This
   * reads the participant file and fails on any of the vocabulary that would give a task away — the
   * one document in the packet a participant sees.
   */
  const participantTasks = readFileSync(
    join(process.cwd(), 'docs/cardiohelp-ecmo/validation/b5-novice-participant-tasks.md'),
    'utf8',
  )

  const BANNED = [
    'best choice',
    'correct answer',
    'the answer is',
    'answer key',
    'expected observation',
    'facilitator',
    'scoring',
    'rubric',
    'recirculation is',
    'because the drainage',
  ]

  it.each(BANNED)('does not contain %p', (phrase) => {
    expect(participantTasks.toLowerCase()).not.toContain(phrase)
  })

  it('states all six tasks without naming a mechanism', () => {
    // Six numbered tasks, matching the six scenarios under validation.
    const numbered = participantTasks.match(/^## Task \d/gm) ?? []
    expect(numbered).toHaveLength(6)
  })

  /**
   * A lesson title is not a neutral way to point someone at a lesson.
   *
   * Four of the six authored lesson titles name the mechanism the task exists to make the learner
   * work out — "VV recirculation despite high displayed flow" answers task 2, "Gas-source
   * interruption with preserved blood flow" answers task 3, and "cause-before-reset" gives away the
   * ordering task 4 asks for. So the participant sheet may not carry a lesson title at all, and the
   * facilitator opens the lesson instead. This is the leak the title-matching test below would
   * otherwise invite someone to introduce while fixing it.
   */
  it.each(PILOT_SCENARIO_IDS)('never names the %s lesson to the participant', (scenarioId) => {
    const lessonTitle = cardiohelpLearnLessonByScenarioId.get(scenarioId)?.title
    const scenarioTitle = cardiohelpScenarioById.get(scenarioId)?.title
    expect(lessonTitle).toBeTruthy()
    expect(participantTasks).not.toContain(lessonTitle)
    // The Practice-surface title for the same case is not a usable substitute either: it does not
    // appear anywhere on the Learn route, so it sends the participant looking for something that is
    // not there.
    if (scenarioTitle) expect(participantTasks).not.toContain(scenarioTitle)
  })

  it('does not ask the participant to open a lesson by name', () => {
    expect(participantTasks).not.toMatch(/open the lesson called/i)
  })
})

describe('B5: the facilitator guide names the lessons the learner actually sees', () => {
  /**
   * The guide's scope table is the one place the packet claims a lesson title, and it is what a
   * facilitator reads before opening anything. It carried `scenario.title` for all six rows — the
   * string the *Practice* surface uses — under a heading promising the title "as the learner sees
   * it". The Learn route shows `lesson.title` in the lesson header and `pathway.title` in the rail,
   * and those are the same string; `scenario.title` appears nowhere on the route. A facilitator
   * following that table looked for six lessons that do not exist under those names.
   *
   * Parsed from the markdown rather than restated here, so the table cannot drift from the content
   * again without this failing.
   */
  const facilitatorGuide = readFileSync(
    join(
      process.cwd(),
      'docs/cardiohelp-ecmo/validation/b5-novice-think-aloud-facilitator-guide.md',
    ),
    'utf8',
  )

  const tableRows = [
    ...facilitatorGuide.matchAll(/^\|\s*\d+\s*\|\s*`([a-z-]+)`\s*\|([^|]*)\|/gm),
  ].map((match) => ({ scenarioId: match[1], title: match[2].trim() }))

  it('lists exactly the six pilot scenarios', () => {
    expect(tableRows.map((row) => row.scenarioId).sort()).toEqual([...PILOT_SCENARIO_IDS].sort())
  })

  it.each(PILOT_SCENARIO_IDS)('gives %s the title the Learn route renders', (scenarioId) => {
    const row = tableRows.find((entry) => entry.scenarioId === scenarioId)
    expect(row).toBeDefined()
    expect(row?.title).toBe(cardiohelpLearnLessonByScenarioId.get(scenarioId)?.title)
  })

  it('warns that the titles themselves name the mechanism', () => {
    // Correcting the table puts the answer into the facilitator's hands, which is where it belongs
    // — but only if the guide says so, because the obvious next move is to read it out.
    expect(facilitatorGuide).toMatch(/do not read the lesson title aloud/i)
  })
})
