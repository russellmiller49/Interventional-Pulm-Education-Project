import { act, cleanup, render } from '@testing-library/react'
import { EMPTY_EUSB_OBSERVATION } from '@/lib/eus-b-guided-bridge'
import { EUSB_CONTRACT_REVISION } from '@/lib/eus-b-guided-contract'
import { Workbench, type StageRequest } from '../components/Workbench'
import { held, searching } from '../testing/observations'

afterEach(cleanup)

const stage: StageRequest = {
  labId: 'liver-reach',
  phase: 'work',
  names: 'hidden',
  panes: ['ultrasound'],
  request: 16,
}
const media = (matches: boolean) =>
  (window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches, addEventListener: jest.fn(), removeEventListener: jest.fn() }))

function open(received = jest.fn(), request: StageRequest = stage) {
  media(true)
  const view = render(
    <Workbench stage={request} sessionId="lesson-0-1" fill onObservation={received} />,
  )
  const frame = document.querySelector('iframe')!
  const posted = jest.spyOn(frame.contentWindow!, 'postMessage')
  const send = (
    data: unknown,
    origin = location.origin,
    source: Window | null = frame.contentWindow,
  ) => act(() => window.dispatchEvent(new MessageEvent('message', { data, origin, source })))
  const lastConfig = () =>
    (posted.mock.calls.at(-1)![0] as { config: { sessionId: string; observationRequest: number } })
      .config
  return { ...view, frame, posted, send, lastConfig, received }
}
const ready = { version: 1, type: 'ready', contractRevision: EUSB_CONTRACT_REVISION }

it('opens the lab as a training embed, in a frame named for assistive technology', () => {
  const { frame } = open()
  expect(frame).toHaveAttribute('title', 'EUS-B lab')
  const src = new URL(frame.getAttribute('src')!, location.origin)
  expect(src.pathname).toBe('/socal-ebus-course/app/eus-b-guided.html')
  expect(src.searchParams.get('publicTraining')).toBe('1')
  expect(src.searchParams.get('publicScope')).toBe('ebus')
})

it('configures the lab when it reports ready, with a session of its own', () => {
  const { send, posted, lastConfig } = open()
  expect(posted).not.toHaveBeenCalled()
  send(ready)
  const first = lastConfig()
  expect(first.sessionId).toMatch(/^lesson-0-1-/)
  expect(posted.mock.calls.at(-1)![0]).toMatchObject({
    version: 1,
    type: 'configure',
    config: { labId: 'liver-reach', phase: 'work', names: 'hidden', observationRequest: 16 },
  })
  expect(posted.mock.calls.at(-1)![1]).toBe(location.origin)
  // The lab started again: a new session, so nothing from before it counts.
  send(ready)
  expect(lastConfig().sessionId).not.toBe(first.sessionId)
})

it('passes on an observation only from this frame, this session, this request and this lab', () => {
  const { send, lastConfig, received } = open()
  send(ready)
  const config = lastConfig()
  received.mockClear()
  const good = {
    version: 1,
    type: 'observation',
    sessionId: config.sessionId,
    observationRequest: config.observationRequest,
    observation: held('liver-reach'),
  }
  send(good, 'https://unrelated.invalid')
  send(good, location.origin, window)
  send({ ...good, version: 2 })
  send({ ...good, sessionId: 'lesson-0-1-earlier' })
  send({ ...good, observationRequest: config.observationRequest - 1 })
  send({ ...good, observation: held('station-7-reach') })
  send({
    ...good,
    observation: { ...held('liver-reach'), pose: { sMm: 9999, rollDeg: 0, flexDeg: 0 } },
  })
  expect(received).not.toHaveBeenCalled()
  send(good)
  expect(received).toHaveBeenCalledWith(good.observation)
  send({
    version: 1,
    type: 'error',
    sessionId: config.sessionId,
    message: 'The lab could not draw.',
  })
  expect(received).toHaveBeenLastCalledWith(EMPTY_EUSB_OBSERVATION)
  // After a restart of the frame the old session's answers are dropped.
  send(ready)
  received.mockClear()
  send(good)
  expect(received).not.toHaveBeenCalled()
})

it('tells the lab about a new request without starting it again', () => {
  const received = jest.fn()
  const { send, posted, lastConfig, rerender, frame } = open(received)
  send(ready)
  const session = lastConfig().sessionId
  rerender(
    <Workbench
      stage={{ ...stage, phase: 'review', names: 'shown', request: 22 }}
      sessionId="lesson-0-1"
      fill
      onObservation={received}
    />,
  )
  expect(document.querySelector('iframe')).toBe(frame)
  expect(posted.mock.calls.at(-1)![0]).toMatchObject({
    config: { sessionId: session, phase: 'review', names: 'shown', observationRequest: 22 },
  })
  received.mockClear()
  // An answer to the request before this one is dropped.
  send({
    version: 1,
    type: 'observation',
    sessionId: session,
    observationRequest: 16,
    observation: searching('liver-reach'),
  })
  expect(received).not.toHaveBeenCalled()
})

it('says so when the page and the lab are from different versions', () => {
  const { send, posted, getByRole } = open()
  send({ ...ready, contractRevision: EUSB_CONTRACT_REVISION + 1 })
  expect(posted).not.toHaveBeenCalled()
  expect(getByRole('alert')).toHaveTextContent(/different versions/i)
})

it('asks for a larger screen on a phone and reports nothing held', () => {
  media(false)
  const received = jest.fn()
  const { container } = render(
    <Workbench stage={stage} sessionId="lesson-0-1" fill={false} onObservation={received} />,
  )
  expect(container.querySelector('iframe')).toBeNull()
  expect(container.querySelector('[data-lab-unavailable]')).toHaveTextContent(/larger screen/i)
  expect(received).toHaveBeenLastCalledWith(EMPTY_EUSB_OBSERVATION)
})
