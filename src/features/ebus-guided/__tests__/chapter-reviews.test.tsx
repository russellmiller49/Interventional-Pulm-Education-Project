import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import { CHAPTER_REVIEWS, chapterReview, reviewHref } from '../content/chapter-reviews'
import { CHAPTERS, CONTENT_LESSONS, LESSONS, lessonById } from '../content/curriculum'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { teachingClip } from '../content/clips'
import { annotationsFor, NODE_FEATURE_IMAGES, READING_ITEMS } from '../content/node-features'
import { ChapterReviewPage } from '../components/ChapterReviewPage'
import { CoursePage } from '../components/CoursePage'
import { LessonHost } from '../components/LessonHost'
import { stillAnnotation } from '../components/StationFigure'

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
 * Chapter reviews (2026-11-11): image questions at the end of a chapter, on images whose labels
 * the owner has already checked. These tests hold each question to the labels on its own image,
 * so a change to an outline file cannot leave a stem saying something the image no longer shows.
 */
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

const stillRegions = (station: string) => {
  const asset = media[station as keyof typeof media].ebusVariants[0]
  return stillAnnotation('annotationKey' in asset ? asset.annotationKey : undefined)!.regions.map(
    (region) => region.label,
  )
}
const items = CHAPTER_REVIEWS.flatMap((review) =>
  review.items.map((item) => ({ ...item, chapterId: review.chapterId })),
)
const byId = (id: string) => items.find((item) => item.question.id === id)!
const keyed = (id: string) => byId(id).question.choices.find((choice) => choice.correct)!

describe('which chapters have a review', () => {
  it('closes four chapters, each with three image questions', () => {
    expect(CHAPTER_REVIEWS.map((review) => review.chapterId)).toEqual([
      'anatomy',
      'plan',
      'sample',
      'report',
    ])
    for (const review of CHAPTER_REVIEWS) {
      expect(CHAPTERS.some((chapter) => chapter.id === review.chapterId)).toBe(true)
      expect(review.items).toHaveLength(3)
    }
    expect(chapterReview('prepare')).toBeUndefined()
    expect(reviewHref('anatomy')).toBe('/ebus-guided/learn?review=anatomy')
  })

  it('draws only on lessons the learner has finished by the end of that chapter', () => {
    for (const review of CHAPTER_REVIEWS) {
      const through = CHAPTERS.findIndex((chapter) => chapter.id === review.chapterId)
      const finished = CHAPTERS.slice(0, through + 1).flatMap((chapter) =>
        chapter.lessons.map((lesson) => lesson.id),
      )
      for (const item of review.items) {
        expect(lessonById(item.lessonId)).toBeDefined()
        expect(finished).toContain(lessonById(item.lessonId)!.id)
      }
      // Mixed: a review is never three questions from one lesson.
      expect(new Set(review.items.map((item) => item.lessonId)).size).toBeGreaterThan(1)
    }
  })

  it('asks new questions: no id is shared with a lesson, a case or the reading task', () => {
    const existing = [
      ...CONTENT_LESSONS.flatMap((unit) => [unit.question, unit.observation, unit.transfer]),
      ...[...FINAL_CASES, ...PRACTICE_CASES].flatMap((entry) => entry.questions),
      ...READING_ITEMS.map((entry) => entry.question),
    ]
    const ids = items.map((item) => item.question.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of items) {
      expect(existing.some((other) => other.id === item.question.id)).toBe(false)
      expect(existing.some((other) => other.prompt === item.question.prompt)).toBe(false)
      expect(item.question.choices).toHaveLength(3)
      expect(item.question.choices.filter((choice) => choice.correct)).toHaveLength(1)
    }
  })
})

