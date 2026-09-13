import { isEbusMessage, EMPTY_EBUS_OBSERVATION } from '@/lib/ebus-guided-bridge'
import { labGoalMet } from '../content/types'
import { coupling } from '../content/curriculum'
it('rejects malformed messages and nonfinite observations', () => {
  expect(isEbusMessage({ version: 2, type: 'ready' })).toBe(false)
  expect(
    isEbusMessage({
      version: 1,
      type: 'observation',
      sessionId: 'a',
      observation: { ...EMPTY_EBUS_OBSERVATION, contactQuality: NaN },
    }),
  ).toBe(false)
  expect(
    isEbusMessage({
      version: 1,
      type: 'observation',
      sessionId: 'a',
      observation: EMPTY_EBUS_OBSERVATION,
    }),
  ).toBe(true)
})
it('does not count elapsed time, initial targets or stale frames as a lab result', () => {
  expect(
    labGoalMet(coupling.lab!, {
      ...EMPTY_EBUS_OBSERVATION,
      ready: true,
      frameReady: true,
      targetVisible: true,
      contactQuality: 1,
    }),
  ).toBe(false)
  expect(
    labGoalMet(coupling.lab!, {
      ...EMPTY_EBUS_OBSERVATION,
      ready: true,
      frameReady: false,
      targetVisible: true,
      contactQuality: 1,
      actionCount: 5,
    }),
  ).toBe(false)
})
