import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LESSONS } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { NODE_FEATURE_ANNOTATIONS } from '../content/node-feature-annotations.generated'
import {
  FEATURE_TABS,
  NODE_FEATURE_IMAGE_BASE,
  NODE_FEATURE_IMAGES,
  READING_ITEMS,
  axisRatio,
} from '../content/node-features'
import { EBUS_NUMBERS } from '../content/teachingNumbers'
import { NodeFeatureAtlas, NodeFeatureReading } from '../components/NodeFeatureFigures'

afterEach(cleanup)

const lesson = LESSONS.find((entry) => entry.id === 'node-characterization')!

describe('lesson 16 uses the owner’s annotated EBUS images', () => {
  it('is lesson 16 and teaches all six features in its paragraphs', () => {
    expect(LESSONS.indexOf(lesson)).toBe(15)
    const text = lesson.paragraphs.join(' ')
    for (const feature of [
      'size',
      'shape',
      'margin',
      'echogenicity',
      'central hilar structure',
      'coagulation necrosis sign',
    ])
      expect(text.toLowerCase()).toContain(feature)
    for (const id of [
      'node-short-axis',
      'node-round-ratio',
      'node-distinct-margin',
      'fujiwara-none-of-four',
      'cns-specificity',
    ] as const)
      expect(text).toContain(EBUS_NUMBERS.value(id))
    expect(lesson.sources).toContain('fujiwara2010')
  })

  it('opens with the feature atlas, then the reading task, with no written vignette', () => {
    const flow = activitiesForLesson(lesson)
    expect(flow.map((activity) => activity.figure ?? activity.interaction)).toEqual([
      'node-features',
      'node-reading',
      'matching',
      'questions',
    ])
    expect(flow.some((activity) => activity.recordTask === 'node-description')).toBe(false)
  })

  it('serves every image it shows, and every outline lies inside its crop', () => {
    const used = new Set([
      ...FEATURE_TABS.flatMap((tab) => tab.examples.map((example) => example.slug)),
      ...READING_ITEMS.map((item) => item.slug),
    ])
    expect([...used].sort()).toEqual(Object.keys(NODE_FEATURE_ANNOTATIONS).sort())
    for (const slug of used) {
      expect(existsSync(resolve('public', '.' + NODE_FEATURE_IMAGE_BASE + slug + '.jpg'))).toBe(
        true,
      )
      const [x, y, w, h] = NODE_FEATURE_IMAGES[slug].view
      for (const shape of NODE_FEATURE_ANNOTATIONS[slug].shapes)
        for (const [px, py] of shape.points) {
          expect(px).toBeGreaterThanOrEqual(x)
          expect(px).toBeLessThanOrEqual(x + w)
          expect(py).toBeGreaterThanOrEqual(y)
          expect(py).toBeLessThanOrEqual(y + h)
        }
    }
  })

  it('reads shape from the drawn axes, matching the image names', () => {
    const round = Number(EBUS_NUMBERS.value('node-round-ratio'))
    expect(Number(axisRatio('station-7-oval'))).toBeGreaterThan(round)
    expect(Number(axisRatio('station-4r-oval-chs'))).toBeGreaterThan(round)
    expect(Number(axisRatio('station-7-round-distinct'))).toBeLessThan(round)
    expect(Number(axisRatio('station-2r-round-distinct'))).toBeLessThan(round)
  })

  it('asks each reading question about an outline the image actually carries', () => {
    for (const item of READING_ITEMS) {
      const labels = new Set(NODE_FEATURE_ANNOTATIONS[item.slug].shapes.map((s) => s.label))
      for (const layer of item.layers) expect(labels.has(layer)).toBe(true)
      expect(item.question.choices.filter((choice) => choice.correct)).toHaveLength(1)
    }
  })
})

describe('the atlas and the reading task', () => {
  it('switches features and hides or shows the outlines', () => {
    render(<NodeFeatureAtlas />)
    const image = () => document.querySelector('[data-node-image]')!
    expect(image()).toHaveAttribute('data-outlines', 'shown')
    fireEvent.click(screen.getByRole('tab', { name: 'Coagulation necrosis sign' }))
    expect(image()).toHaveAttribute('data-node-image', 'station-7-necrosis')
    expect(image().querySelectorAll('[data-outline="cns"]')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Hide outlines' }))
    expect(image()).toHaveAttribute('data-outlines', 'hidden')
    expect(image().querySelectorAll('[data-outline]')).toHaveLength(0)
  })

  it('keeps the outlines hidden until the learner checks an answer', () => {
    render(<NodeFeatureReading />)
    const image = () => document.querySelector('[data-node-image]')!
    const first = READING_ITEMS[0]
    expect(image()).toHaveAttribute('data-node-image', first.slug)
    expect(image()).toHaveAttribute('data-outlines', 'hidden')
    const card = document.querySelector('[data-question-id]') as HTMLElement
    const key = first.question.choices.find((choice) => choice.correct)!
    fireEvent.click(within(card).getByLabelText(key.text))
    fireEvent.click(within(card).getByRole('button', { name: 'Check response' }))
    expect(image()).toHaveAttribute('data-outlines', 'shown')
    expect(screen.getByText('That is what this image shows')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }))
    expect(image()).toHaveAttribute('data-node-image', READING_ITEMS[1].slug)
    expect(image()).toHaveAttribute('data-outlines', 'hidden')
  })
})
