import type { EcmoChannelReadout } from '../engine'

/**
 * One place that decides how a channel readout becomes text.
 *
 * The console, the circuit pressure-zone map, the workbench signal list and the teaching panels all
 * show the same four pressure channels. Before this existed each surface formatted them itself, and
 * the ones that reached for `circuit.pVen` instead of `circuit.readouts.pVen` printed the model's
 * zero-flow intercept as though the device had measured it. Routing every surface through these
 * helpers is what makes the console/circuit-map parity test meaningful rather than a coincidence.
 *
 * Visual treatment still belongs to each surface — only the value text, the unavailable convention
 * and the spoken explanation are shared.
 */

/**
 * The unavailable indication.
 *
 * The IFU's convention is that a measured value which is unavailable, unsupported, or outside the
 * documented display range shows as dashes rather than as a number (Rev 2.3 §3, page 47).
 */
export const UNAVAILABLE_INDICATION = '--'

export interface FormattedChannelReadout {
  /** Whether a number may be shown at all. */
  readonly available: boolean
  /** The number, or the unavailable indication. Never a clamped stand-in for a real value. */
  readonly valueText: string
  /** Suppressed when no number is shown, so a bare unit never reads as a measurement. */
  readonly unitText: string
  /** `valueText` and `unitText` joined the way a sighted learner reads them. */
  readonly displayText: string
  /**
   * What a screen reader announces. When a number is absent this carries the reason, which states
   * whether the model has nothing to offer or the device itself would not show a value — two
   * different claims that must not collapse into one "unavailable".
   */
  readonly screenReaderText: string
  /** Mirrored onto `data-readout-status` so tests and styling can see the provenance. */
  readonly status: EcmoChannelReadout['status']
}

export function formatChannelReadout(
  label: string,
  readout: EcmoChannelReadout,
  unit: string,
  precision = 0,
  /** Appended to the spoken text when a value is present, for channels that need a caveat. */
  description?: string,
): FormattedChannelReadout {
  const available = readout.displayed !== null
  if (!available) {
    return {
      available: false,
      valueText: UNAVAILABLE_INDICATION,
      unitText: '',
      displayText: UNAVAILABLE_INDICATION,
      screenReaderText: `${label} not available. ${readout.reason}`,
      status: readout.status,
    }
  }
  const valueText = readout.displayed!.toFixed(precision)
  return {
    available: true,
    valueText,
    unitText: unit,
    displayText: unit ? `${valueText} ${unit}` : valueText,
    screenReaderText: `${label} ${valueText}${unit ? ` ${unit}` : ''}.${
      description ? ` ${description}` : ''
    }`,
    status: readout.status,
  }
}

/**
 * Several channels on one line, for compact summaries that show them together.
 *
 * Any channel that cannot be shown collapses to the unavailable indication, and the reasons are
 * appended once each — a row reading `-- / -- / -- mm Hg` with no explanation would leave the
 * learner to guess whether the device failed, the sensor is off, or the model has nothing to say.
 */
export function formatChannelGroup(
  readouts: readonly EcmoChannelReadout[],
  unit: string,
  precision = 0,
): { readonly text: string; readonly allAvailable: boolean } {
  const values = readouts.map((readout) =>
    readout.displayed === null ? UNAVAILABLE_INDICATION : readout.displayed.toFixed(precision),
  )
  const reasons = [
    ...new Set(
      readouts.filter((readout) => readout.displayed === null).map((readout) => readout.reason),
    ),
  ]
  const joined = `${values.join(' / ')}${unit ? ` ${unit}` : ''}`
  return {
    text: reasons.length ? `${joined} · ${reasons.join(' ')}` : joined,
    allAvailable: reasons.length === 0,
  }
}

/**
 * Whether a channel may be compared, trended, or described with a direction word.
 *
 * A direction is an interpretation, so it needs a value that means something. "The gradient is
 * higher than its reference" computed from a stopped circuit's intercept is a fabricated claim even
 * though no number is printed beside it.
 */
export function isInterpretable(readout: EcmoChannelReadout): boolean {
  return readout.displayed !== null
}
