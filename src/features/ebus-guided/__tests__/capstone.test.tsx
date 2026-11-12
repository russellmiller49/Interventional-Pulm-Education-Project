import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { CAPSTONE_CONCLUSION, CAPSTONE_STATIONS, capstoneLessons } from '../content/capstone'
import { CHAPTERS, LESSONS, lessonById, partsOf } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { locateLessons } from '../content/locate'
import { EBUS_NUMBERS } from '../content/teachingNumbers'
import { mapStation, nCategory } from '../content/station-map'
import { LessonHost } from '../components/LessonHost'
import { StagingRecord } from '../components/StagingRecord'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/ebus-guided/learn',
}))

/*
 * The capstone (2026-11-11): one staging examination at four stations, in the order the course
 * teaches, on the labs the learner already used, ending on the record of that examination.
 */
const lesson = lessonById('staging-examination')!
const activities = activitiesForLesson(lesson)
const unit = (id: string) => partsOf(lesson).find((part) => part.id === id)!

describe('where the capstone sits', () => {
  it('is the last lesson, in a chapter of its own', () => {
    expect(LESSONS.at(-1)!.id).toBe('staging-examination')
    expect(CHAPTERS.at(-1)).toMatchObject({ id: 'capstone', title: 'Put the examination together' })
    expect(CHAPTERS.at(-1)!.lessons).toHaveLength(1)
  })

  it('is built from the case and one unit per station', () => {
    expect(partsOf(lesson).map((part) => part.id)).toEqual([
      'staging-examination',
      ...CAPSTONE_STATIONS.map((entry) => entry.unitId),
    ])
    expect(capstoneLessons).toHaveLength(5)
  })
})

describe('the order of the examination', () => {
  it('samples N3, then N2, then N1 for a right lung primary', () => {
    expect(CAPSTONE_STATIONS.map((entry) => entry.station)).toEqual(['4L', '7', '4R', '11Ri'])
    expect(CAPSTONE_STATIONS.map((entry) => entry.category)).toEqual(['N3', 'N2', 'N2', 'N1'])
  })

  it('agrees with the course’s station map on every category', () => {
    for (const entry of CAPSTONE_STATIONS) {
      expect(nCategory(mapStation(entry.station)!, 'right')).toBe(entry.category)
    }
  })

  it('opens on the prediction, then the case, and never shows the order before the commitment', () => {
    expect(activities[0]).toMatchObject({ kind: 'prediction', image: 'none', teaching: [] })
    expect(activities[1]).toMatchObject({ kind: 'briefing', figure: 'station-map-n' })
    const first = lesson.question
    expect(first.choices.find((choice) => choice.correct)!.text).toBe('4L')
    // The stem names the nodes without their categories.
    expect(first.prompt).not.toMatch(/N[123]/)
  })

  it('scans and then samples each station, in order, in the lab the learner already used', () => {
    const visits = activities.filter((activity) => activity.lessonId !== 'staging-examination')
    expect(visits.map((activity) => activity.id)).toEqual(
      CAPSTONE_STATIONS.flatMap((entry) => [entry.unitId + ':scan', entry.unitId + ':sample']),
    )
    const labOf = (id: string) => locateLessons.find((item) => item.id === id)!.lab
    expect(unit('staging-exam-4l').lab).toBe(labOf('left-paratracheal'))
    expect(unit('staging-exam-7').lab).toBe(labOf('station-seven'))
    expect(unit('staging-exam-4r').lab).toBe(labOf('right-paratracheal'))
    expect(unit('staging-exam-11ri').lab).toBe(labOf('hilar-interlobar'))
    for (const entry of CAPSTONE_STATIONS) {
      const scan = activities.find((activity) => activity.id === entry.unitId + ':scan')!
      const sample = activities.find((activity) => activity.id === entry.unitId + ':sample')!
      expect(scan).toMatchObject({ interaction: 'acquire', image: 'live' })
      // Two checks on the learner's own image: the landmarks, then what the sample settles.
      expect(sample).toMatchObject({ image: 'held', questions: ['observation', 'question'] })
      expect(unit(entry.unitId).observation.imagePolicy).toBe('retained-acquisition')
    }
  })

  it('ends on the report check and then the record', () => {
    expect(activities.at(-2)).toMatchObject({ kind: 'transfer', questions: ['transfer'] })
    expect(activities.at(-1)).toMatchObject({
      id: 'staging-examination:examination-record',
      figure: 'staging-summary',
      interaction: 'read',
    })
  })
})

