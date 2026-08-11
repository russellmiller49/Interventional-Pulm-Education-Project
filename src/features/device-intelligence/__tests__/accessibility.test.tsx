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
    const { getByText, queryByText } = await renderPage(
      ProcedureWorkspacePage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'CHEST_TUBE' }),
        searchParams: Promise.resolve({ view: 'phases' }),
      }),
    )
    // C-07 absence pin: a workspace without the governed laser condition renders no laser
    // disclosure — the note is derived, not procedure-coded.
    expect(queryByText(/laser pathway is not modelled here/i)).toBeNull()
    getByText(/No rescue module is defined or reachable for this procedure/)
    // F-11: the same sentence now names the only rescue authoring that exists.
    getByText(/absence here is an authoring gap/)
    // F-01: the modifier section states its acting/inert split in production copy...
    getByText(/of 11 allowed modifiers change the requirement list in this release/)
    // ...and the inert ones sit behind a labeled disclosure.
    getByText(/informational only in this release/)
    // F-06 (data pass, 2026-08-09): the four IPC requirements left the chest-tube template
    // for IPC_PLACEMENT, so the divergent-pathway disclosure and the imbalance note — both
    // gated on the section's presence in the composition, not on the procedure code — no
    // longer render. The defensive runtime behaviour stays in place for any future
    // composition that carries a Long-term drainage section.
    expect(queryByText(/Long-term drainage — divergent pathway \(/)).toBeNull()
    expect(queryByText(/divergent long-term pathway/)).toBeNull()
    expect(
      queryByText(/Authoring coverage reflects catalog ingestion, not clinical priority/),
    ).toBeNull()
    // The IPC equipment itself is gone from the page.
    expect(queryByText(/Indwelling pleural catheter kit/)).toBeNull()
  }, 120_000)

  it('workspace page: kit-suppressed requirements render in the room-setup preview (F-02)', async () => {
    const { getByText } = await renderPage(
      ProcedureWorkspacePage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'CHEST_TUBE' }),
        searchParams: Promise.resolve({ output: 'room' }),
      }),
    )
    getByText('Included in a selected kit — not listed separately')
    getByText(/Suppressed because .* includes this component/)
  }, 120_000)

  it('workspace page: THERAPEUTIC_BRONCH carries the authored laser-pathway note (F-07)', async () => {
    const { getByText, getAllByText, queryByText } = await renderPage(
      ProcedureWorkspacePage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'THERAPEUTIC_BRONCH' }),
        searchParams: Promise.resolve({}),
      }),
    )
    getByText(/The laser pathway is not modelled here and must not be planned from this page/)
    // C-02 rendered-page pins: the hidden retrieval-net identity is absent, while the slot
    // discloses its withheld authored options honestly.
    expect(queryByText(/Micro Retrieval Net/)).toBeNull()
    expect(queryByText(/PRD-F43B951B75/)).toBeNull()
    expect(getAllByText(/withheld from this public view/).length).toBeGreaterThan(0)
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
    // F-27: every state label carries the demo qualifier, so a detached screenshot cannot
    // read as an assessment.
    expect(getAllByText(/Demo: Not ready/).length).toBeGreaterThan(0)
    // F-32: the wide table sits in a keyboard-scrollable named region.
    expect(container.querySelector('[role="region"][tabindex="0"]')).not.toBeNull()
    // Table semantics survive.
    expect(container.querySelectorAll('table').length).toBeGreaterThan(0)
    expect(await axe(container)).toHaveNoViolations()
  }, 120_000)

  it('readiness page: a Ready chip carries its resolver advisory in the same cell (F-26)', async () => {
    const { getAllByText } = await renderPage(
      ProcedureReadinessPage({
        params: Promise.resolve({ locale: 'en', procedureCode: 'EBUS_TBNA' }),
      }),
    )
    // The linear EBUS scope row is per-requirement Ready with a pending-verification
    // advisory; the chip itself must say so.
    expect(getAllByText(/Demo: Ready — see advisory/).length).toBeGreaterThan(0)
    expect(getAllByText(/requires current local verification/).length).toBeGreaterThan(0)
    // C-01 rendered pin: the required GENERIC_SUCTION structural gap turns the whole EBUS
    // headline red — a demo stand-in selection no longer reads as a limitation.
    expect(getAllByText(/Demo: Not ready/).length).toBeGreaterThan(0)
  }, 120_000)

  it('role page: verbatim guidance quoting and discovery-fact caption', async () => {
    const { container, getByText } = await renderPage(
      ClinicalRolePage({
        params: Promise.resolve({ locale: 'en', roleCode: 'EBUS_SCOPE' }),
      }),
    )
    getByText(/Role membership is a discovery fact/)
    // C-05: the generic-guidance qualifier is global — it renders on a role whose guidance
    // has nothing to do with formularies too.
    getByText(/does not establish that any hospital carries/)
    expect(await axe(container)).toHaveNoViolations()
  }, 120_000)

  it('role page: formulary-flavored governed guidance carries the non-institutional qualifier (C-05)', async () => {
    const { getByText } = await renderPage(
      ClinicalRolePage({
        params: Promise.resolve({ locale: 'en', roleCode: 'GENERIC_DRAINAGE_UNIT' }),
      }),
    )
    // The governed string renders verbatim…
    getByText(/“Hospital formulary item\.”/)
    // …with the global qualifier adjacent: generic authored content, no real institution.
    getByText(/template language only/)
    getByText(
      /does not establish that any hospital carries, stocks, prefers, approves, or uses any product/,
    )
  }, 120_000)

  it('requirement browser: a Long-term drainage section still renders as the labeled divergent disclosure (F-06 defensive path)', async () => {
    // No governed composition carries the section any more (the F-06 data pass moved the IPC
    // requirements to IPC_PLACEMENT), so this pins the retained defensive rendering with a
    // synthetic requirement: if a future composition reintroduces the section, it must render
    // behind the separated, labeled disclosure — never inline as core setup.
    const { RequirementBrowser } =
      await import('@/features/device-intelligence/components/RequirementBrowser')
    const { getProcedureWorkspace } =
      await import('@/features/device-intelligence/server/procedures.server')
    const workspace = getProcedureWorkspace('CHEST_TUBE')!
    const template = workspace.requirements[0]
    const synthetic = {
      ...workspace,
      requirements: [
        ...workspace.requirements,
        { ...template, id: 'SYNTH-DIVERGENT', section: 'Long-term drainage' },
      ],
    }
    const { getByText, container } = await renderPage(
      RequirementBrowser({ locale: 'en', workspace: synthetic, view: 'zones' }),
    )
    // The jest next-intl mock returns the raw ICU message for plural keys, so the assertion
    // pins the stable prefix rather than the interpolated count.
    getByText(/Long-term drainage — divergent pathway \(/)
    getByText(/a pathway distinct from chest-tube insertion itself/)
    // The divergent card sits inside the collapsed disclosure, not inline with the group.
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details!.querySelector('summary')!.textContent).toContain(
      'Long-term drainage — divergent pathway',
    )
  }, 120_000)
})
