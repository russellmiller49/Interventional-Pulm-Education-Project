import { act, cleanup, render } from '@testing-library/react'
import { Workbench } from '../components/Workbench'
import { EMPTY_EBUS_OBSERVATION } from '@/lib/ebus-guided-bridge'
import { LESSONS } from '../content/curriculum'
afterEach(cleanup)
it('accepts observations only from the current iframe, origin, version and session', () => {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ addEventListener: jest.fn(), removeEventListener: jest.fn() })
  const received = jest.fn()
  render(
    <Workbench
      lab={LESSONS.find((l) => l.id === 'image-depth')!.lab!}
      sessionId="current"
      locked={false}
      reveal={false}
      onObservation={received}
    />,
  )
  const frame = document.querySelector('iframe')!
  const good = {
    version: 1,
    type: 'observation',
    sessionId: 'current',
    observation: { ...EMPTY_EBUS_OBSERVATION, ready: true, frameReady: true },
  }
  const send = (
    data: unknown,
    origin = location.origin,
    source: Window | null = frame.contentWindow,
  ) => act(() => window.dispatchEvent(new MessageEvent('message', { data, origin, source })))
  send(good, 'https://unrelated.invalid')
  send(good, location.origin, window)
  send({ ...good, version: 2 })
  send({ ...good, sessionId: 'old' })
  expect(received).not.toHaveBeenCalled()
  send(good)
  expect(received).toHaveBeenCalledWith(good.observation)
  send({ version: 1, type: 'error', sessionId: 'current', message: 'Render failed' })
  expect(received).toHaveBeenLastCalledWith(EMPTY_EBUS_OBSERVATION)
})
