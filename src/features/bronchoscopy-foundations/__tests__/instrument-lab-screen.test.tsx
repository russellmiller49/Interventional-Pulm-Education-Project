import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BronchCourseTeaching } from '../components/stage/BronchCourseTeaching'
import { COURSE_FLOWS } from '../content/courseFlow'
import { section as biopsyAndSpecimens } from '../content/sections/biopsy-and-specimens'
import { bronchStageLesson } from '../content/stageLessons'
import { SOURCE_BY_ID } from '../data/sources'

/**
 * The instrument lab in "Biopsy, brushing and specimens": one teaching screen where the forceps,
 * the brush and the needle are each worked through the channel from the handle, with the owner's
 * clips of the real devices. Teaching only; the screen records nothing.
 */
afterEach(cleanup)

const flow = COURSE_FLOWS['biopsy-and-specimens'] ?? []

function renderLabScreen() {
  const lesson = bronchStageLesson('biopsy-and-specimens')
  const step = lesson.steps.find((entry) => entry.course?.id === 'working-the-tools')!
  return render(<BronchCourseTeaching lesson={lesson} step={step} />)
}

describe('the instrument lab screen', () => {
  it('comes after the tools are introduced and before their states are asked on a picture', () => {
    const ids = flow.map((chunk) => chunk.id)
    expect(flow.filter((chunk) => chunk.visual === 'instrument-lab')).toEqual([
      expect.objectContaining({
        id: 'working-the-tools',
        kind: 'teach',
        blocks: ['working-the-handle'],
      }),
    ])
    expect(ids.indexOf('the-tools')).toBeLessThan(ids.indexOf('working-the-tools'))
    expect(ids.indexOf('working-the-tools')).toBeLessThan(ids.indexOf('name-the-states'))
  })

  it('shows the card first, then all three tools at their targets, with the real devices', () => {
    renderLabScreen()
    const card = document.querySelector('[data-block-id="working-the-handle"]')!
    const lab = document.querySelector('[data-instrument-lab-figure]')!
    expect(card.compareDocumentPosition(lab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Biopsy forceps',
      'Cytology brush',
      'Aspiration needle',
    ])
    expect(screen.getByText('Endobronchial lesion')).toBeInTheDocument()
    expect(screen.getByText('The real biopsy forceps')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Aspiration needle' }))
    expect(screen.getByText('Lymph node beyond the wall')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suction off' })).toBeInTheDocument()
    expect(screen.getByText('The real aspiration needle')).toBeInTheDocument()
  })

  it('names the needle fault on the page when the needle comes out inside the scope', () => {
    renderLabScreen()
    fireEvent.click(screen.getByRole('tab', { name: 'Aspiration needle' }))
    fireEvent.keyDown(screen.getByRole('slider', { name: /Needle hub/ }), { key: 'End' })
    expect(document.querySelector('[data-lab-fault="needle-in-channel"]')).not.toBeNull()
  })

  it('cites the textbook pages for the needle and the porcine-lung review for the brush', () => {
    const block = biopsyAndSpecimens.blocks.find((entry) => entry.id === 'working-the-handle')!
    expect(block.sourceRefs).toEqual(
      expect.arrayContaining([
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 128 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 147, to: 149 } },
        { sourceId: 'U24', location: { kind: 'section', label: 'Bronchial brushing, page 340' } },
      ]),
    )
    expect(SOURCE_BY_ID.get('U24')).toMatchObject({
      sourceClass: 'reference',
      kindLabel: 'Review article',
      year: 2014,
      url: 'https://doi.org/10.1165/rcmb.2013-0453TR',
    })
  })
})
