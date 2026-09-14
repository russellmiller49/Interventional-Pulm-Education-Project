import fs from 'node:fs'
import path from 'node:path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { ImagingCaseActivity } from '../components/ImagingCaseActivity'
import { ImagingIntegratedCaseActivity } from '../components/ImagingIntegratedCaseActivity'
import { PeripheralImagingHub } from '../components/PeripheralImagingHub'
import { PeripheralImagingIntegratedCasesLanding } from '../components/PeripheralImagingIntegratedCasesLanding'
import { PeripheralImagingLearnLanding } from '../components/PeripheralImagingLearnLanding'
import { PeripheralImagingPracticeLanding } from '../components/PeripheralImagingPracticeLanding'
import { imagingMicroCasesInPathwayOrder } from '../content/microCases'
import { LEGACY_IMAGING_RECORD_KEY_V1, LEGACY_IMAGING_RECORD_KEY_V2 } from '../engine/learnProgress'
import {
  createEmptyImagingProgress,
  IMAGING_PROGRESS_STORAGE_KEY,
  markImagingSectionReviewed,
  parseImagingProgress,
  readImagingProgress,
  recordImagingLocation,
  setImagingSectionReviewLater,
  withLocation,
  withReviewLater,
  withSectionReviewed,
} from '../engine/selfPacedProgress'
import {
  clickPrimary,
  clickSkip,
  currentStepId,
  installDom,
  mountSection,
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

const NOW = '2026-09-14T12:00:00.000Z'
const DECLARED_FIELDS = [
  'lastLocation',
  'openedIntegratedCaseIds',
  'openedPracticeCaseIds',
  'reviewLaterSectionIds',
  'reviewedSectionIds',
  'updatedAt',
  'version',
  'visitedSectionIds',
]

/** Bytes the pre-conversion course wrote, unknown fields and all. */
const LEGACY_V2 =
  '{"version":2,"completedSectionIds":["imaging-questions","projection"],"lastSectionId":"projection","firstAttempts":{"projection:projection-interpretation-v2":{"choiceId":"a","correct":false,"at":"2026-09-10T00:00:00.000Z"},"capstone:case-6":{"choiceId":"a","correct":false,"at":"2026-09-10T00:00:00.000Z"}},"capstoneDebriefViewedAt":"2026-09-10T00:00:00.000Z","updatedAt":"2026-09-10T00:00:00.000Z"}'
const LEGACY_V1 =
  '{"version":1,"lessonId":"signal","phase":"check","answers":{"suite-cases:case-1":{"choice":"b","correct":true}},"reviewed":["imaging-questions"],"unknown":{"kept":true}}'

/** Walk a section to its end the way a learner who answers nothing would. */
function skipThroughSection(sectionId: 'projection' | 'imaging-questions') {
  const { lesson } = mountSection(sectionId)
  for (let count = 0; !document.querySelector('[data-section-completion]'); count += 1) {
    if (count > lesson.steps.length) throw new Error(`${sectionId} did not end`)
    const step = lesson.steps.find((candidate) => candidate.id === currentStepId())!
    if (step.interaction.kind === 'read' || step.interaction.kind === 'explain') clickPrimary()
    else clickSkip()
  }
  return lesson
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

describe('the self-paced record', () => {
  it('declares only location, opened, reviewed and saved-for-review state', () => {
    expect(Object.keys(createEmptyImagingProgress()).sort()).toEqual(DECLARED_FIELDS)
    let progress = withLocation(
      createEmptyImagingProgress(),
      { kind: 'section', id: 'projection' },
      NOW,
    )
    progress = withLocation(progress, { kind: 'practice-case', id: 'signal-practice-1' }, NOW)
    progress = withLocation(progress, { kind: 'integrated-case', id: 'case-6' }, NOW)
    progress = withSectionReviewed(progress, 'projection', NOW)
    progress = withReviewLater(progress, 'signal', true, NOW)
    expect(progress).toEqual({
      version: 1,
      lastLocation: { kind: 'integrated-case', id: 'case-6' },
      visitedSectionIds: ['projection'],
      reviewedSectionIds: ['projection'],
      reviewLaterSectionIds: ['signal'],
      openedPracticeCaseIds: ['signal-practice-1'],
      openedIntegratedCaseIds: ['case-6'],
      updatedAt: NOW,
    })
    expect(parseImagingProgress(JSON.stringify(progress))).toEqual(progress)
  })

  it('changes nothing when a location, mark or bookmark is already what it would set', () => {
    const here = withLocation(
      createEmptyImagingProgress(),
      { kind: 'section', id: 'projection' },
      NOW,
    )
    expect(withLocation(here, { kind: 'section', id: 'projection' }, NOW)).toBe(here)
    const reviewed = withSectionReviewed(here, 'projection', NOW)
    expect(withSectionReviewed(reviewed, 'projection', NOW)).toBe(reviewed)
    expect(withReviewLater(reviewed, 'projection', false, NOW)).toBe(reviewed)
  })

  it('refuses malformed records, other versions, unknown places and anything carrying responses', () => {
    const empty = createEmptyImagingProgress()
    expect(parseImagingProgress('{')).toBeNull()
    expect(parseImagingProgress(JSON.stringify({ ...empty, version: 2 }))).toBeNull()
    expect(parseImagingProgress(JSON.stringify({ ...empty, firstAttempts: {} }))).toBeNull()
    expect(
      parseImagingProgress(
        JSON.stringify({ ...empty, lastLocation: { kind: 'capstone', id: 'case-1' } }),
      ),
    ).toBeNull()
  })

  it('leaves a stored value it cannot read exactly as it is, and saves nothing over it', () => {
    localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, '{"version":1,"unexpected":true}')
    expect(readImagingProgress().status).toBe('unreadable')
    expect(recordImagingLocation({ kind: 'section', id: 'projection' })).toBe(false)
    expect(markImagingSectionReviewed('projection')).toBe(false)
    expect(setImagingSectionReviewLater('projection', true)).toBe(false)
    expect(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)).toBe(
      '{"version":1,"unexpected":true}',
    )
  })

  it('keeps the course open, unsaved, when this browser refuses storage', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    try {
      expect(readImagingProgress().status).toBe('unavailable')
      expect(recordImagingLocation({ kind: 'section', id: 'projection' })).toBe(false)
      render(<PeripheralImagingHub />)
      expect(document.querySelector('[data-progress-status="unavailable"]')).not.toBeNull()
      expect(document.querySelector('[data-imaging-continue]')?.textContent).toMatch(/^Start — /)
    } finally {
      getItem.mockRestore()
    }
  })
})

