import { act, renderHook } from '@testing-library/react'

import { createProbeStore, useProbeState } from '../state/probeStore'
import { testProbe } from '../testSupport/fixtures'

function makeManualStore() {
  const pendingFlushes: Array<() => void> = []
  const store = createProbeStore(testProbe, (callback) => {
    pendingFlushes.push(callback)
  })
  const flush = () => {
    const callbacks = pendingFlushes.splice(0)
    callbacks.forEach((callback) => callback())
  }
  return { store, flush, pendingFlushes }
}

describe('probe store batching', () => {
  it('applies writes to getState immediately but batches snapshots per frame', () => {
    const { store, flush, pendingFlushes } = makeManualStore()
    const listener = jest.fn()
    store.subscribe(listener)

    store.setState({ lateralMm: 10 })
    store.setState({ lateralMm: 20 })
    store.setState({ craniocaudalMm: 5 })

    expect(store.getState().lateralMm).toBe(20)
    expect(store.getState().craniocaudalMm).toBe(5)
    expect(store.getSnapshot()).toBe(testProbe)
    expect(listener).not.toHaveBeenCalled()
    expect(pendingFlushes).toHaveLength(1)

    flush()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().lateralMm).toBe(20)
    expect(store.getSnapshot()).toBe(store.getState())
  })

  it('skips notification when nothing changed by flush time', () => {
    const { store, flush } = makeManualStore()
    const listener = jest.fn()
    store.subscribe(listener)

    store.flushSync()
    flush()
    expect(listener).not.toHaveBeenCalled()
  })

  it('flushSync publishes pending writes immediately', () => {
    const { store } = makeManualStore()
    const listener = jest.fn()
    store.subscribe(listener)

    store.setState({ tiltDeg: 9 })
    store.flushSync()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().tiltDeg).toBe(9)
  })

  it('replaceState resets the whole transform and unsubscribe stops updates', () => {
    const { store, flush } = makeManualStore()
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)

    store.setState({ lateralMm: 42 })
    store.replaceState(testProbe)
    flush()
    expect(listener).not.toHaveBeenCalled()
    expect(store.getState()).toBe(testProbe)

    store.setState({ lateralMm: 1 })
    unsubscribe()
    flush()
    expect(listener).not.toHaveBeenCalled()
  })

  it('drives useSyncExternalStore consumers once per flush', () => {
    const { store, flush } = makeManualStore()
    const { result } = renderHook(() => useProbeState(store))

    expect(result.current).toBe(testProbe)

    act(() => {
      store.setState({ lateralMm: 11 })
      store.setState({ lateralMm: 12 })
    })
    expect(result.current.lateralMm).toBe(testProbe.lateralMm)

    act(() => {
      flush()
    })
    expect(result.current.lateralMm).toBe(12)
  })
})
