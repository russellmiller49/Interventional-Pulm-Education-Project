import { useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Band } from '../components/Band'
import { useStageFocus } from '../components/useStageFocus'

describe('what a check found', () => {
  it('carries its tone by an icon as well as by colour', () => {
    const { container, rerender } = render(
      <Band tone="in" headline="Drawn." detail="On to the next." />,
    )
    const band = () => container.querySelector('[data-verdict-tone]')!
    expect(band().getAttribute('role')).toBe('status')
    expect(band().textContent).toBe('Drawn. On to the next.')
    expect(band().querySelector('[data-band-icon="in"]')).not.toBeNull()
    for (const tone of ['near', 'miss'] as const) {
      rerender(<Band tone={tone} headline="Near the fork." detail="Look again." />)
      expect(band().getAttribute('data-verdict-tone')).toBe(tone)
      expect(band().querySelectorAll('[data-band-icon]')).toHaveLength(1)
      expect(band().querySelector(`[data-band-icon="${tone}"]`)).not.toBeNull()
      // The icon is decoration to a screen reader: the words say what was found.
      expect(band().querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

function Bench() {
  const ref = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState(0)
  useStageFocus(ref, String(stage))
  return (
    <div ref={ref}>
      <section data-now-card>
        <h2>Step {stage}</h2>
        {stage === 0 && <button onClick={() => setStage(1)}>Check, then go</button>}
      </section>
      <button onClick={() => setStage((value) => value + 1)}>Stays</button>
    </div>
  )
}

describe('focus when a step moves on', () => {
  it('goes to the task heading when the step’s button went with the step', () => {
    render(<Bench />)
    // Nothing moves focus when the bench first opens.
    expect(document.activeElement).toBe(document.body)
    const going = screen.getByRole('button', { name: 'Check, then go' })
    going.focus()
    fireEvent.click(going)
    const heading = screen.getByRole('heading', { name: 'Step 1' })
    expect(document.activeElement).toBe(heading)
    expect(heading.tabIndex).toBe(-1)
  })

  it('leaves focus alone when it is still on something in the page', () => {
    render(<Bench />)
    const stays = screen.getByRole('button', { name: 'Stays' })
    stays.focus()
    fireEvent.click(stays)
    expect(screen.getByRole('heading', { name: 'Step 1' })).toBeTruthy()
    expect(document.activeElement).toBe(stays)
  })
})
