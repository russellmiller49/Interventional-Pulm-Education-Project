import { fireEvent, render, screen } from '@testing-library/react'

import { InstrumentLab } from './InstrumentLab'

describe('InstrumentLab', () => {
  it('drives the forceps from the handle and the catheter, and reports completion once', () => {
    const onComplete = jest.fn()
    render(<InstrumentLab instruments={['forceps', 'brush']} onComplete={onComplete} />)

    const catheter = screen.getByRole('slider', { name: 'Catheter beyond the scope tip' })
    const spool = screen.getByRole('slider', { name: /Forceps spool/ })

    fireEvent.change(catheter, { target: { value: '6' } })
    fireEvent.keyDown(spool, { key: 'End' })
    expect(spool).toHaveAttribute('aria-valuetext', 'Cups open')
    fireEvent.change(catheter, { target: { value: '14' } })
    fireEvent.keyDown(spool, { key: 'Home' })
    fireEvent.change(catheter, { target: { value: '-2' } })

    expect(screen.getByText(/Sequence complete, with the channel protected/)).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('forceps', [])
  })

  it('names the fault when the cups open inside the channel', () => {
    render(<InstrumentLab instruments={['forceps']} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: /Forceps spool/ }), { key: 'End' })
    expect(screen.getByText(/Open jaws inside the channel scratch and tear it/)).toBeInTheDocument()
  })

  it('switches instruments and shows the needle suction control only for the needle', () => {
    render(<InstrumentLab />)
    expect(screen.queryByRole('button', { name: /Suction/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Aspiration needle' }))
    expect(screen.getByRole('button', { name: 'Suction off' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('slider', { name: /Needle hub/ })).toBeInTheDocument()
  })
})
