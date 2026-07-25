import type { ResolvedCardItem, RuleTraceEvent } from './types'

export interface KitSuppressionResult {
  items: ResolvedCardItem[]
  suppressedItems: ResolvedCardItem[]
  trace: RuleTraceEvent[]
}
export function suppressKitDuplicates(
  items: ResolvedCardItem[],
  startSequence: number,
): KitSuppressionResult {
  const suppressibleRoles = new Map<string, string>()

  for (const item of items) {
    const selected = item.selectedItemSnapshot
    if (!selected || selected.itemType !== 'procedure_kit') continue
    for (const component of selected.kitComponents) {
      if (component.inclusion === 'included') {
        suppressibleRoles.set(component.roleCode, selected.localDescription)
      }
    }
  }

  const retained: ResolvedCardItem[] = []
  const suppressed: ResolvedCardItem[] = []
  const trace: RuleTraceEvent[] = []

  for (const item of items) {
    const satisfyingKit = suppressibleRoles.get(item.roleCode)
    if (!satisfyingKit || item.selectedItemSnapshot?.itemType === 'procedure_kit') {
      retained.push(item)
      continue
    }

    const suppressedItem: ResolvedCardItem = {
      ...item,
      resolutionState: 'suppressed_by_kit',
      whyIncluded: [
        ...item.whyIncluded,
        `Suppressed because ${satisfyingKit} includes this component.`,
      ],
    }
    suppressed.push(suppressedItem)
    trace.push({
      id: `trace-kit-${item.id}`,
      sequence: startSequence + trace.length,
      kind: 'kit_suppression',
      message: `${item.label} was not pulled separately because ${satisfyingKit} includes role ${item.roleCode}.`,
      sourceId: item.selectedHospitalItemId,
      slotId: item.id,
    })
  }

  return { items: retained, suppressedItems: suppressed, trace }
}