describe('each question against the labels on its image', () => {
  it('uses only images that resolve, with labels to open', () => {
    for (const item of items) {
      if (item.image.kind === 'still')
        expect(stillRegions(item.image.station).length).toBeGreaterThan(1)
      if (item.image.kind === 'node') {
        expect(NODE_FEATURE_IMAGES[item.image.slug]).toBeDefined()
        const drawn = annotationsFor(item.image.slug).shapes.map((shape) => shape.label)
        for (const layer of item.image.layers) expect(drawn).toContain(layer)
      }
      if (item.image.kind === 'clip') {
        const clip = teachingClip(item.image.clip)!
        expect(clip.outlines).toBe('owner-checked')
        const stop = clip.stops.find((entry) => entry.id === (item.image as { stop: string }).stop)!
        expect(stop.marks.length).toBeGreaterThan(0)
        expect(clip.built.stops.some((entry) => entry.id === stop.id)).toBe(true)
      }
    }
  })

  it('numbers the 4L still as its stem says: two nodes, then the aorta, then the pulmonary artery', () => {
    expect(stillRegions('4L')).toEqual(['Station 4L', 'Station 4L', 'Aorta', 'Pulmonary Artery'])
    expect(byId('review-anatomy-4l').question.prompt).toMatch(
      /Outline 3 is the aorta and outline 4 is the pulmonary artery.*outlined 1 and 2/,
    )
    expect(keyed('review-anatomy-4l').text).toBe('4L')
  })

  it('numbers the 4R still as its stem says: the node, then the superior vena cava', () => {
    expect(stillRegions('4R')).toEqual(['Station 4R', 'Superior Vena Cava'])
    expect(byId('review-anatomy-4r').question.prompt).toMatch(
      /Outline 2 is the superior vena cava.*outlined 1/,
    )
    expect(keyed('review-anatomy-4r').text).toBe('4R')
  })

  it('numbers the 10R still as its stems say: two nodes, then the azygos vein', () => {
    expect(stillRegions('10R')).toEqual(['Station 10R', 'Station 10R', 'Azygous Vein'])
    expect(byId('review-plan-10r').question.prompt).toMatch(/Outline 3 is the azygos vein/)
    expect(keyed('review-plan-10r').text).toBe('10R')
    expect(byId('review-plan-count').image).toEqual({ kind: 'still', station: '10R' })
    expect(keyed('review-plan-count').text).toBe('One')
  })

  it('numbers the 11Rs still as its stem says: the node between two outlines of pulmonary artery', () => {
    expect(stillRegions('11Rs')).toEqual(['Pulmonary Artery', 'Station 11Rs', 'Pulmonary Artery'])
    expect(byId('review-sample-11rs').question.prompt).toMatch(
      /Outlines 1 and 3 are pulmonary artery.*outlined 2/,
    )
    expect(keyed('review-sample-11rs').text).toBe('11Rs')
  })

  it('numbers the 2L still as its stem says: the trunk, two nodes, then the aorta', () => {
    expect(stillRegions('2L')).toEqual([
      'Brachiocephalic Trunk',
      'Station 2L',
      'Station 2L',
      'Aorta',
    ])
    expect(byId('review-report-2l').question.prompt).toMatch(
      /Outline 4 is the aorta and outline 1 is the brachiocephalic trunk.*outlined 2 and 3/,
    )
    expect(keyed('review-report-2l').text).toBe('2L')
  })

  it('names on the Doppler frames only what the owner confirmed on them', () => {
    const marks = (stop: string) =>
      teachingClip('doppler-node-vessels')!
        .stops.find((entry) => entry.id === stop)!
        .marks.map((mark) => mark.kind)
    expect(marks('late')).toContain('pleura')
    expect(keyed('review-anatomy-pleura').text).toBe('Pleura')
    expect(marks('flow')).toContain('vessel')
    expect(keyed('review-plan-path').text).toMatch(/needle path/)
  })

  it('asks about a central hilar structure and a necrosis sign on the stills outlined for them', () => {
    expect(byId('review-sample-chs').image).toMatchObject({ slug: 'station-4r-oval-chs' })
    expect(keyed('review-sample-chs').text).toMatch(/central hilar structure/)
    expect(byId('review-sample-necrosis').image).toMatchObject({ slug: 'station-7-necrosis' })
    // The still has no Doppler on it, so the stem supposes the Doppler finding and says so.
    expect(byId('review-sample-necrosis').question.prompt).toMatch(/Suppose Doppler shows no flow/)
  })

  it('does not call a sample of blood negative, or a suspicious node positive', () => {
    expect(keyed('review-report-blood').text).toMatch(/nonrepresentative/)
    expect(keyed('review-report-tip').text).toMatch(/^Out of the image/)
  })
})

