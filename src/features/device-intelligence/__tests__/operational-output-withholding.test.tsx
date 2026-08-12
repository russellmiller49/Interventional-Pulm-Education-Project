import { cleanup, render } from '@testing-library/react'

import { OutputsPanel } from '@/features/device-intelligence/components/OutputsPanel'
import { OPERATIONAL_OUTPUT_TABS } from '@/features/device-intelligence/domain/operational-outputs'
import { getProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import { getProcedureWorkspace } from '@/features/device-intelligence/server/procedures.server'
import { resolveDemoScenario } from '@/features/preference-cards/data/demo-context.server'

const mockExcludedCatalogProductIds = new Set<string>()

jest.mock('@/features/device-intelligence/server/atlas-store.server', () => {
  const actual = jest.requireActual<
    typeof import('@/features/device-intelligence/server/atlas-store.server')
  >('@/features/device-intelligence/server/atlas-store.server')
  return {
    ...actual,
    getAtlasCatalogStore: () => {
      const store = actual.getAtlasCatalogStore()
      const productById = new Map(store.productById)
      for (const productId of mockExcludedCatalogProductIds) productById.delete(productId)
      return { ...store, productById }
    },
  }
})

function exactStrings(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  ]
}

describe('operational output cohort withholding', () => {
  afterEach(() => {
    mockExcludedCatalogProductIds.clear()
    cleanup()
  })

  it('fails closed across every payload, manifest, and rendered output when a selected product is forced outside the cohort', async () => {
    const workspace = getProcedureWorkspace('CHEST_TUBE')!
    const resolved = resolveDemoScenario(workspace.scenarioId)
    const baseline = getProcedureOutputPreviews(
      workspace.procedureCode,
      workspace.scenarioId,
      workspace.formularySummary,
    )!
    const visibleProductIds = new Set(
      baseline.provenanceManifest.payload.requirements.flatMap((entry) =>
        entry.evidence.identityState === 'visible' ? [entry.evidence.catalogProductId] : [],
      ),
    )
    const hiddenItem = [...resolved.items, ...resolved.suppressedItems].find((item) => {
      const productId = item.selectedItemSnapshot?.catalogProduct?.productId
      return (
        productId !== undefined &&
        visibleProductIds.has(productId) &&
        item.selectedItemSnapshot?.kitComponents.some(
          (component) => component.inclusion === 'included',
        ) === true &&
        item.selectedHospitalItemId !== null &&
        resolved.warnings.some((warning) => warning.sourceId === item.selectedHospitalItemId)
      )
    })!
    const hiddenSnapshot = hiddenItem.selectedItemSnapshot!
    const hiddenProduct = hiddenSnapshot.catalogProduct!
    const identitySeeds = exactStrings([
      hiddenProduct.productId,
      hiddenProduct.productName,
      hiddenProduct.manufacturer,
      hiddenProduct.catalogNumber,
      hiddenProduct.gtin,
      hiddenProduct.sourceId,
      hiddenProduct.sourceLocation,
      hiddenSnapshot.id,
      hiddenItem.selectedHospitalItemId,
      hiddenSnapshot.localDescription,
      hiddenSnapshot.localItemNumber,
      ...Object.values(hiddenSnapshot.attributes).map((value) =>
        typeof value === 'string' ? value : null,
      ),
    ])
    const hiddenWarnings = resolved.warnings.filter(
      (warning) =>
        warning.sourceId === hiddenItem.selectedHospitalItemId ||
        identitySeeds.some((identity) => warning.message.includes(identity)),
    )
    const identityBearingTrace = resolved.ruleTrace.filter(
      (trace) =>
        trace.sourceId === hiddenItem.selectedHospitalItemId ||
        identitySeeds.some((identity) => trace.message.includes(identity)),
    )
    const identityBearingWhy = hiddenItem.whyIncluded.filter((reason) =>
      identitySeeds.some((identity) => reason.includes(identity)),
    )
    const forbidden = exactStrings([
      ...identitySeeds,
      hiddenSnapshot.storageLocation,
      hiddenSnapshot.notes,
      hiddenItem.notes,
      ...hiddenWarnings.flatMap((warning) => [warning.message, warning.sourceId]),
      ...identityBearingTrace.flatMap((trace) => [trace.message, trace.sourceId]),
      ...identityBearingWhy,
    ])
    expect(hiddenWarnings.length).toBeGreaterThan(0)
    expect(identityBearingTrace.length).toBeGreaterThan(0)

    mockExcludedCatalogProductIds.add(hiddenProduct.productId)
    const outputs = getProcedureOutputPreviews(
      workspace.procedureCode,
      workspace.scenarioId,
      workspace.formularySummary,
    )!

    const manifestEntry = outputs.provenanceManifest.payload.requirements.find(
      (entry) => entry.itemId === hiddenItem.id,
    )!
    expect(manifestEntry.evidence).toEqual({ identityState: 'withheld' })

    const nursingLine = outputs.nursing.payload.groups
      .flatMap((group) => group.phases)
      .flatMap((phase) => phase.lines)
      .find((line) => line.itemId === hiddenItem.id)!
    expect(nursingLine.selection).toEqual({ identityState: 'withheld' })

    const packetLine = outputs.setupPacket.payload.roomSetup
      .flatMap((group) => group.lines)
      .find((line) => line.itemId === hiddenItem.id)!
    expect(packetLine.selection).toEqual({ identityState: 'withheld' })
    expect(packetLine).not.toHaveProperty('notes')
    expect(packetLine).not.toHaveProperty('whyIncluded')
    expect(packetLine).not.toHaveProperty('genericRequirement')

    const roomLine = outputs.roomSetup.payload.groups
      .flatMap((group) => group.lines)
      .find((line) => line.itemId === hiddenItem.id)!
    expect(roomLine.selectionIdentityState).toBe('withheld')
    const trainingLine = outputs.training.payload.groups
      .flatMap((group) => group.lines)
      .find((line) => line.itemId === hiddenItem.id)!
    expect(trainingLine.selectionIdentityState).toBe('withheld')
    expect(outputs.roomSetup.payload.suppressedItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ suppression: { state: 'withheld' } })]),
    )

    for (const warning of hiddenWarnings) {
      expect(outputs.provenanceManifest.payload.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: warning.code,
            disclosureState: 'withheld',
          }),
        ]),
      )
    }
    for (const diagnostic of outputs.provenanceManifest.payload.diagnostics.filter(
      (entry) => entry.disclosureState === 'withheld',
    )) {
      expect(diagnostic).not.toHaveProperty('message')
      expect(diagnostic).not.toHaveProperty('sourceId')
      expect(diagnostic).not.toHaveProperty('waiverReason')
    }

    const serialized = JSON.stringify(outputs)
    for (const exactIdentity of forbidden) {
      expect(serialized).not.toContain(exactIdentity)
    }

    for (const tab of OPERATIONAL_OUTPUT_TABS) {
      const view = render(
        await OutputsPanel({
          locale: 'en',
          procedureCode: workspace.procedureCode,
          outputs,
          tab,
        }),
      )
      const rendered = `${view.container.textContent ?? ''}\n${view.container.innerHTML}`
      for (const exactIdentity of forbidden) {
        expect(rendered).not.toContain(exactIdentity)
      }
      view.unmount()
    }
  }, 120_000)
})
