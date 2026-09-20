import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { PeripheralImagingLearnLanding } from '../components/PeripheralImagingLearnLanding'
import { peripheralImagingPathwaySections } from '../content/pathway'
import { imagingStageLesson } from '../content/stageLessons'
import {
  createEmptyImagingProgress,
  IMAGING_PROGRESS_STORAGE_KEY,
  withLocation,
  type ImagingProgress,
} from '../engine/selfPacedProgress'
import {
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowSecondary,
  placeSortRows,
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
  installDom()
})
afterEach(cleanup)

function store(progress: ImagingProgress) {
  localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

/*
 * PI-FELLOW-01, the rendered side of reports 1.7, 1.10 and O1 (AI-assisted fellow walkthrough,
 * PDF pp.4, 12 and 13). Each of these fails against the pre-repair module.
 */

/** The stage harness advances its own timers; the landing renders under real ones. */
function withFakeTimers() {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())
}

describe('report 1.7 — the control reference in a section that adjusts nothing', () => {
  withFakeTimers()
  const stripInSummary = () => {
    const disclosure = [...document.querySelectorAll('details')].find((node) =>
      node.querySelector('summary')?.textContent?.includes('Troubleshooting and control reference'),
    )
    return {
      disclosure,
      rows: [
        ...(disclosure?.querySelectorAll('[data-teaching-block="control-strip"] li') ?? []),
      ].map((row) => row.textContent?.trim() ?? ''),
    }
  }

  it('prints no five-row template in a section with no control, and keeps its sentence', () => {
    const lesson = imagingStageLesson('imaging-questions')
    mountSection('imaging-questions')
    // Walk to the summary, which is where the reference disclosure lives.
    for (let guard = 0; currentStepId() !== lesson.steps.at(-1)!.id; guard++) {
      if (guard > 20) throw new Error(`stuck on ${currentStepId()}`)
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      const primary = nowPrimary()
      if (primary && !primary.disabled) fireEvent.click(primary)
      else if (skip) fireEvent.click(skip)
      else throw new Error(`no way past ${currentStepId()}`)
    }
    const { disclosure, rows } = stripInSummary()
    expect(disclosure).not.toBeUndefined()
    expect(rows).toEqual([])
    expect(disclosure!.textContent).toMatch(/No control here/i)
  })

  it('keeps the reference in a section where one control is in play', () => {
    const lesson = imagingStageLesson('chain-walk')
    mountSection('chain-walk')
    for (let guard = 0; currentStepId() !== lesson.steps.at(-1)!.id; guard++) {
      if (guard > 20) throw new Error(`stuck on ${currentStepId()}`)
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      const primary = nowPrimary()
      if (primary && !primary.disabled) fireEvent.click(primary)
      else if (skip) fireEvent.click(skip)
      else throw new Error(`no way past ${currentStepId()}`)
    }
    const { rows } = stripInSummary()
    expect(rows.length).toBe(5)
    expect(rows.some((row) => /relevant to this question/.test(row))).toBe(true)
  })
})

describe('report 1.10 — a checked set can be placed again', () => {
  withFakeTimers()
  const selects = () => [
    ...document.querySelectorAll<HTMLSelectElement>('[data-imaging-sort] select'),
  ]
  const verdicts = () => [...document.querySelectorAll('[data-sort-verdict]')]

  it('offers the placements back, keeps every row explanation, and records no attempt', () => {
    const lesson = imagingStageLesson('imaging-questions')
    const sortStep = lesson.steps.find((step) => step.interaction.kind === 'sort')!
    mountSection('imaging-questions')
    while (currentStepId() !== sortStep.id) clickPrimary()

    placeSortRows()
    clickPrimary()
    expect(selects().every((select) => select.disabled)).toBe(true)
    expect(verdicts().length).toBe(selects().length)

    const retry = nowSecondary()!
    expect(retry.textContent).toMatch(/Place these again/)
    fireEvent.click(retry)

    // The rows are live again, with the learner's placements still in them.
    expect(selects().every((select) => select.disabled)).toBe(false)
    expect(selects().every((select) => select.value !== '')).toBe(true)
    // The reveal is available again, and the step can still simply be left.
    expect(nowSecondary()!.textContent).toMatch(/Show the matches/)
    expect(document.querySelector('[data-now-card] [data-now-skip]')!.textContent).toMatch(
      /Continue without matching/,
    )

    // Nothing about the attempt reached the record.
    const progress = storedProgress()
    expect(progress.reviewedSectionIds).toEqual([])
    expect(JSON.stringify(progress)).not.toMatch(/score|attempt|correct/i)

    // And it can be checked again.
    placeSortRows()
    clickPrimary()
    expect(verdicts().length).toBe(selects().length)
  })
})

describe('report O1 — a second, non-destructive door to the first section', () => {
  const startFirst = () => document.querySelector('[data-imaging-start-first]')

  it('offers Start at Section 1 beside Resume on a device with saved progress', async () => {
    const returning = withLocation(createEmptyImagingProgress(), {
      kind: 'section',
      id: 'fixed-suite',
    })
    store(returning)
    render(<PeripheralImagingLearnLanding />)
    await screen.findByText(/Resume/)
    const cta = document.querySelector('[data-imaging-continue]')!
    expect(cta.getAttribute('data-next-section')).toBe('fixed-suite')
    const link = startFirst()
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe(
      `/peripheral-imaging/learn?section=${peripheralImagingPathwaySections[0].id}`,
    )
    // It is navigation: the stored record is untouched by rendering or following it.
    expect(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(returning))
    expect(cta.getAttribute('data-resumed')).toBe('true')
  })

  it('stays out of the way when the recommendation is already the first section', async () => {
    render(<PeripheralImagingLearnLanding />)
    await screen.findByText(/Start —/)
    expect(startFirst()).toBeNull()
  })
})