describe('the self-paced boundary', () => {
  it('a whole self-paced journey leaves the legacy records byte-for-byte and writes only the declared record', () => {
    localStorage.setItem(LEGACY_IMAGING_RECORD_KEY_V2, LEGACY_V2)
    localStorage.setItem(LEGACY_IMAGING_RECORD_KEY_V1, LEGACY_V1)

    // The hub: completion stored by the old course does not move the door.
    render(<PeripheralImagingHub />)
    expect(document.querySelector('[data-imaging-continue]')?.textContent).toMatch(/^Start — /)
    cleanup()

    // A practice case: the explanation, a checked answer, another try.
    const practice = imagingMicroCasesInPathwayOrder()[0]
    render(<ImagingCaseActivity caseId={practice.id} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    fireEvent.click(
      document.querySelector(
        `[data-prediction-choices] input[value="${practice.item.choices[0].id}"]`,
      )!,
    )
    fireEvent.click(document.querySelector('[data-now-primary]')!)
    fireEvent.click(document.querySelector('[data-answer-again]')!)
    cleanup()

    // The integrated case the legacy record holds a capstone decision for.
    render(<ImagingIntegratedCaseActivity caseId="case-6" />)
    fireEvent.click(document.querySelector('[data-prediction-choices] input[value="b"]')!)
    fireEvent.click(document.querySelector('[data-now-primary]')!)
    cleanup()

    // A whole Learn section, skipped to its end, then saved for review.
    skipThroughSection('projection')
    fireEvent.click(document.querySelector('[data-review-later-toggle]')!)

    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBe(LEGACY_V2)
    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V1)).toBe(LEGACY_V1)
    const keys = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index),
    ).sort()
    expect(keys).toEqual(
      [
        LEGACY_IMAGING_RECORD_KEY_V1,
        LEGACY_IMAGING_RECORD_KEY_V2,
        IMAGING_PROGRESS_STORAGE_KEY,
      ].sort(),
    )
    const record = JSON.parse(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)!)
    expect(Object.keys(record).sort()).toEqual(DECLARED_FIELDS)
    expect(record).toMatchObject({
      lastLocation: { kind: 'section', id: 'projection' },
      visitedSectionIds: ['projection'],
      reviewedSectionIds: ['projection'],
      reviewLaterSectionIds: ['projection'],
      openedPracticeCaseIds: [practice.id],
      openedIntegratedCaseIds: ['case-6'],
    })
    expect(JSON.stringify(record)).not.toMatch(/choice|correct|attempt|answer|hint|help|score/i)
  })

  it('no current module imports the legacy records, and only the self-paced record writes storage', () => {
    const featureRoot = path.resolve(__dirname, '..')
    const routeRoot = path.resolve(__dirname, '../../../app/[locale]/peripheral-imaging')
    const sources = [...listFiles(featureRoot), ...listFiles(routeRoot)].filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) &&
        !/[\\/](__tests__|test-support)[\\/]/.test(file) &&
        !/\.test\.tsx?$/.test(file),
    )
    expect(sources.length).toBeGreaterThan(50)
    const relative = (file: string) => path.relative(featureRoot, file)
    const legacyImporters = sources.filter((file) =>
      /from\s+['"][^'"]*learnProgress['"]/.test(fs.readFileSync(file, 'utf8')),
    )
    expect(legacyImporters.map(relative)).toEqual([])
    const storageWriters = sources.filter((file) =>
      /\b(?:localStorage|sessionStorage|store)\.(?:setItem|removeItem|clear)\(/.test(
        fs.readFileSync(file, 'utf8'),
      ),
    )
    expect(storageWriters.map(relative)).toEqual([path.join('engine', 'selfPacedProgress.ts')])
  })

  it('says nothing, in visible or accessible text, that grades, locks or keeps first answers', () => {
    const GRADE_LANGUAGE = [
      /capstone/i,
      /decisions? held/i,
      /standard (?:met|not)/i,
      /first (?:decision|answer|attempt)/i,
      /worked through/i,
      /on your record/i,
      /independent interpretation/i,
      /assess page/i,
      /does not count as an answer/i,
      /sections first/i,
      /\bscor(?:e|ed|es|ing)\b/i,
      /\bmaster(?:y|ed)\b/i,
    ]
    const scan = (where: string) => {
      const text = [
        document.body.textContent ?? '',
        ...[...document.body.querySelectorAll('*')].flatMap((node) =>
          ['aria-label', 'title', 'alt'].map((name) => node.getAttribute(name) ?? ''),
        ),
      ].join(' ')
      expect([where, GRADE_LANGUAGE.filter((pattern) => pattern.test(text)).map(String)]).toEqual([
        where,
        [],
      ])
    }

    render(<PeripheralImagingHub />)
    scan('hub')
    cleanup()
    render(<PeripheralImagingLearnLanding />)
    scan('learn landing')
    cleanup()
    render(<PeripheralImagingPracticeLanding />)
    scan('practice landing')
    cleanup()
    render(<ImagingCaseActivity caseId={imagingMicroCasesInPathwayOrder()[0].id} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    scan('practice case')
    cleanup()
    render(<PeripheralImagingIntegratedCasesLanding />)
    scan('integrated cases')
    cleanup()
    render(<ImagingIntegratedCaseActivity caseId="case-6" />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    scan('integrated case')
    cleanup()
    for (const sectionId of ['imaging-questions', 'projection'] as const) {
      skipThroughSection(sectionId)
      scan(`${sectionId} completion`)
      cleanup()
    }
  })
})
