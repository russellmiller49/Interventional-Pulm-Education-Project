import { hemodynamicsPathwaySections } from '../content/pathwayResolver'
import { hemodynamicsPracticePairing } from '../content/sectionSpecs'
import { installDom } from '../test-support/stageHarness'
import {
  HEMODYNAMICS_READING_WPM,
  measureSectionReading,
  type SectionReading,
} from '../test-support/sectionReading'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/icu-hemodynamics/learn',
}))

/**
 * The section minutes follow the text on screen (owner ruling 2026-11-14, "Rebuild per section").
 *
 * A section's listed minutes are its measured reading time (`test-support/sectionReading.tsx`:
 * task-card words a learner who works the section sees, folds closed, at 200 words a minute,
 * rounded to the minute) plus its case's own minutes. This suite fails when a section's listed
 * reading time drifts from the measured one by more than the tolerance below, so a text edit that
 * moves a section's length by more than a few minutes has to move its minutes too (both
 * `critical-care/content/learningPathways.ts` and `critical-care/content/activities.ts`).
 *
 * To print the measured table: HD_MINUTES_REPORT=1 npx jest
 * src/features/icu-hemodynamics/__tests__/section-minutes.test.tsx
 */
const TOLERANCE_MINUTES = 2
const TOLERANCE_FRACTION = 0.2

beforeAll(() => installDom())
beforeEach(() => {
  jest.useFakeTimers()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => {
  jest.useRealTimers()
})

function listedReadingMinutes(sectionId: string): number {
  const section = hemodynamicsPathwaySections.find((candidate) => candidate.id === sectionId)!
  return section.minutes - (hemodynamicsPracticePairing(sectionId)?.minutes ?? 0)
}

describe('hemodynamics section minutes', () => {
  const readings: SectionReading[] = []

  it.each(hemodynamicsPathwaySections.map((section) => section.id))(
    '%s lists the reading time its cards measure',
    (sectionId) => {
      const reading = measureSectionReading(sectionId)
      readings.push(reading)
      const listed = listedReadingMinutes(sectionId)
      const allowed = Math.max(TOLERANCE_MINUTES, Math.round(reading.minutes * TOLERANCE_FRACTION))
      expect(reading.words).toBeGreaterThan(0)
      expect({
        sectionId,
        words: reading.words,
        measured: reading.minutes,
        listed,
        withinTolerance: Math.abs(listed - reading.minutes) <= allowed,
      }).toEqual({
        sectionId,
        words: reading.words,
        measured: reading.minutes,
        listed,
        withinTolerance: true,
      })
    },
  )

  afterAll(() => {
    if (!process.env.HD_MINUTES_REPORT) return
    const rows = readings.map((reading) => {
      const caseMinutes = hemodynamicsPracticePairing(reading.sectionId)?.minutes ?? 0
      return `${reading.sectionId}\t${reading.words} words\t${(reading.words / HEMODYNAMICS_READING_WPM).toFixed(1)} min\treading ${reading.minutes} + case ${caseMinutes} = ${reading.minutes + caseMinutes}\tlisted reading ${listedReadingMinutes(reading.sectionId)}`
    })
    console.log(rows.join('\n'))
  })
})
