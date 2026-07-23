import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CRITICAL_CARE_NOTEBOOK_STORAGE_KEY } from '../notebook'
import { CriticalCareNotebookView } from './CriticalCareNotebookView'
import { CriticalCareReferenceLibrary } from './CriticalCareReferenceLibrary'

const recordSiteModuleEvent = jest.fn()
const catalog = buildCriticalCarePublicClientCatalog()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: (...args: unknown[]) => recordSiteModuleEvent(...args),
}))

describe('critical-care reference and notebook', () => {
  beforeEach(() => {
    window.localStorage.clear()
    recordSiteModuleEvent.mockClear()
  })

  it('searches and filters shared records without sending search text in analytics', async () => {
    render(<CriticalCareReferenceLibrary catalog={catalog} />)
    const search = screen.getByPlaceholderText(
      /Search waveforms, formulas, alarms, devices, or evidence IDs/i,
    )
    fireEvent.change(search, { target: { value: 'not-a-real-clinical-record-zz' } })
    expect(await screen.findByText('0 records')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'No matching reference records' }),
    ).toBeInTheDocument()
    expect(recordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({
          interaction: 'critical_care_reference_no_results',
          searchCategory: 'all',
          resultCount: 0,
        }),
      }),
    )
    expect(JSON.stringify(recordSiteModuleEvent.mock.calls)).not.toContain(
      'not-a-real-clinical-record-zz',
    )

    fireEvent.change(search, { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'formulas' } })
    expect(
      screen.getByRole('heading', { name: 'Hemodynamic formulas and model limits' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'PAC signal-validation sequence' }),
    ).not.toBeInTheDocument()
  })

  it('keeps draft ECMO and private ICU catalog metadata out of public reference surfaces', () => {
    render(<CriticalCareReferenceLibrary catalog={catalog} />)

    expect(
      within(screen.getByLabelText('Module')).queryByRole('option', { name: 'ECMO Management' }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Module')).queryByRole('option', {
        name: 'Integrated ICU Simulator',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Competency')).queryByRole('option', {
        name: 'ECMO circuit assessment',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Device/version')).queryByRole('option', {
        name: /CARDIOHELP-i/i,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'ECMO circuit and alarm assessment' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: 'Integrated ICU Simulator evidence and model limits',
      }),
    ).not.toBeInTheDocument()
  })

  it('saves a catalog record and resolves it in the notebook after reload', async () => {
    const { unmount } = render(
      <CriticalCareReferenceLibrary
        catalog={catalog}
        selectedItemId="reference:hemodynamics:signal-validation"
      />,
    )
    const save = await screen.findByRole('button', {
      name: 'Save to notebook: PAC signal-validation sequence',
    })
    expect(screen.getAllByRole('link', { name: 'PAC signal validation' })[0]).toHaveAttribute(
      'href',
      '/icu-hemodynamics/learn?activity=pac-signal-validation',
    )
    fireEvent.click(save)
    expect(window.localStorage.getItem(CRITICAL_CARE_NOTEBOOK_STORAGE_KEY)).toContain(
      'reference:hemodynamics:signal-validation',
    )
    expect(recordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'section_completed',
        eventPayload: expect.objectContaining({
          interaction: 'critical_care_notebook_saved',
          targetId: 'reference:hemodynamics:signal-validation',
        }),
      }),
    )
    unmount()

    render(<CriticalCareNotebookView catalog={catalog} />)
    expect(
      await screen.findByRole('heading', { name: 'PAC signal-validation sequence' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('heading', { name: 'No saved records yet' })).toBeInTheDocument()
  })
})
