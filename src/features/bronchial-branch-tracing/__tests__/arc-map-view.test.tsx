import { render } from '@testing-library/react'
import { ArcMap } from '../components/ArcMap'
import { withGhost, type Anatomical, type Rim } from '../engine/arc-map'

const RIM: Record<Rim, Anatomical | null> = {
  top: 'medial',
  right: 'posterior',
  bottom: 'lateral',
  left: 'anterior',
}

describe('the map on screen', () => {
  it('shows the four rim words, or a control in each place when the directions are being chosen', () => {
    const words = render(<ArcMap rim={RIM} levels={[]} label="Your map" />)
    expect(
      Array.from(words.container.querySelectorAll('[data-arc-rim]')).map((el) => el.textContent),
    ).toEqual(['Medial', 'Posterior', 'Lateral', 'Anterior'])
    expect(words.container.querySelectorAll('[data-arc-rim-slot]')).toHaveLength(0)
    words.unmount()

    const slots = render(
      <ArcMap
        rim={{ top: null, right: null, bottom: null, left: null }}
        levels={[]}
        label="Your map"
        rimSlot={(position) => <select aria-label={`Direction at the ${position}`} />}
      />,
    )
    // One control at each place, on the circle; no word is printed beside it.
    expect(
      Array.from(slots.container.querySelectorAll('[data-arc-rim-slot]')).map((el) =>
        el.getAttribute('data-arc-rim-slot'),
      ),
    ).toEqual(['top', 'right', 'bottom', 'left'])
    expect(slots.container.querySelectorAll('[data-arc-rim-slot] select')).toHaveLength(4)
    expect(slots.container.querySelectorAll('[data-arc-rim]')).toHaveLength(0)
  })

  it('marks each drawn branch where it stands after a check that did not fit', () => {
    const { container, rerender } = render(
      <ArcMap
        rim={RIM}
        levels={[]}
        drawing={{ placed: [6, 2], leadsOn: 0, count: 2 }}
        focus={0}
        label="Your map"
      />,
    )
    // Before any check the branches are only pending.
    expect(container.querySelectorAll('[data-arc-pending]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-arc-verdict]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-arc-verdict-mark]')).toHaveLength(0)
    rerender(
      <ArcMap
        rim={RIM}
        levels={[]}
        drawing={{ placed: [6, 2], leadsOn: 0, count: 2, verdicts: ['kept', 'off'] }}
        focus={0}
        label="Your map"
      />,
    )
    expect(
      Array.from(container.querySelectorAll('[data-arc-verdict]')).map((el) =>
        el.getAttribute('data-arc-verdict'),
      ),
    ).toEqual(['kept', 'off'])
    // A mark as well as a line style: the verdict does not rest on colour.
    expect(
      Array.from(container.querySelectorAll('[data-arc-verdict-mark]')).map((el) => el.textContent),
    ).toEqual(['✓', '✕'])
  })

  it('lays the model’s arcs over the learner’s as their own kind of line, with one star', () => {
    const learner = [{ angles: [270, 90], route: 0 }]
    const model = [{ angles: [250, 80], route: 0 }]
    const { container } = render(
      <ArcMap rim={RIM} levels={withGhost(learner, model)} star label="Both maps" />,
    )
    expect(container.querySelectorAll('[data-arc-ghost]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-arc]:not([data-arc-ghost])')).toHaveLength(2)
    expect(container.querySelectorAll('[data-arc-star]')).toHaveLength(1)
    // The model's arcs are never the route and are never numbered as branches.
    expect(container.querySelectorAll('[data-arc-ghost][data-arc-route]')).toHaveLength(0)
  })

  it('turns and zooms inside a frame that never changes, with its words kept upright', () => {
    const levels = [
      { angles: [270, 90], route: 0 },
      { angles: [0, 180], route: 1 },
    ]
    const stage = (container: HTMLElement) =>
      (container.querySelector('[data-arc-turn]') as SVGGElement).style.transform
    const whole = render(<ArcMap rim={RIM} levels={levels} star label="Your map" />)
    const frame = whole.container.querySelector('svg')!.getAttribute('viewBox')
    expect(stage(whole.container)).toBe('rotate(0deg) scale(1) translate(0px, 0px)')
    whole.unmount()

    // Zoomed on the second division and turned a quarter: the frame is the same; the map inside
    // it is moved, enlarged and turned.
    const turned = render(
      <ArcMap rim={RIM} levels={levels} focus={1} rotation={90} star label="Your map" />,
    )
    expect(turned.container.querySelector('svg')!.getAttribute('viewBox')).toBe(frame)
    expect(turned.container.querySelector('[data-arc-turn]')!.getAttribute('data-arc-turn')).toBe(
      '90',
    )
    const moved = stage(turned.container)
    expect(moved.startsWith('rotate(90deg) scale(')).toBe(true)
    expect(Number(moved.match(/scale\(([\d.]+)\)/)![1])).toBeGreaterThan(1.1)
    expect(moved).not.toContain('translate(0px, 0px)')
    // Each rim word is turned back by as much as its frame is turned, so it reads upright.
    const word = turned.container.querySelector('[data-arc-rim="top"]') as HTMLElement
    expect(word.style.transform).toBe('translate(-50%, -50%) rotate(-90deg)')
    expect((word.parentElement as HTMLElement).style.transform).toBe('rotate(90deg)')
    // The words stay at their own places on that frame: the turn is the frame's, not theirs.
    expect(word.style.top).toBe('6%')
  })

  it('carries a turn on by the shorter way round', () => {
    const { container, rerender } = render(
      <ArcMap rim={RIM} levels={[]} rotation={350} label="Your map" />,
    )
    const shown = () =>
      Number(
        (container.querySelector('[data-arc-turn]') as SVGGElement).style.transform.match(
          /rotate\((-?[\d.]+)deg\)/,
        )![1],
      )
    expect(shown()).toBe(350)
    rerender(<ArcMap rim={RIM} levels={[]} rotation={10} label="Your map" />)
    // Twenty degrees on, not three hundred and forty back.
    expect(shown()).toBe(370)
    rerender(<ArcMap rim={RIM} levels={[]} rotation={0} label="Your map" />)
    expect(shown()).toBe(360)
  })
})
