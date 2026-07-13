import {
  STENT_MECHANICS_MODIFIER_IDS,
  type StentExplorerArchitectureId,
  type StentExplorerControl,
  type StentExplorerControlState,
  type StentExplorerControlValue,
  type StentExplorerStation,
  type StentMechanicsModifierId,
  type StentMechanicsModifiers,
} from './types'

type UnsafeControlState = Readonly<Record<string, unknown>>

const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

const createEmptyModifiers = (): Record<StentMechanicsModifierId, number> =>
  Object.fromEntries(STENT_MECHANICS_MODIFIER_IDS.map((id) => [id, 0])) as Record<
    StentMechanicsModifierId,
    number
  >

function normalizeRangeValue(
  control: Extract<StentExplorerControl, { kind: 'range' }>,
  value: unknown,
) {
  const candidate =
    typeof value === 'number' && Number.isFinite(value) ? value : control.defaultValue
  const clamped = Math.min(control.max, Math.max(control.min, candidate))
  const stepCount = Math.round((clamped - control.min) / control.step)
  const snapped = control.min + stepCount * control.step

  return Number(Math.min(control.max, Math.max(control.min, snapped)).toFixed(6))
}

function normalizeControlValue(
  control: StentExplorerControl,
  value: unknown,
  architectureId?: StentExplorerArchitectureId,
): StentExplorerControlValue {
  switch (control.kind) {
    case 'range':
      return normalizeRangeValue(control, value)
    case 'toggle':
      return typeof value === 'boolean' ? value : control.defaultValue
    case 'preset':
      const availableOptions = control.options.filter(
        (option) =>
          !architectureId ||
          !option.architectureIds ||
          option.architectureIds.includes(architectureId),
      )
      const defaultValue = availableOptions.some((option) => option.id === control.defaultValue)
        ? control.defaultValue
        : (availableOptions[0]?.id ?? control.defaultValue)
      return typeof value === 'string' && availableOptions.some((option) => option.id === value)
        ? value
        : defaultValue
  }
}

function controlSupportsArchitecture(
  control: StentExplorerControl,
  architectureId?: StentExplorerArchitectureId,
) {
  return (
    !architectureId || !control.architectureIds || control.architectureIds.includes(architectureId)
  )
}

/**
 * Returns the complete, canonical defaults for one station. Calling this again is the reset path;
 * explorer controls are intentionally ephemeral and never persisted as progress.
 */
export function createDefaultStentExplorerControlState(
  station: StentExplorerStation,
  architectureId?: StentExplorerArchitectureId,
): StentExplorerControlState {
  return Object.freeze(
    Object.fromEntries(
      station.controls.map((control) => [
        control.id,
        normalizeControlValue(control, control.defaultValue, architectureId),
      ]),
    ),
  )
}

export function resetStentExplorerControlState(
  station: StentExplorerStation,
  architectureId?: StentExplorerArchitectureId,
): StentExplorerControlState {
  return createDefaultStentExplorerControlState(station, architectureId)
}

/**
 * Drops unknown keys, restores invalid values, and snaps range values to the registry step.
 */
export function normalizeStentExplorerControlState(
  station: StentExplorerStation,
  state: UnsafeControlState,
  architectureId?: StentExplorerArchitectureId,
): StentExplorerControlState {
  return Object.freeze(
    Object.fromEntries(
      station.controls.map((control) => [
        control.id,
        normalizeControlValue(control, state[control.id], architectureId),
      ]),
    ),
  )
}

export function setStentExplorerControlValue(
  station: StentExplorerStation,
  state: UnsafeControlState,
  controlId: string,
  value: unknown,
  architectureId?: StentExplorerArchitectureId,
): StentExplorerControlState {
  const knownControl = station.controls.some((control) => control.id === controlId)
  if (!knownControl) return normalizeStentExplorerControlState(station, state, architectureId)

  return normalizeStentExplorerControlState(
    station,
    { ...state, [controlId]: value },
    architectureId,
  )
}

function applyModifier(
  modifiers: Record<StentMechanicsModifierId, number>,
  id: StentMechanicsModifierId,
  value: number,
) {
  modifiers[id] = Math.max(modifiers[id], clampUnit(value))
}

/**
 * Converts station-local UI state into stable, named, normalized mechanics signals. Multiple
 * controls that address the same finding are combined by their strongest visible signal.
 */
export function deriveStentMechanicsModifiers(
  station: StentExplorerStation,
  state: UnsafeControlState,
  architectureId?: StentExplorerArchitectureId,
): StentMechanicsModifiers {
  const normalizedState = normalizeStentExplorerControlState(station, state, architectureId)
  const modifiers = createEmptyModifiers()

  for (const control of station.controls) {
    if (!controlSupportsArchitecture(control, architectureId)) continue
    const value = normalizedState[control.id]

    if (control.kind === 'range') {
      const rangeValue = typeof value === 'number' ? value : control.defaultValue
      const normalizedRange = (rangeValue - control.min) / (control.max - control.min)
      for (const binding of control.modifiers) {
        applyModifier(
          modifiers,
          binding.id,
          (binding.baseline ?? 0) + normalizedRange * (binding.scale ?? 1),
        )
      }
      continue
    }

    if (control.kind === 'toggle') {
      const isEnabled = typeof value === 'boolean' ? value : control.defaultValue
      for (const binding of control.modifiers) {
        applyModifier(
          modifiers,
          binding.id,
          isEnabled ? (binding.baseline ?? 0) + (binding.scale ?? 1) : 0,
        )
      }
      continue
    }

    const selectedOption = control.options.find(
      (option) =>
        option.id === value &&
        (!architectureId ||
          !option.architectureIds ||
          option.architectureIds.includes(architectureId)),
    )
    for (const [modifierId, modifierValue] of Object.entries(selectedOption?.modifiers ?? {})) {
      if (modifierValue === undefined) continue
      applyModifier(modifiers, modifierId as StentMechanicsModifierId, modifierValue)
    }
  }

  return Object.freeze(modifiers)
}

export function getStentExplorerControlValueLabel(control: StentExplorerControl, value: unknown) {
  const normalizedValue = normalizeControlValue(control, value)

  if (control.kind === 'toggle') {
    return normalizedValue ? control.onLabel : control.offLabel
  }

  if (control.kind === 'preset') {
    return (
      control.options.find((option) => option.id === normalizedValue)?.label ??
      control.options.find((option) => option.id === control.defaultValue)?.label ??
      control.defaultValue
    )
  }

  const numericValue = typeof normalizedValue === 'number' ? normalizedValue : control.defaultValue
  return [...control.valueLabels].sort(
    (left, right) => Math.abs(left.value - numericValue) - Math.abs(right.value - numericValue),
  )[0].label
}
