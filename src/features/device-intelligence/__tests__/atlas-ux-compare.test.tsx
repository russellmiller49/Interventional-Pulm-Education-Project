import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'

import {
  CompareButton,
  CompareSelectionProvider,
  CompareTray,
  type CompareLabels,
} from '../components/CompareSelection'
import { SaveDeviceButton, SavedDevicesProvider } from '../components/SavedDevicesProvider'
import {
  COMPARE_SELECTION_KEY,
  parseCompareSelection,
  serializeCompareSelection,
  toggleCompareSelection,
} from '../domain/compare-selection'
import { comparisonValuesDiffer, GENERAL_COMPARISON_FIELDS } from '../domain/comparison'
import { MAX_COMPARISON_DEVICES, SAVED_DEVICES_KEY } from '../domain/saved-devices'
import messages from '../../../../messages/en.json'

jest.mock(
  'next/link',
  () =>
    function TestLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
      return <a {...props} />
    },
)
let mockPathname = '/en/devices'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

const labels: CompareLabels = messages.deviceIntelligence.compareSelection
const saveLabels = messages.deviceIntelligence.reference
const ids = [
  'PRD-05670F1B5F',
  'PRD-7DC3645CFA',
  'PRD-2632FFBF07',
  'PRD-4A04124FF2',
  'PRD-003C4641E6',
]
const originalFetch = global.fetch

function show() {
  return render(
    <SavedDevicesProvider>
      <CompareSelectionProvider>
        {ids.map((id, index) => (
          <div key={id}>
            <CompareButton productId={id} productName={`Device ${index + 1}`} labels={labels} />
            <SaveDeviceButton
              productId={id}
              productName={`Device ${index + 1}`}
              labels={saveLabels}
            />
          </div>
        ))}
        <CompareTray locale="en" labels={labels} />
      </CompareSelectionProvider>
    </SavedDevicesProvider>,
  )
}

const compareButton = (index: number) =>
  screen.getByRole('button', { name: new RegExp(`^(Compare|In comparison): Device ${index}$`) })

