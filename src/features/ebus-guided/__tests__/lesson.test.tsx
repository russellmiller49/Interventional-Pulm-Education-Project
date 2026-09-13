import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LessonHost } from '../components/LessonHost'
import { coupling } from '../content/curriculum'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import { readRecord } from '../engine/progress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/Workbench', () => ({
  Workbench: ({ onObservation }: { onObservation: (s: EbusObservation) => void }) => (
    <section>
      <button
        onClick={() =>
          onObservation({
            ...EMPTY_EBUS_OBSERVATION,
            ready: true,
            frameReady: true,
            targetVisible: true,
            contactQuality: 1,
          })
        }
      >
        Load preset only
      </button>
      <button
        onClick={() =>
          onObservation({
            ...EMPTY_EBUS_OBSERVATION,
            ready: true,
            frameReady: false,
            targetVisible: true,
            contactQuality: 1,
            actionCount: 1,
            lastAction: 'flexion',
            linked: {
              assetsReady: true,
              selectedStructure: '',
              modelSectionViewed: false,
              approach: 'rms',
              scannedApproaches: [],
              frameId: 'test-frame',
            },
          })
        }
      >
        Move before frame
      </button>
      <button
        onClick={() =>
          onObservation({
            ...EMPTY_EBUS_OBSERVATION,
            ready: true,
            frameReady: true,
            targetVisible: true,
            contactQuality: 1,
            actionCount: 1,
            lastAction: 'flexion',
            linked: {
              assetsReady: true,
              selectedStructure: '',
              modelSectionViewed: false,
              approach: 'rms',
              scannedApproaches: [],
              frameId: 'test-frame',
            },
          })
        }
      >
        Render changed scan
      </button>
    </section>
  ),
}))
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement
const next = () => fireEvent.click(primary())
function answer(text: string) {
  fireEvent.click(screen.getByLabelText(text))
  next()
}
function startLab() {
  render(<LessonHost lesson={coupling} />)
  next()
  next()
  answer(coupling.question.choices.find((c) => c.correct)!.text)
  next()
}
it('records the actual wrong response, withholds explanations until submission and does not advance automatically', () => {
  render(<LessonHost lesson={coupling} />)
  next()
  next()
  expect(screen.queryByText(coupling.worked.reasoning)).not.toBeInTheDocument()
  expect(screen.queryByText(coupling.question.explanation)).not.toBeInTheDocument()
  answer(coupling.question.choices[0].text)
  expect(readRecord().firstAttempts['acoustic-contact:contact-predict'].choiceId).toBe('a')
  expect(screen.getByText('Not correct.', { exact: false })).toBeInTheDocument()
  expect(screen.queryByText('Render changed scan')).not.toBeInTheDocument()
})
it('requires an action and a current rendered image; unsafe transfer must be corrected without overwriting its first response', () => {
  startLab()
  expect(primary()).toBeDisabled()
  fireEvent.click(screen.getByText('Load preset only'))
  expect(primary()).toBeDisabled()
  fireEvent.click(screen.getByText('Move before frame'))
  expect(primary()).toBeDisabled()
  fireEvent.click(screen.getByText('Render changed scan'))
  expect(primary()).toBeEnabled()
  next()
  answer(coupling.observation.choices.find((c) => c.correct)!.text)
  next()
  next()
  answer(coupling.transfer.choices.find((c) => c.unsafe)!.text)
  expect(primary()).toHaveTextContent('Revise this response')
  expect(readRecord().completed).toEqual([])
  next()
  answer(coupling.transfer.choices.find((c) => c.correct)!.text)
  next()
  expect(readRecord().completed).toContain('acoustic-contact')
  expect(readRecord().firstAttempts['acoustic-contact:contact-transfer'].choiceId).toBe('a')
})
it('restart and reload preserve first decisions but restart the incomplete lesson', () => {
  startLab()
  fireEvent.click(screen.getByText('Restart lesson'))
  expect(primary()).toHaveTextContent('Continue')
  expect(readRecord().completed).toEqual([])
  expect(readRecord().firstAttempts['acoustic-contact:contact-predict']).toBeDefined()
  cleanup()
  render(<LessonHost lesson={coupling} />)
  expect(screen.getByRole('heading', { name: 'Orientation' })).toBeInTheDocument()
})
