import { act, cleanup, render } from '@testing-library/react'
import { Workbench } from '../components/Workbench'
import { EMPTY_EBUS_OBSERVATION } from '@/lib/ebus-guided-bridge'
import { LESSONS } from '../content/curriculum'
afterEach(cleanup)
it('accepts observations only from the current iframe, origin, version, session and view request', () => {
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
  const posted = jest.spyOn(frame.contentWindow!, 'postMessage')
  act(() =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { version: 1, type: 'ready' },
        origin: location.origin,
        source: frame.contentWindow,
      }),
    ),
  )
  const currentSession = (posted.mock.calls.at(-1)![0] as { config: { sessionId: string } }).config
    .sessionId
  received.mockClear()
  const good = {
    version: 1,
    type: 'observation',
    sessionId: currentSession,
    observationRequest: (posted.mock.calls.at(-1)![0] as { config: { observationRequest: number } })
      .config.observationRequest,
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
  send({ ...good, observationRequest: undefined })
  send({ ...good, observationRequest: good.observationRequest - 1 })
  expect(received).not.toHaveBeenCalled()
  send(good)
  expect(received).toHaveBeenCalledWith({ ...good.observation, acquisitionSession: currentSession })
  send({ version: 1, type: 'error', sessionId: currentSession, message: 'Render failed' })
  expect(received).toHaveBeenLastCalledWith(EMPTY_EBUS_OBSERVATION)
  send({ version: 1, type: 'ready' })
  received.mockClear()
  send(good)
  expect(received).not.toHaveBeenCalled()
})
