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
})
