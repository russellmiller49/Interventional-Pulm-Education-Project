import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { SavedDevicesWorkspace } from '../components/SavedDevicesWorkspace'
import { SavedDevicesProvider } from '../components/SavedDevicesProvider'
import { SAVED_DEVICES_KEY, serializeSavedDevices } from '../domain/saved-devices'
import { getSavedDeviceCards } from '../server/reference-workspace.server'
import { getProductStatusLabels } from '../server/status-labels.server'
import messages from '../../../../messages/en.json'

jest.mock(
  'next/link',
  () =>
    function TestLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
      return <a {...props} />
    },
)
const ids = [
  'PRD-05670F1B5F',
  'PRD-7DC3645CFA',
  'PRD-2632FFBF07',
  'PRD-4A04124FF2',
  'PRD-003C4641E6',
]
const originalFetch = global.fetch

async function show() {
  const statusLabels = await getProductStatusLabels('en')
  return render(
    <SavedDevicesProvider>
      <SavedDevicesWorkspace
        locale="en"
        labels={messages.deviceIntelligence.savedDevices}
        saveLabels={messages.deviceIntelligence.reference}
        statusLabels={statusLabels}
        typeLabels={messages.deviceIntelligence.taxonomy.subtypes}
      />
    </SavedDevicesProvider>,
  )
}

describe('Saved workspace loading and comparison actions', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(SAVED_DEVICES_KEY, serializeSavedDevices(ids))
  })
  afterEach(() => {
    localStorage.clear()
    global.fetch = originalFetch
  })
  it('allows at most four choices and links their exact identifiers', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => getSavedDeviceCards(ids) })
    await show()
    const choices = await screen.findAllByRole('checkbox')
    choices.slice(0, 4).forEach((choice) => fireEvent.click(choice))
    expect(choices[4]).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Compare selected devices' })).toHaveAttribute(
      'href',
      `/en/devices/compare?ids=${encodeURIComponent(ids.slice(0, 4).join(','))}`,
    )
    fireEvent.click(choices[0])
    expect(choices[4]).toBeEnabled()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/device-intelligence/saved?ids='),
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })
  it('retains identifiers after a lookup failure and offers retry', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => getSavedDeviceCards(ids) })
    await show()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(JSON.parse(localStorage.getItem(SAVED_DEVICES_KEY)!).productIds).toEqual(ids)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findAllByRole('checkbox')).toHaveLength(5)
  })
  it('ignores a late response for a removed list and keeps unavailable identities until an explicit removal', async () => {
    let finish: (result: unknown) => void = () => undefined
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce({ ok: true, json: async () => ({ devices: [], unavailableCount: 1 }) })
    await show()
    act(() => {
      localStorage.setItem(SAVED_DEVICES_KEY, serializeSavedDevices(['PRD-NOTFOUND']))
      window.dispatchEvent(new StorageEvent('storage', { key: SAVED_DEVICES_KEY }))
    })
    await screen.findByRole('button', { name: 'Remove unavailable items' })
    await act(async () => {
      finish({ ok: true, json: async () => getSavedDeviceCards(ids) })
    })
    expect(screen.queryByText('Flexible Cryoprobe 2.4 mm')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(SAVED_DEVICES_KEY)!).productIds).toEqual([
      'PRD-NOTFOUND',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable items' }))
    await waitFor(() => expect(screen.getByText('No devices saved yet.')).toBeInTheDocument())
  })
})
