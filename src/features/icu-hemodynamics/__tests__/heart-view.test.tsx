import { cleanup, render } from '@testing-library/react'

import { HemodynamicHeart3D, TIP_STRUCTURE_MESH } from '../components/HemodynamicHeart3D'
import { freshTeachingState } from '../engine/stageRuntime'

afterEach(cleanup)

/**
 * The 3D heart in "Where is the tip?" and "The wedge", walked on screen in November 2026.
 *
 * Its buttons were laid over the canvas and covered the top of the model, where the catheter comes
 * in. The catheter was called yellow and drawn pale. The chamber names were off until asked for,
 * and a paragraph under the view did the labelling. jsdom has no WebGL, so these tests hold the
 * page around the canvas; the picture itself is checked in the browser.
 */
describe('the heart view around its canvas', () => {
  function mount() {
    const { container } = render(<HemodynamicHeart3D state={freshTeachingState(700)} />)
    return container.querySelector('[data-heart-figure]') as HTMLElement
  }

  it('keeps its buttons above the view, not over it', () => {
    const figure = mount()
    const toolbar = figure.querySelector('[data-heart-toolbar]')!
    const viewport = figure.querySelector('[data-heart-orientation]')!.parentElement!
    expect(toolbar.parentElement).toBe(figure)
    expect(viewport.contains(toolbar)).toBe(false)
    // Toolbar, then the view, then the status.
    const order = [...figure.children]
    expect(order.indexOf(toolbar)).toBeLessThan(order.indexOf(viewport))
    expect(order.indexOf(viewport)).toBeLessThan(
      order.indexOf(figure.querySelector('[data-heart-status]')!),
    )
    expect(toolbar.querySelectorAll('button')).toHaveLength(8)
  })

  it('says which way the heart faces on the view itself', () => {
    const note = mount().querySelector('[data-heart-orientation]')!
    expect(note.textContent).toContain('Anterior heart + distal PA')
    expect(note.textContent).toContain('Patient right is viewer left')
  })

  it('shows the chamber names from the start', () => {
    // Hiding them needs the canvas, so that half is held by the browser test.
    const toggle = mount().querySelector('[data-heart-names-toggle]') as HTMLButtonElement
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.textContent).toBe('Hide chamber names')
  })

  it('gives a key of marks in place of the legend paragraph, the heart’s two colours among them', () => {
    const legend = mount().querySelector('[data-heart-legend]')!
    const items = [...legend.querySelectorAll('li')]
    expect(items.map((item) => item.textContent!.trim())).toEqual([
      'PAC course, with a bright dot at the tip',
      'The structure the tip is in',
      'Phlebostatic reference',
      'Pressure tubing to the transducer (the box)',
      // The heart was blue and red with nothing saying why (November 2026). The model colours
      // by oxygenation, so the pulmonary arteries are blue and the pulmonary veins red.
      'Blue: blood on its way to the lungs (venae cavae, right heart, pulmonary arteries)',
      'Red: blood back from the lungs (pulmonary veins, left heart, aorta)',
    ])
    for (const item of items) expect(item.querySelector('[data-key-mark]')).not.toBeNull()
    expect(
      items.map((item) => item.querySelector('[data-key-mark]')!.getAttribute('data-key-mark')),
    ).toEqual(['course', 'structure', 'axis', 'tubing', 'to-lungs', 'from-lungs'])
  })

  it('keeps how the view is drawn, one press away', () => {
    const notes = mount().querySelector('[data-heart-drawing-notes]') as HTMLDetailsElement
    expect(notes.open).toBe(false)
    expect(notes.querySelector('summary')!.textContent).toBe('How this view is drawn')
    expect(notes.textContent).toContain('a see-through drawing convention')
    expect(notes.textContent).toContain('the catheter has not left the vessel')
    expect(notes.querySelector('[data-heart-names-note]')!.textContent).toContain(
      'mark where this simulation places the catheter tip',
    )
  })

  it('still states the tip, the balloon and the transducer under the view', () => {
    const status = mount().querySelector('[data-heart-status]')!
    expect(status.querySelector('strong')!.textContent).toMatch(/^TIP · /)
    expect(status.textContent).toContain('Balloon · ')
    expect(status.textContent).toContain('Pressure transducer · ')
  })

  it('lights a structure for every place the tip can be', () => {
    expect(TIP_STRUCTURE_MESH).toEqual({
      introducer: 'CT_SVC',
      ra: 'CT_RA_Cavity',
      rv: 'CT_RV_Cavity',
      pa: 'CT_PulmonaryArteries',
      wedge: 'CT_PulmonaryArteries',
    })
  })
})