describe('comparison selection storage contract', () => {
  it('stores identifiers only, validated and bounded by the comparison maximum', () => {
    const raw = serializeCompareSelection(ids.slice(0, 2))
    expect(JSON.parse(raw)).toEqual({ version: 1, productIds: ids.slice(0, 2) })
    expect(parseCompareSelection(raw)).toEqual(ids.slice(0, 2))
    expect(parseCompareSelection(null)).toEqual([])
    expect(() => serializeCompareSelection(ids)).toThrow()
    expect(() => parseCompareSelection('{"version":1,"productIds":["<script>"]}')).toThrow()
    expect(() => parseCompareSelection('{"version":2,"productIds":[]}')).toThrow()
  })

  it('adds and removes one device, and refuses a fifth without dropping another', () => {
    const four = ids.slice(0, MAX_COMPARISON_DEVICES)
    expect(toggleCompareSelection([], ids[0])).toEqual({ ok: true, ids: [ids[0]] })
    expect(toggleCompareSelection(four, ids[1])).toEqual({
      ok: true,
      ids: four.filter((id) => id !== ids[1]),
    })
    expect(toggleCompareSelection(four, ids[4])).toEqual({ ok: false, reason: 'limit' })
    expect(toggleCompareSelection([], 'not-a-product')).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('compare button and tray', () => {
  beforeEach(() => {
    localStorage.clear()
    mockPathname = '/en/devices'
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const requested = new URL(String(input), 'https://atlas.test').searchParams.get('ids')!
      return {
        ok: true,
        json: async () => ({
          devices: requested
            .split(',')
            .map((id) => ({ productId: id, productName: `Name ${id}`, catalogNumber: null })),
        }),
      } as Response
    }) as typeof fetch
  })
  afterEach(() => {
    localStorage.clear()
    global.fetch = originalFetch
  })

  it('shows no tray until a device is selected, then links the exact identifiers', async () => {
    show()
    await waitFor(() => expect(compareButton(1)).toBeEnabled())
    expect(screen.queryByRole('region', { name: 'Compare devices' })).toBeNull()

    fireEvent.click(compareButton(1))
    const tray = await screen.findByRole('region', { name: 'Compare devices' })
    expect(tray).toHaveTextContent('(1/4)')
    expect(tray).toHaveTextContent('Add one more device to compare.')
    expect(compareButton(1)).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(compareButton(2))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Compare devices \(2\)/ })).toHaveAttribute(
        'href',
        `/en/devices/compare?ids=${encodeURIComponent(`${ids[0]},${ids[1]}`)}`,
      ),
    )
    // Names come from the server lookup; browser storage holds identifiers only.
    await screen.findByText(`Name ${ids[0]}`)
    expect(parseCompareSelection(localStorage.getItem(COMPARE_SELECTION_KEY))).toEqual([
      ids[0],
      ids[1],
    ])
  })

  it('respects the existing four-device maximum and says so', async () => {
    show()
    await waitFor(() => expect(compareButton(1)).toBeEnabled())
    for (const index of [1, 2, 3, 4]) fireEvent.click(compareButton(index))
    await waitFor(() => expect(screen.getByRole('region')).toHaveTextContent('(4/4)'))

    fireEvent.click(compareButton(5))
    expect(compareButton(5)).toHaveAttribute('aria-pressed', 'false')
    await screen.findByText(labels.limit)
    expect(parseCompareSelection(localStorage.getItem(COMPARE_SELECTION_KEY))).toHaveLength(4)
  })

  it('removes a device from the tray, clears the selection, and persists across remounts', async () => {
    const first = show()
    await waitFor(() => expect(compareButton(1)).toBeEnabled())
    fireEvent.click(compareButton(1))
    fireEvent.click(compareButton(2))
    await screen.findByText(`Name ${ids[1]}`)
    first.unmount()

    // A later page (new mount) restores the same selection from storage.
    show()
    await waitFor(() => expect(compareButton(1)).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.click(
      await screen.findByRole('button', { name: `Remove from comparison: Name ${ids[0]}` }),
    )
    await waitFor(() => expect(compareButton(1)).toHaveAttribute('aria-pressed', 'false'))
    expect(parseCompareSelection(localStorage.getItem(COMPARE_SELECTION_KEY))).toEqual([ids[1]])

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull())
    expect(parseCompareSelection(localStorage.getItem(COMPARE_SELECTION_KEY))).toEqual([])
  })

  it('keeps saved devices and the comparison selection distinct', async () => {
    show()
    await waitFor(() => expect(compareButton(1)).toBeEnabled())
    fireEvent.click(compareButton(1))
    await screen.findByRole('region', { name: 'Compare devices' })
    // Comparing did not save...
    expect(localStorage.getItem(SAVED_DEVICES_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save device: Device 2' }))
    await waitFor(() => expect(localStorage.getItem(SAVED_DEVICES_KEY)).not.toBeNull())
    // ...and saving did not add to the comparison.
    expect(JSON.parse(localStorage.getItem(SAVED_DEVICES_KEY)!).productIds).toEqual([ids[1]])
    expect(parseCompareSelection(localStorage.getItem(COMPARE_SELECTION_KEY))).toEqual([ids[0]])
    expect(COMPARE_SELECTION_KEY).not.toBe(SAVED_DEVICES_KEY)
  })

  it('stays out of the way on the comparison page itself', async () => {
    localStorage.setItem(COMPARE_SELECTION_KEY, serializeCompareSelection(ids.slice(0, 2)))
    mockPathname = '/en/devices/compare'
    show()
    await waitFor(() => expect(compareButton(1)).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByRole('region', { name: 'Compare devices' })).toBeNull()
  })

  it('never overwrites a malformed stored selection and keeps working in memory', async () => {
    localStorage.setItem(COMPARE_SELECTION_KEY, '{"version":9}')
    show()
    await waitFor(() => expect(compareButton(1)).toBeEnabled())
    await act(async () => {
      fireEvent.click(compareButton(1))
    })
    expect(compareButton(1)).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(COMPARE_SELECTION_KEY)).toBe('{"version":9}')
  })
})

describe('differences-only comparison rows', () => {
  const recorded = (value: string | number, unit: string | null = null) => ({ value, unit })
  const missing = { value: null, unit: null }

  it('treats recorded-versus-missing as a difference and folds only agreeing rows', () => {
    expect(comparisonValuesDiffer([recorded(21), recorded(22)])).toBe(true)
    expect(comparisonValuesDiffer([recorded(2, 'mm'), missing])).toBe(true)
    expect(comparisonValuesDiffer([recorded('Reusable'), recorded('reusable ')])).toBe(false)
    expect(comparisonValuesDiffer([recorded(70, 'cm'), recorded(70, 'cm')])).toBe(false)
    expect(comparisonValuesDiffer([missing, missing])).toBe(false)
    expect(comparisonValuesDiffer([recorded(70, 'cm'), recorded(70, 'mm')])).toBe(true)
  })

  it('applies to specification fields only — safety and status are not among them', () => {
    expect([...GENERAL_COMPARISON_FIELDS]).toEqual([
      'reuse',
      'sterile',
      'package',
      'packageQuantity',
    ])
    const fieldLabels = Object.keys(messages.deviceIntelligence.comparison.fields)
    expect(fieldLabels).not.toContain('safety')
    expect(fieldLabels).not.toContain('type')
  })
})
