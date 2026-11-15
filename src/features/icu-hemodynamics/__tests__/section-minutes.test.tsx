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
 * The method counts reading only. A section whose work is mostly in the simulator would be
 * listed at its reading time alone, so such a section is named in `HAND_SET_MINUTES` with its
 * minutes and the reason; this suite then holds its listed minutes to that figure instead.
 *
 * To print the measured table: HD_MINUTES_REPORT=1 npx jest
 * src/features/icu-hemodynamics/__tests__/section-minutes.test.tsx
 */
const TOLERANCE_MINUTES = 2
const TOLERANCE_FRACTION = 0.2

/** Simulator-heavy sections whose minutes are set by hand, not measured, and why. */
const HAND_SET_MINUTES: Readonly<
  Record<string, { readonly minutes: number; readonly reason: string }>
> = {
  'pac-signal-validation': {
    minutes: 20,
    reason:
      'Capstone: its tasks are simulator work (walk the line, the tip, the series and the calculation), which reading time does not count. Owner ruling 2026-11-15: "Keep the capstone at 20".',
  },
}

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

  it.each(
    hemodynamicsPathwaySections
      .map((section) => section.id)
      .filter((sectionId) => !(sectionId in HAND_SET_MINUTES)),
  )('%s lists the reading time its cards measure', (sectionId) => {
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
  })

  it('names only real sections as set by hand, each with its reason', () => {
    const ids = hemodynamicsPathwaySections.map((section) => section.id)
    for (const [sectionId, handSet] of Object.entries(HAND_SET_MINUTES)) {
      expect(ids).toContain(sectionId)
      expect(handSet.reason.length).toBeGreaterThan(40)
    }
  })

  it.each(Object.keys(HAND_SET_MINUTES))(
    '%s keeps the minutes set by hand, which cover at least its reading',
    (sectionId) => {
      const handSet = HAND_SET_MINUTES[sectionId]
      const section = hemodynamicsPathwaySections.find((candidate) => candidate.id === sectionId)!
      const reading = measureSectionReading(sectionId)
      readings.push(reading)
      expect(reading.words).toBeGreaterThan(0)
      expect(section.minutes).toBe(handSet.minutes)
      expect(listedReadingMinutes(sectionId)).toBeGreaterThanOrEqual(reading.minutes)
    },
  )

  afterAll(() => {
    if (!process.env.HD_MINUTES_REPORT) return
    const rows = readings.map((reading) => {
      const caseMinutes = hemodynamicsPracticePairing(reading.sectionId)?.minutes ?? 0
      return `${reading.sectionId}\t${reading.words} words\t${(reading.words / HEMODYNAMICS_READING_WPM).toFixed(1)} min\treading ${reading.minutes} + case ${caseMinutes} = ${reading.minutes + caseMinutes}\tlisted reading ${listedReadingMinutes(reading.sectionId)}${reading.sectionId in HAND_SET_MINUTES ? ' (set by hand)' : ''}`
    })
    console.log(rows.join('\n'))
  })
})
