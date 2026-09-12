import { act, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { axe } from 'jest-axe'
import { comparisonFieldsForClass } from '../domain/comparison'
import {
  MAX_SAVED_DEVICES,
  parseDeviceIds,
  parseSavedDevices,
  SAVED_DEVICES_KEY,
  serializeSavedDevices,
} from '../domain/saved-devices'
import {
  comparisonValue,
  getDeviceComparison,
  getSavedDeviceCards,
} from '../server/reference-workspace.server'
import { getAtlasProductDetail } from '../server/atlas.server'
import { getAtlasCatalogStore } from '../server/atlas-store.server'
import {
  SaveDeviceButton,
  SavedDevicesProvider,
  useSavedDevices,
} from '../components/SavedDevicesProvider'
import { getProcedureWorkspace } from '../server/procedures.server'
import { getProcedureReviewSummary } from '../server/procedure-review.server'
import DeviceComparisonPage from '@/app/[locale]/devices/compare/page'
import ProcedureSetupPage from '@/app/[locale]/procedures/[procedureCode]/setup/page'
import messages from '../../../../messages/en.json'

const CRYO = 'PRD-05670F1B5F'
const AXESS = 'PRD-2632FFBF07'
const CLR = 'PRD-003C4641E6'
const labels = messages.deviceIntelligence.reference

jest.mock(
  'next/link',
  () =>
    function TestLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
      return <a {...props} />
    },
)

describe('Saved identifiers and cohort boundaries', () => {
  it('retains exact identifiers and deduplicates without storing device facts', () => {
    expect(parseSavedDevices(serializeSavedDevices([CRYO, AXESS, CRYO]))).toEqual([CRYO, AXESS])
    expect(JSON.parse(serializeSavedDevices([CRYO]))).toEqual({ version: 1, productIds: [CRYO] })
    expect(parseSavedDevices(null)).toEqual([])
  })
  it.each([
    '{',
    '{"version":2,"productIds":[]}',
    '{"version":1,"productIds":["<script>"]}',
    'x'.repeat(8001),
  ])('rejects malformed or unsupported browser data', (raw) => {
    expect(() => parseSavedDevices(raw)).toThrow()
  })
  it('bounds storage and URL queries instead of truncating silently', () => {
    expect(() => serializeSavedDevices(Array(MAX_SAVED_DEVICES + 1).fill(CRYO))).toThrow()
    expect(parseDeviceIds(Array(5).fill(CRYO).join(','), 4)).toBeNull()
    expect(parseDeviceIds(`${CRYO},bad`, 4)).toBeNull()
    expect(parseDeviceIds(`${CRYO},${CRYO}`, 4)).toEqual([CRYO])
  })
  it('re-resolves only cohort identities and retains a saved recalled product', () => {
    const result = getSavedDeviceCards([CRYO, 'PRD-NOTFOUND', CRYO], '2026-09-12')
    expect(result.unavailableCount).toBe(1)
    expect(result.devices).toHaveLength(1)
    expect(result.devices[0].status.safetyDisplay).toBe('active_safety_notice')
    expect(result.devices[0].freshness).not.toBe('within_review_interval')
    expect(JSON.stringify(result)).not.toContain('PRD-NOTFOUND')
    expect(Object.keys(result.devices[0]).sort()).toEqual(
      [
        'productId',
        'productName',
        'manufacturer',
        'catalogNumber',
        'size',
        'taxonomy',
        'status',
        'freshness',
      ].sort(),
    )
  })
})

function SavedHarness() {
  const state = useSavedDevices()!
  return (
    <>
      <output data-testid="ids">{state.ids.join(',')}</output>
      <SaveDeviceButton productId={CRYO} productName="Cryoprobe" labels={labels} />
      <SaveDeviceButton productId={AXESS} productName="Broncoscope" labels={labels} />
    </>
  )
}

