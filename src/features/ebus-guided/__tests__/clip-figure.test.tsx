import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { ClipFigure } from '../components/ClipFigure'
import { LessonHost } from '../components/LessonHost'
import { BUILT_CLIPS } from '../content/clips.generated'
import { TEACHING_CLIPS, teachingClip } from '../content/clips'
import { lessonById } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'

/*
 * The owner's patient recordings (2026-11-11). A lesson plays a clip and stops on named frames;
 * a stop shows that exact frame as a still, and its labels stay closed until the learner has
 * answered. These tests pin the built files, the marks, and the Doppler lesson's use of them.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/Workbench', () => ({ Workbench: () => <section data-mock-workbench /> }))
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
  window.HTMLMediaElement.prototype.pause = jest.fn()
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined)
})
afterEach(cleanup)

const publicFile = (url: string) => path.join(process.cwd(), 'public', url)
const stop = (id: string) => document.querySelector(`[data-clip-stop="${id}"]`) as HTMLButtonElement
const labels = () => document.querySelector('[data-clip-labels]') as HTMLButtonElement | null

describe('built clips', () => {
  it('are small web files with their paused frames, each traced to its source recording', () => {
    expect(BUILT_CLIPS.map((clip) => clip.slug)).toEqual(['doppler-node-vessels', 'needle-in-node'])
    for (const clip of BUILT_CLIPS) {
      expect(existsSync(publicFile(clip.src))).toBe(true)
      expect(statSync(publicFile(clip.src)).size).toBe(clip.bytes)
      // Small enough to sit in the repository beside the lesson images.
      expect(clip.bytes).toBeLessThan(3 * 1024 * 1024)
      expect(clip.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
      expect(clip.durationS).toBeGreaterThan(5)
      for (const frame of clip.stops) {
        expect(existsSync(publicFile(frame.image))).toBe(true)
        expect(frame.t).toBeLessThan(clip.durationS)
      }
    }
  })

  it('describes each lesson clip, with every stop built and every mark inside the frame', () => {
    for (const clip of TEACHING_CLIPS) {
      const resolved = teachingClip(clip.slug)!
      expect(resolved.built.slug).toBe(clip.slug)
      for (const entry of clip.stops) {
        expect(resolved.built.stops.some((frame) => frame.id === entry.id)).toBe(true)
        for (const mark of entry.marks) {
          const points =
            mark.shape.type === 'ellipse'
              ? [
                  [mark.shape.cx - mark.shape.rx, mark.shape.cy - mark.shape.ry],
                  [mark.shape.cx + mark.shape.rx, mark.shape.cy + mark.shape.ry],
                ]
              : mark.shape.points
          for (const [x, y] of points) {
            expect(x).toBeGreaterThan(0)
            expect(x).toBeLessThan(1)
            expect(y).toBeGreaterThan(0)
            expect(y).toBeLessThan(1)
          }
        }
      }
    }
    // Marks placed by the course author stay marked as drafts until the owner has checked them.
    // Both clips' marks were checked by him on 2026-11-11.
    expect(Object.fromEntries(TEACHING_CLIPS.map((clip) => [clip.slug, clip.outlines]))).toEqual({
      'doppler-node-vessels': 'owner-checked',
      'needle-in-node': 'owner-checked',
    })
  })

  it('says of the Doppler recording only what the owner said of it', () => {
    const clip = teachingClip('doppler-node-vessels')!
    expect(clip.what).toContain('a tract was then made into the node for cryobiopsy')
    const marks = (id: string) =>
      clip.stops.find((entry) => entry.id === id)!.marks.map((mark) => mark.label)
    expect(marks('flow')).toEqual([
      'Node',
      'Small vessel at the margin of the node',
      'Pleura',
      'Small vessel at the pleural line, probably a collateral',
    ])
    expect(marks('late')).toEqual([
      'Node',
      'Pleura',
      'Small vessel at the pleural line, probably a collateral',
    ])
    // The node on each frame is the owner's own outline, traced: a polygon, not a drawn ellipse.
    for (const id of ['flow', 'late']) {
      const node = clip.stops.find((entry) => entry.id === id)!.marks[0]
      expect(node.shape.type).toBe('polygon')
      if (node.shape.type === 'polygon') expect(node.shape.points.length).toBeGreaterThan(20)
    }
  })
})

describe('the clip player', () => {
  it('does not play by itself, and shows a stop as that frame’s own still', () => {
    render(<ClipFigure clip="doppler-node-vessels" unlocked={false} />)
    const video = document.querySelector('video')!
    expect(video).not.toHaveAttribute('autoplay')
    expect(video.muted).toBe(true)
    expect(document.querySelector('[data-clip-still]')).toBeNull()
    fireEvent.click(stop('flow'))
    expect(video.pause).toHaveBeenCalled()
    expect(document.querySelector('[data-clip-still="flow"]')).toHaveAttribute(
      'src',
      '/ebus-guided/clips/doppler-node-vessels-flow.jpg',
    )
    expect(video.hidden).toBe(true)
    // Pressing the stop again, or the play control, goes back to the recording.
    fireEvent.click(screen.getByRole('button', { name: 'Back to the recording' }))
    expect(document.querySelector('[data-clip-still]')).toBeNull()
    expect(video.play).toHaveBeenCalled()
  })

  it('keeps a frame’s labels closed until the learner has answered', () => {
    const { rerender } = render(<ClipFigure clip="doppler-node-vessels" unlocked={false} />)
    // A frame with nothing drawn on it offers no labels.
    fireEvent.click(stop('quiet'))
    expect(labels()).toBeNull()
    fireEvent.click(stop('flow'))
    expect(labels()).toBeDisabled()
    expect(document.querySelector('[data-clip-locked]')).toHaveTextContent(
      'The labels for this frame open after you answer.',
    )
    expect(document.querySelector('[data-clip-marks]')).toBeNull()
    rerender(<ClipFigure clip="doppler-node-vessels" unlocked />)
    expect(labels()).toBeEnabled()
    // Unlocking does not show them; the learner opens them.
    expect(document.querySelector('[data-clip-marks]')).toBeNull()
    fireEvent.click(labels()!)
    expect(document.querySelectorAll('[data-clip-mark]')).toHaveLength(4)
    expect(
      [...document.querySelectorAll('[data-clip-legend] li')].map((li) => li.textContent),
    ).toEqual([
      '1Node',
      '2Small vessel at the margin of the node',
      '3Pleura',
      '4Small vessel at the pleural line, probably a collateral',
    ])
    // Changing frame closes them again.
    fireEvent.click(stop('quiet'))
    expect(document.querySelector('[data-clip-marks]')).toBeNull()
  })
})

describe('in the Doppler lesson', () => {
  const lesson = lessonById('doppler')!
  const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement
  const activityId = () =>
    document.querySelector('[data-ebus-flow]')!.getAttribute('data-activity-id')

  it('is read after the recorded comparison and before the transfer', () => {
    const steps = activitiesForLesson(lesson)
    expect(steps.map((step) => step.id.split(':')[1])).toEqual([
      'flow-example',
      'flow-comparison',
      'review-acquisition',
      'patient-flow',
      'apply-another-situation',
    ])
    expect(steps[3]).toMatchObject({ figure: 'clip-doppler', questions: ['observation'] })
    expect(lesson.observation.id).toBe('doppler-patient-flow')
    expect(lesson.observation.choices.filter((choice) => choice.correct)).toHaveLength(1)
  })

  it('shows the recording, not the earlier lab, and opens the labels on an answer', () => {
    render(<LessonHost lesson={lesson} />)
    for (let guard = 0; guard < 8 && activityId() !== 'doppler:patient-flow'; guard++) {
      const skip = document.querySelector('[data-skip-acquisition]') as HTMLButtonElement | null
      fireEvent.click(skip ?? primary())
    }
    expect(activityId()).toBe('doppler:patient-flow')
    expect(document.querySelector('[data-clip="doppler-node-vessels"]')).toBeVisible()
    expect(document.querySelector('[data-mock-workbench]')).toBeNull()
    // The question names no structure the frame's labels would give away before it is answered.
    fireEvent.click(stop('flow'))
    expect(labels()).toBeDisabled()
    fireEvent.click(
      screen.getByLabelText('Small vessels around the node, including one at the pleural line'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    expect(labels()).toBeEnabled()
  })
})

describe('in the needle lesson', () => {
  const lesson = lessonById('needle-safety')!
  const activityId = () =>
    document.querySelector('[data-ebus-flow]')!.getAttribute('data-activity-id')

  it('says of the needle recording only what the owner said of it', () => {
    const clip = teachingClip('needle-in-node')!
    expect(clip.what).toBe(
      'A patient recording of a 21-gauge needle pass into a station 11L node, with suction. The small picture at the lower right is the white-light view.',
    )
    const marks = (id: string) =>
      clip.stops.find((entry) => entry.id === id)!.marks.map((mark) => mark.kind)
    expect(marks('stylet')).toEqual(['needle', 'stylet'])
    expect(marks('needle')).toEqual(['needle'])
    // The frames are the two he marked on his slides.
    expect(clip.built.stops.map((frame) => [frame.id, frame.t])).toEqual([
      ['stylet', 2.2],
      ['needle', 13.9],
    ])
    // A stop's button does not name what the frame shows before the learner has answered.
    for (const entry of clip.stops) expect(entry.label).not.toMatch(/stylet|needle/i)
  })

  it('reads the recording after the sequence, before the needle model', () => {
    const steps = activitiesForLesson(lesson).map((step) => step.id)
    expect(steps.slice(0, 5)).toEqual([
      'needle-safety:first-decision',
      'needle-safety:sampling-states',
      'needle-safety:safe-sequence',
      'needle-safety:needle-on-ultrasound',
      'needle-assembly-model:needle-components',
    ])
    const step = activitiesForLesson(lesson)[3]
    expect(step).toMatchObject({ figure: 'clip-needle', questions: ['observation'] })
    render(<LessonHost lesson={lesson} />)
    for (
      let guard = 0;
      guard < 8 && activityId() !== 'needle-safety:needle-on-ultrasound';
      guard++
    ) {
      const move =
        (document.querySelector('[data-skip-task]') as HTMLButtonElement | null) ??
        (screen.queryByRole('button', { name: /^Continue without/ }) as HTMLButtonElement | null) ??
        (document.querySelector('[data-now-primary]') as HTMLButtonElement)
      fireEvent.click(move)
    }
    expect(activityId()).toBe('needle-safety:needle-on-ultrasound')
    expect(document.querySelector('[data-clip="needle-in-node"]')).toBeVisible()
    fireEvent.click(stop('stylet'))
    expect(labels()).toBeDisabled()
    fireEvent.click(screen.getByLabelText('The needle, with the stylet at its tip'))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    fireEvent.click(labels()!)
    expect(
      [...document.querySelectorAll('[data-clip-legend] li')].map((li) => li.textContent),
    ).toEqual([
      '1Needle: the bright line beside this mark, entering from the side of the dot',
      '2Stylet at the needle tip',
    ])
  })
})