describe('what the samples support', () => {
  const correct = (id: string) =>
    partsOf(lesson)
      .flatMap((part) => [part.question, part.observation, part.transfer])
      .find((item) => item.id === id)!
      .choices.find((choice) => choice.correct)!

  it('reads lymphocytes without malignant cells as representative and negative so far', () => {
    expect(correct('exam-4l-result').text).toMatch(/represents the node/)
    expect(correct('exam-4l-result').text).toMatch(/final pathology is pending/)
  })

  it('goes on to the second N2 station after a malignant one', () => {
    expect(correct('exam-7-result').text).toMatch(/Go on to 4R/)
    expect(correct('exam-7-result').rationale).toContain('(AABIP 2025)')
  })

  it('does not call blood alone a negative node', () => {
    expect(correct('exam-4r-result').text).toMatch(/does not represent the node/)
    const wrong = unit('staging-exam-4r').question.choices.find((choice) =>
      choice.text.startsWith('4R is negative'),
    )!
    expect(wrong.correct).toBeFalsy()
  })

  it('concludes N2a: one involved N2 station, with the N1 station not counted toward N2', () => {
    expect(correct('exam-11ri-result').text).toMatch(/^N2a/)
    expect(correct('exam-report').text).toMatch(/^N2a/)
    expect(CAPSTONE_CONCLUSION).toContain('N2a')
    expect(CAPSTONE_CONCLUSION).toContain('provisional until final pathology')
    const involvedN2 = CAPSTONE_STATIONS.filter(
      (entry) => entry.category === 'N2' && entry.finding === 'Malignant cells',
    )
    expect(involvedN2.map((entry) => entry.station)).toEqual(['7'])
  })

  it('introduces no number that is not in the course’s register', () => {
    const copy = capstoneLessons
      .flatMap((part) => [
        part.objective,
        part.recall,
        ...part.paragraphs,
        ...part.takeaways,
        part.matching?.explanation ?? '',
        ...[part.question, part.observation, part.transfer].flatMap((item) => [
          item.prompt,
          ...item.choices.flatMap((choice) => [choice.text, choice.rationale]),
        ]),
      ])
      .join(' ')
      // Station names, N categories and the guideline year are not quantities.
      .replace(/\b(2|4|10)[LR]\b|\b11(L|Rs|Ri)\b|\bN[123][ab]?\b|\bAABIP 2025\b|\b7\b/g, '')
    expect(copy).not.toMatch(/\d/)
    // The register is still the only source of teaching numbers.
    expect(EBUS_NUMBERS.value('passes-per-station')).toBe('at least 4')
  })
})

describe('the record of the examination', () => {
  const draw = (scanned: string[], answers: Record<string, string>) =>
    render(<StagingRecord scanned={(id) => scanned.includes(id)} answers={answers} />)
  const right = (id: string) =>
    partsOf(lesson)
      .flatMap((part) => [part.question, part.observation, part.transfer])
      .find((item) => item.id === id)!
      .choices.find((choice) => choice.correct)!.id

  it('lists the four stations in order with their category and on-site result', () => {
    draw([], {})
    const rows = document.querySelectorAll('[data-staging-record] tbody tr')
    expect([...rows].map((row) => row.getAttribute('data-station'))).toEqual([
      '4L',
      '7',
      '4R',
      '11Ri',
    ])
    expect(within(rows[2] as HTMLElement).getByText(/Blood only at first/)).toBeVisible()
    expect(screen.getByText(CAPSTONE_CONCLUSION)).toBeVisible()
  })

  it('says what the learner did at each station, and claims nothing they did not do', () => {
    draw(['staging-exam-4l'], {
      'exam-4l-observe': right('exam-4l-observe'),
      'exam-4l-result': 'a',
    })
    const rows = document.querySelectorAll('[data-staging-record] tbody tr')
    expect(rows[0].querySelector('[data-scan]')).toHaveTextContent('Image held')
    expect(rows[0].querySelector('[data-checks]')).toHaveTextContent('1 of 2 correct')
    expect(rows[1].querySelector('[data-scan]')).toHaveTextContent('No image held')
    expect(rows[1].querySelector('[data-checks]')).toHaveTextContent('Not answered')
    expect(document.querySelector('[data-your-report]')).toHaveTextContent(
      'You moved on without choosing one.',
    )
  })

  it('shows the learner’s own report statement beside the conclusion', () => {
    draw([], { 'exam-report': right('exam-report') })
    expect(document.querySelector('[data-your-report]')).toHaveTextContent(
      /^Your report statement\. N2a/,
    )
    expect(document.querySelector('[data-your-report]')).not.toHaveTextContent('Compare it')
  })
})

describe('the capstone on the lesson page', () => {
  it('opens on the prediction with no case text, map or lab', () => {
    render(<LessonHost lesson={lesson} />)
    expect(
      screen.getByRole('heading', { name: 'Choose the first station to sample' }),
    ).toBeVisible()
    expect(screen.queryByText(lesson.paragraphs[0])).not.toBeInTheDocument()
    expect(document.querySelector('[data-view]')).toBeNull()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('shows the case and the map for a right lung primary after the prediction', () => {
    render(<LessonHost lesson={lesson} />)
    act(() => {
      fireEvent.click(document.querySelector('[data-now-primary]') as HTMLButtonElement)
    })
    expect(screen.getByText(lesson.paragraphs[0])).toBeVisible()
    expect(document.querySelector('[data-view]')).toHaveAttribute('data-view', 'n-category')
    expect(screen.getByRole('button', { name: 'Right lung', pressed: true })).toBeVisible()
  })
})