describe('Personal saved list persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
  })
  it('loads, toggles and persists across remounts', () => {
    const view = render(
      <SavedDevicesProvider>
        <SavedHarness />
      </SavedDevicesProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save device: Cryoprobe' }))
    expect(screen.getByRole('button', { name: 'Saved device: Cryoprobe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(parseSavedDevices(localStorage.getItem(SAVED_DEVICES_KEY))).toEqual([CRYO])
    view.unmount()
    render(
      <SavedDevicesProvider>
        <SavedHarness />
      </SavedDevicesProvider>,
    )
    expect(screen.getByTestId('ids')).toHaveTextContent(CRYO)
    fireEvent.click(screen.getByRole('button', { name: 'Saved device: Cryoprobe' }))
    expect(parseSavedDevices(localStorage.getItem(SAVED_DEVICES_KEY))).toEqual([])
  })
  it('keeps later in-memory edits when storage writes fail', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota')
    })
    render(
      <SavedDevicesProvider>
        <SavedHarness />
      </SavedDevicesProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save device: Cryoprobe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save device: Broncoscope' }))
    expect(screen.getByTestId('ids')).toHaveTextContent(`${CRYO},${AXESS}`)
    expect(screen.getAllByText(labels.storage).length).toBeGreaterThan(0)
  })
  it('does not overwrite unsupported stored versions and still allows session use', () => {
    const unsupported = '{"version":2,"productIds":[]}'
    localStorage.setItem(SAVED_DEVICES_KEY, unsupported)
    render(
      <SavedDevicesProvider>
        <SavedHarness />
      </SavedDevicesProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save device: Cryoprobe' }))
    expect(localStorage.getItem(SAVED_DEVICES_KEY)).toBe(unsupported)
    expect(screen.getByTestId('ids')).toHaveTextContent(CRYO)
  })
  it('reads the latest storage value on another tab change', () => {
    render(
      <SavedDevicesProvider>
        <SavedHarness />
      </SavedDevicesProvider>,
    )
    act(() => {
      localStorage.setItem(SAVED_DEVICES_KEY, serializeSavedDevices([AXESS]))
      window.dispatchEvent(new StorageEvent('storage', { key: SAVED_DEVICES_KEY }))
    })
    expect(screen.getByTestId('ids')).toHaveTextContent(AXESS)
    fireEvent.click(screen.getByRole('button', { name: 'Save device: Cryoprobe' }))
    expect(parseSavedDevices(localStorage.getItem(SAVED_DEVICES_KEY))).toEqual([AXESS, CRYO])
  })
})

describe('Comparison source semantics', () => {
  it('never turns minimum required tool channel or generic diameter into scope channel', () => {
    const needle = getAtlasProductDetail('PRD-1ED27ADA45')!
    expect(comparisonValue(needle, 'minChannel').value).toBe(2)
    expect(comparisonValue(needle, 'workingChannel').value).toBeNull()
    const scope = getAtlasProductDetail(AXESS)!
    expect(comparisonValue(scope, 'workingChannel')).toMatchObject({
      value: 3,
      origin: 'reviewed',
      scope: 'exact',
    })
    expect(comparisonFieldsForClass('needle')).toContain('minChannel')
    expect(comparisonFieldsForClass('bronchoscope')).not.toContain('minChannel')
  })
  it('prefers reviewed exact specs and preserves the original canonical values', () => {
    const detail = getAtlasProductDetail(CRYO)!
    const original = detail.product.working_length_cm
    const changed = { ...detail, product: { ...detail.product, working_length_cm: 999 } }
    expect(comparisonValue(changed, 'workingLength')).toMatchObject({
      value: 115,
      origin: 'reviewed',
      scope: 'exact',
    })
    expect(comparisonValue(changed, 'workingLength').citations.length).toBeGreaterThan(0)
    expect(getAtlasCatalogStore().productById.get(CRYO)!.working_length_cm).toBe(original)
  })
  it('keeps configuration evidence scoped and missing values honest', () => {
    const detail = getAtlasProductDetail('PRD-F4AE2A74E6')!
    expect(comparisonValue(detail, 'outerDiameter')).toMatchObject({
      value: 11,
      scope: 'configuration',
    })
    expect(comparisonValue(getAtlasProductDetail(CLR)!, 'workingChannel').origin).toBe('missing')
  })
  it('withholds category measurements across mixed physical classes', () => {
    expect(getDeviceComparison([CRYO, AXESS])).toMatchObject({ mixedClasses: true, fields: [] })
    expect(getDeviceComparison([AXESS, 'PRD-4A04124FF2']).fields).toContain('workingChannel')
    expect(() => getDeviceComparison(Array(5).fill(CRYO))).toThrow()
  })
  it('uses the corrected summary with safety and specification citations on the rendered comparison', async () => {
    const view = render(
      await DeviceComparisonPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ ids: `${CRYO},PRD-7DC3645CFA` }),
      }),
    )
    expect(screen.getByRole('heading', { name: 'Device comparison' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Z-1568-2026' })).toHaveAttribute(
      'href',
      expect.stringContaining('res.cfm?id='),
    )
    expect(screen.getAllByText('115 cm', { selector: 'span.font-semibold' })).toHaveLength(2)
    expect(await axe(view.container)).toHaveNoViolations()
    view.unmount()
    const clrView = render(
      await DeviceComparisonPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ ids: `${CLR},${CRYO}` }),
      }),
    )
    expect(clrView.container.textContent).toContain('maintaining the drainage circuit')
    expect(clrView.container.textContent).not.toContain('separate suction and irrigation controls')
  }, 60000)
})

describe('Draft procedure review worksheet', () => {
  it.each(['CHEST_TUBE', 'EBUS_TBNA', 'THERAPEUTIC_BRONCH'])(
    'retains the draft boundary and source requirements for %s',
    async (code) => {
      const workspace = getProcedureWorkspace(code)!
      expect(getProcedureReviewSummary(workspace).clinicalOwnerMissing).toBe(true)
      const { container } = render(
        await ProcedureSetupPage({
          params: Promise.resolve({ locale: 'en', procedureCode: code }),
        }),
      )
      expect(
        screen.getByText('DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE'),
      ).toBeInTheDocument()
      expect(container.textContent).toContain('Printed copies do not update automatically')
      expect(container.querySelectorAll('thead')).toHaveLength(1)
      expect(container.textContent).not.toMatch(/hold_unopened|have_in_room|emergency_only/)
      expect(container.querySelector('table')).toHaveTextContent('Have in room')
      expect(await axe(container)).toHaveNoViolations()
    },
    60000,
  )
})
