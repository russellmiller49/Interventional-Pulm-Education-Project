import { fireEvent, render } from '@testing-library/react'

import {
  HeadDragLayer,
  headDragHint,
  leverDragDeflection,
  wristDragRotation,
} from '../components/scope/HeadDragLayer'
import type { ScopeCommand, ScopeInputMode } from '../components/scope/types'

function mount(
  controls: readonly ('deflect' | 'rotate' | 'advance')[],
  { enabled = true, deflectionDeg = 0 } = {},
) {
  const sent: [ScopeCommand, ScopeInputMode][] = []
  const view = render(
    <HeadDragLayer
      deflectionDeg={deflectionDeg}
      controls={controls}
      enabled={enabled}
      onCommand={(command, mode) => sent.push([command, mode])}
    />,
  )
  const layer = view.container.querySelector<HTMLElement>('[data-head-drag]')
  return { sent, layer }
}

/** jsdom's pointer events do not carry coordinates from the init, so they are set on the event. */
function pointer(
  layer: HTMLElement,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  x: number,
  y: number,
  pointerType = 'mouse',
) {
  const event = new MouseEvent(type.toLowerCase(), { bubbles: true, clientX: x, clientY: y })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  })
  fireEvent(layer, event)
}

describe('the control head worked by hand', () => {
  it('reads a drag down as the lever going down, which raises the tip', () => {
    expect(leverDragDeflection(0, 50)).toBe(60)
    expect(leverDragDeflection(0, -50)).toBe(-60)
    // The lever stops at the model's limit both ways.
    expect(leverDragDeflection(100, 500)).toBe(120)
    expect(leverDragDeflection(-100, -500)).toBe(-120)
  })

  it('turns the head with the hand: a drag to the right raises the rotation', () => {
    expect(wristDragRotation(100)).toBe(90)
    expect(wristDragRotation(-100)).toBe(-90)
  })

  it('sends the lever a set position, from where it was when the drag began', () => {
    const { sent, layer } = mount(['deflect', 'rotate'], { deflectionDeg: 30 })
    pointer(layer!, 'pointerDown', 200, 100)
    pointer(layer!, 'pointerMove', 201, 150)
    pointer(layer!, 'pointerMove', 240, 160)
    pointer(layer!, 'pointerUp', 240, 160)
    // A drag keeps to the axis it starts on: the sideways drift does not turn the head.
    expect(sent).toEqual([
      [{ type: 'set-deflection', deg: 90 }, 'pointer'],
      [{ type: 'set-deflection', deg: 102 }, 'pointer'],
    ])
  })

  it('sends a turn as the new part of the movement only', () => {
    const { sent, layer } = mount(['deflect', 'rotate'])
    pointer(layer!, 'pointerDown', 200, 100)
    pointer(layer!, 'pointerMove', 240, 101)
    pointer(layer!, 'pointerMove', 260, 130)
    pointer(layer!, 'pointerUp', 260, 130)
    expect(sent).toEqual([
      [{ type: 'rotate', deg: 36 }, 'pointer'],
      [{ type: 'rotate', deg: 18 }, 'pointer'],
    ])
  })

  it('sends nothing after release, while the controls are closed, or for a finger', () => {
    const open = mount(['deflect'])
    pointer(open.layer!, 'pointerDown', 10, 10)
    pointer(open.layer!, 'pointerUp', 10, 10)
    pointer(open.layer!, 'pointerMove', 10, 90)
    expect(open.sent).toEqual([])

    const closed = mount(['deflect'], { enabled: false })
    pointer(closed.layer!, 'pointerDown', 10, 10)
    pointer(closed.layer!, 'pointerMove', 10, 90)
    expect(closed.sent).toEqual([])

    // A finger scrolls the page here; the sliders under the view work the controls.
    const finger = mount(['deflect'])
    pointer(finger.layer!, 'pointerDown', 10, 10, 'touch')
    pointer(finger.layer!, 'pointerMove', 10, 90, 'touch')
    expect(finger.sent).toEqual([])
  })

  it('offers only the movement the step has, and is absent where the step has neither', () => {
    expect(mount(['deflect']).layer).toHaveAttribute('data-head-drag', 'lever')
    expect(mount(['rotate']).layer).toHaveAttribute('data-head-drag', 'wrist')
    expect(mount(['advance']).layer).toBeNull()
    expect(headDragHint(['deflect', 'rotate'])).toMatch(/lever.*wrist/)
    expect(headDragHint(['rotate'])).toBe('Drag sideways to turn your wrist.')
    expect(headDragHint(['advance'])).toBeNull()
    // It is a pointer convenience: the sliders are the path for assistive technology.
    expect(mount(['deflect']).layer).toHaveAttribute('aria-hidden', 'true')
  })
})