describe('the review page', () => {
  it('shows the image before any name, and opens the names on an answer', () => {
    render(<ChapterReviewPage chapterId="anatomy" />)
    expect(screen.getByRole('heading', { name: 'Images from the lessons so far' })).toBeVisible()
    expect(document.querySelector('[data-review-image]')).toHaveAttribute(
      'data-review-image',
      'clip',
    )
    expect(document.querySelector('[data-review-locked]')).toBeVisible()
    expect(document.querySelector('[data-review-names]')).toBeNull()
    expect(document.querySelector('[data-clip-mark]')).toBeNull()
    fireEvent.click(screen.getByLabelText('Pleura'))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    expect(document.querySelector('[data-review-locked]')).toBeNull()
    expect(document.querySelector('[data-review-names]')).toHaveTextContent('Pleura')
    expect(document.querySelectorAll('[data-clip-mark]').length).toBeGreaterThan(0)
  })

  it('opens the names when the explanation is opened without an answer', () => {
    render(<ChapterReviewPage chapterId="anatomy" />)
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(document.querySelector('[data-review-names]')).toHaveTextContent('Pleura')
  })

  it('numbers a still’s outlines from the start and names them only after the answer', () => {
    render(<ChapterReviewPage chapterId="anatomy" />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue without answering' }))
    const figure = document.querySelector('[data-review-image="still"]')!
    expect([...figure.querySelectorAll('text')].map((node) => node.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
    // One neutral colour until the answer: a colour per kind would name the nodes.
    expect(
      new Set([...figure.querySelectorAll('polygon')].map((p) => p.getAttribute('stroke'))).size,
    ).toBe(1)
    expect(document.querySelector('[data-review-names]')).toBeNull()
    fireEvent.click(screen.getByLabelText('2L'))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    expect(document.querySelector('[data-review-names]')).toHaveTextContent('Station 4L node')
    expect(document.querySelector('[data-review-names]')).toHaveTextContent('Pulmonary artery')
  })

  it('never puts a station still’s address, which names its station, in the page', () => {
    render(<ChapterReviewPage chapterId="anatomy" />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue without answering' }))
    const figure = document.querySelector('[data-review-image="still"]')!
    expect(figure.innerHTML).not.toMatch(/stations\/|4L/)
    // No image arrives in this test environment; the frame says so and the outlines still draw.
    expect(figure.querySelector('[role=status]')).toBeInTheDocument()
    expect(figure.querySelectorAll('polygon')).toHaveLength(4)
  })

  it('ends on a summary that names the lesson behind each image and the next lesson', () => {
    render(<ChapterReviewPage chapterId="anatomy" />)
    for (let step = 0; step < 2; step += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Continue without answering' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the summary without answering' }))
    const summary = document.querySelector('[data-review-summary]')!
    expect(summary).toHaveTextContent('Not answered in this session.')
    expect(summary.querySelectorAll('[data-review-image]')).toHaveLength(3)
    const links = [...summary.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    expect(links).toContain('/ebus-guided/learn?section=doppler')
    expect(links).toContain('/ebus-guided/learn?section=left-paratracheal')
    // The chapter after "anatomy" opens on the six sonographic features.
    expect(links).toContain('/ebus-guided/learn?section=node-characterization')
    expect(Object.keys(localStorage)).toEqual([])
  })

  it('offers the capstone after the last review', () => {
    render(<ChapterReviewPage chapterId="report" />)
    for (let step = 0; step < 2; step += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Continue without answering' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the summary without answering' }))
    expect(
      screen.getByRole('link', { name: /Continue to Lesson 23, A complete staging examination/ }),
    ).toHaveAttribute('href', '/ebus-guided/learn?section=staging-examination')
  })
})

describe('where a review is offered', () => {
  it('is linked from its chapter on the course map, and not counted as a lesson', () => {
    render(<CoursePage />)
    const links = [...document.querySelectorAll('[data-chapter-review-link] a')].map((link) =>
      link.getAttribute('href'),
    )
    expect(links).toEqual(CHAPTER_REVIEWS.map((review) => reviewHref(review.chapterId)))
    expect(LESSONS).toHaveLength(23)
    expect(document.querySelector('[data-course-marks]')).toHaveTextContent('0 of 23 lessons')
  })

  const finish = (lessonId: string) => {
    render(<LessonHost lesson={lessonById(lessonId)!} />)
    for (let step = 0; step < 40; step += 1) {
      if (screen.queryByRole('heading', { name: 'Lesson finished' })) break
      const skip =
        (document.querySelector('[data-skip-acquisition]') as HTMLButtonElement | null) ??
        (document.querySelector('[data-now-primary]') as HTMLButtonElement)
      fireEvent.click(skip)
    }
    expect(screen.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
  }

  it('is offered when the last lesson of its chapter is finished', () => {
    // The hilar and interlobar lesson is the last of the anatomy chapter.
    finish('hilar-interlobar')
    const link = document.querySelector('[data-lesson-destinations] [data-chapter-review-link]')
    expect(link).toHaveAttribute('href', reviewHref('anatomy'))
    expect(link).toHaveTextContent('Chapter review: 3 image questions')
  })

  it('is not offered after a lesson in the middle of a chapter, or in a chapter without one', () => {
    finish('station-seven')
    expect(document.querySelector('[data-chapter-review-link]')).toBeNull()
  })
})
