import type {
  HospitalItem,
  ResolvedCardItem,
  RuleMessage,
  RuleTraceEvent,
  TypedCompatibilityRule,
} from './types'

export interface CompatibilityEvaluation {
  ruleId: string
  state: 'pass' | 'fail' | 'unknown'
  sourceItemId: string | null
  targetItemId: string | null
  message: RuleMessage | null
  trace: RuleTraceEvent
}
function itemAttribute(item: HospitalItem | null, attribute: string): unknown {
  if (!item) return null
  if (attribute in item.attributes) return item.attributes[attribute]
  if (attribute === 'delivery_system_od_mm') {
    return item.catalogProduct?.deliverySystemOdMm ?? null
  }
  if (attribute === 'min_working_channel_mm') {
    return item.catalogProduct?.minWorkingChannelMm ?? null
  }
  return null
}

function compareValues(
  left: unknown,
  operator: TypedCompatibilityRule['operator'],
  right: unknown,
): boolean {
  switch (operator) {
    case 'eq':
      return left === right
    case 'neq':
      return left !== right
    case 'lt':
      return typeof left === 'number' && typeof right === 'number' && left < right
    case 'lte':
      return typeof left === 'number' && typeof right === 'number' && left <= right
    case 'gt':
      return typeof left === 'number' && typeof right === 'number' && left > right
    case 'gte':
      return typeof left === 'number' && typeof right === 'number' && left >= right
    case 'in':
      return Array.isArray(right) && right.includes(left)
    case 'not_in':
      return Array.isArray(right) && !right.includes(left)
    case 'exists':
      return left !== null && left !== undefined && left !== ''
    case 'requires':
      return Boolean(left) ? Boolean(right) : true
    default: {
      const exhaustiveCheck: never = operator
      return exhaustiveCheck
    }
  }
}

function selectedItemForRole(
  items: ResolvedCardItem[],
  roleCode: string | null,
): ResolvedCardItem | null {
  if (!roleCode) return null
  return (
    items.find((item) => item.roleCode === roleCode && item.selectedItemSnapshot !== null) ?? null
  )
}

export function evaluateCompatibilityRule(
  rule: TypedCompatibilityRule,
  items: ResolvedCardItem[],
  traceSequence: number,
): CompatibilityEvaluation {
  const sourceResolved = selectedItemForRole(items, rule.sourceRoleCode)
  const targetResolved = selectedItemForRole(items, rule.targetRoleCode)
  const sourceItem = sourceResolved?.selectedItemSnapshot ?? null
  const targetItem = targetResolved?.selectedItemSnapshot ?? null
  const sourceValue = itemAttribute(sourceItem, rule.sourceAttribute)
  const targetValue = rule.targetAttribute
    ? itemAttribute(targetItem, rule.targetAttribute)
    : rule.expectedValue

  const missingFields: string[] = []
  if (sourceValue === null || sourceValue === undefined || sourceValue === '') {
    missingFields.push(`${rule.sourceRoleCode}.${rule.sourceAttribute}`)
  }
  if (
    rule.operator !== 'exists' &&
    (targetValue === null || targetValue === undefined || targetValue === '')
  ) {
    missingFields.push(
      rule.targetRoleCode && rule.targetAttribute
        ? `${rule.targetRoleCode}.${rule.targetAttribute}`
        : 'expected value',
    )
  }

  if (missingFields.length > 0) {
    const message = `${rule.missingValueMessage} Missing: ${missingFields.join(', ')}.`
    return {
      ruleId: rule.id,
      state: 'unknown',
      sourceItemId: sourceItem?.id ?? null,
      targetItemId: targetItem?.id ?? null,
      message: {
        id: `compatibility-unknown-${rule.id}`,
        severity: 'warning',
        code: 'compatibility_unknown',
        message,
        sourceType: 'compatibility_rule',
        sourceId: rule.id,
        acknowledged: false,
        waiverReason: null,
      },
      trace: {
        id: `trace-compatibility-${rule.id}`,
        sequence: traceSequence,
        kind: 'compatibility',
        message,
        sourceId: rule.id,
        slotId: sourceResolved?.id ?? null,
      },
    }
  }

  const passed = compareValues(sourceValue, rule.operator, targetValue)
  const detail = passed ? `Compatibility rule ${rule.id} passed.` : rule.message
  return {
    ruleId: rule.id,
    state: passed ? 'pass' : 'fail',
    sourceItemId: sourceItem?.id ?? null,
    targetItemId: targetItem?.id ?? null,
    message: passed
      ? null
      : {
          id: `compatibility-fail-${rule.id}`,
          severity: rule.severity,
          code: 'compatibility_failed',
          message: rule.message,
          sourceType: 'compatibility_rule',
          sourceId: rule.id,
          acknowledged: false,
          waiverReason: null,
        },
    trace: {
      id: `trace-compatibility-${rule.id}`,
      sequence: traceSequence,
      kind: 'compatibility',
      message: detail,
      sourceId: rule.id,
      slotId: sourceResolved?.id ?? null,
    },
  }
}

export function evaluateCompatibilityRules(
  rules: TypedCompatibilityRule[],
  items: ResolvedCardItem[],
  selectedModifierCodes: string[],
  startSequence: number,
): CompatibilityEvaluation[] {
  const selected = new Set(selectedModifierCodes)
  return rules
    .filter(
      (rule) =>
        rule.active &&
        (rule.modifierCodes.length === 0 || rule.modifierCodes.some((code) => selected.has(code))),
    )
    .map((rule, index) => evaluateCompatibilityRule(rule, items, startSequence + index))
}
