import { modelledNumber, publishedNumber } from '../../content/deviceDefinitions'
import type { ScopeGeometry } from './fulcrum'
import type { Capsule } from './spatial/capsuleQuery'
import { add, scale } from './vec'

/**
 * The forceps in the telescope's working channel (plan, section 4.5, `toolChannel.ts`): the one tool
 * of the contact spike (slice 13). The channel runs parallel to the telescope's axis and leaves the
 * tip `channelExitOnTip` from the axis, on the side away from the optic; its centre there is taken as
 * that offset, an assumption the device definitions do not state outright. Out of the channel, the
 * forceps are two capsules: the shaft, and the closed jaws (the working element) at its end.
 *
 * The phase is the contact table's: in the channel, the forceps are inside the telescope and touch
 * nothing; extended, they are out beyond the tip.
 */
export interface ToolState {
  readonly phase: 'no-tool' | 'in-channel' | 'extended'
  /** How far the jaws' tip is beyond the telescope's tip. */
  readonly extensionMm: number
}

export const TOOL_IN_CHANNEL: ToolState = { phase: 'in-channel', extensionMm: 0 }

/** Authored: the step of the forceps' control, and how far out the model lets them go. */
export const AUTHORED_TOOL_VALUES = { stepMm: 2, reachMm: 40 } as const

export interface Forceps {
  readonly shaftRadiusMm: number
  readonly jawLengthMm: number
  readonly channelOffsetMm: number
}

export function forceps(): Forceps {
  return {
    shaftRadiusMm: publishedNumber('double-spoon-forceps', 'shaftOuterDiameter') / 2,
    jawLengthMm: publishedNumber('double-spoon-forceps', 'jawLength'),
    channelOffsetMm: modelledNumber('operative-telescope', 'channelExitOnTip').value,
  }
}

export function toolWith(extensionMm: number): ToolState {
  const clamped = Math.max(0, Math.min(AUTHORED_TOOL_VALUES.reachMm, extensionMm))
  return { phase: clamped > 0 ? 'extended' : 'in-channel', extensionMm: clamped }
}

/** The forceps' capsules beyond the telescope's tip: none while they are in the channel. */
export function toolCapsules(
  geometry: Pick<ScopeGeometry, 'axis' | 'tip' | 'camera'>,
  tool: ToolState,
  tools: Forceps,
): { readonly shaft: Capsule | null; readonly workingElement: Capsule | null } {
  if (tool.phase !== 'extended' || tool.extensionMm <= 0)
    return { shaft: null, workingElement: null }
  // the channel's exit on the tip, on the side away from the optic
  const exit = add(geometry.tip, scale(geometry.camera.up, -tools.channelOffsetMm))
  const along = (distance: number) => add(exit, scale(geometry.axis, distance))
  const jawBase = Math.max(0, tool.extensionMm - tools.jawLengthMm)
  return {
    shaft: jawBase > 0 ? { start: exit, end: along(jawBase), radius: tools.shaftRadiusMm } : null,
    workingElement: {
      start: along(jawBase),
      end: along(tool.extensionMm),
      radius: tools.shaftRadiusMm,
    },
  }
}
