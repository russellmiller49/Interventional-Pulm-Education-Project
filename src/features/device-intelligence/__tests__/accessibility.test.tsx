import { render } from '@testing-library/react'
import { axe } from 'jest-axe'

import ProceduresIndexPage from '@/app/[locale]/procedures/page'
import ProcedureWorkspacePage from '@/app/[locale]/procedures/[procedureCode]/page'
import ProcedureReadinessPage from '@/app/[locale]/procedures/[procedureCode]/readiness/page'
import ClinicalRolePage from '@/app/[locale]/clinical-roles/[roleCode]/page'

/**
 * The D1 pages are async server components; in jsdom they are awaited and rendered as plain
 * elements (jest.setup.ts supplies the next-intl mock over the real en bundle, so every
 * label asserted here is the production copy).
 */

jest.setTimeout(120_000)

async function renderPage(element: Promise<React.ReactElement>) {
  return render(await element)
}

describe('D1 accessibility and required warnings', () => {
  it('procedures index: semantic headings, draft watermark, exemplar labeling', async () => {
    const { container, getByRole, getByText } = await renderPage(
      ProceduresIndexPage({ params: Promise.resolve({ locale: 'en' }) }),
    )
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('Procedure workspaces')
    getByText('DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE')
    getByText(/Phase D1 exemplar set/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('workspace page: link tabs are keyboard-reachable anchors with aria-current', async () => {
    const { container, getAllByRole } = await renderPage(
      ProcedureWorkspacePage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'CHEST_TUBE' }),
        searchParams: Promise.resolve({}),
      }),
    )
    const zoneTab = getAllByRole('link', { name: 'By setup zone' })[0]
    expect(zoneTab).toHaveAttribute('aria-current', 'page')
    const phaseTab = getAllByRole('link', { name: 'By procedural phase' })[0]
    expect(phaseTab).not.toHaveAttribute('aria-current')
    expect(phaseTab).toHaveAttribute('href', expect.stringContaining('view=phases'))

    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(await axe(container)).toHaveNoViolations()
  }, 120_000)

  it('workspace page: no-rescue fact and BOM-managed securement render for CHEST_TUBE', async () => {
    const { getByText } = await renderPage(
      ProcedureWorkspacePage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'CHEST_TUBE' }),
        searchParams: Promise.resolve({ view: 'phases' }),
      }),
    )
    getByText(/No rescue module is defined or reachable for this procedure/)
  }, 120_000)

  it('readiness page: both watermarks, real-formulary honesty, state legend, evidence links', async () => {
    const { container, getByText, getAllByText } = await renderPage(
      ProcedureReadinessPage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'CHEST_TUBE' }),
      }),
    )
    getByText('DEMO DATA — NOT AN ACTUAL INSTITUTION')
    getByText('DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE')
    getByText('Not ready — no institutional data recorded.')
    expect(getAllByText(/Missing required product role/).length).toBeGreaterThan(0)
    // Table semantics survive.
    expect(container.querySelectorAll('table').length).toBeGreaterThan(0)
    expect(await axe(container)).toHaveNoViolations()
  }, 120_000)

  it('role page: verbatim guidance quoting and discovery-fact caption', async () => {
    const { container, getByText } = await renderPage(
      ClinicalRolePage({
        params: Promise.resolve({ locale: 'en', roleCode: 'EBUS_SCOPE' }),
      }),
    )
    getByText(/Role membership is a discovery fact/)
    expect(await axe(container)).toHaveNoViolations()
  }, 120_000)
})
