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
 * nothing; extended, they are out beyond the tip. The jaws are closed or open (independent review,
 * R8). Open, the working element is taken as the envelope of the two jaws: a wider capsule over the
 * jaws' length, whose radius is the jaws' half-spread at the published opening angle plus a jaw's
 * half-width. An authored, conservative shape for the contact contract, not a model of how jaws
 * grasp anything.
 */
export interface ToolState {
  readonly phase: 'no-tool' | 'in-channel' | 'extended'
  /** How far the jaws' tip is beyond the telescope's tip. */
  readonly extensionMm: number
  /** Closed unless said otherwise; the jaws open only when they are wholly out of the channel. */
  readonly jaws?: 'closed' | 'open'
}

export const TOOL_IN_CHANNEL: ToolState = { phase: 'in-channel', extensionMm: 0, jaws: 'closed' }

/** Authored: the step of the forceps' control, and how far out the model lets them go. */
export const AUTHORED_TOOL_VALUES = { stepMm: 2, reachMm: 40 } as const

export interface Forceps {
  readonly shaftRadiusMm: number
  readonly jawLengthMm: number
  readonly channelOffsetMm: number
  /** The envelope of the open jaws, as a radius about the tool's line. */
  readonly openJawsRadiusMm: number
}

export function forceps(): Forceps {
  const shaftRadiusMm = publishedNumber('double-spoon-forceps', 'shaftOuterDiameter') / 2
  const jawLengthMm = publishedNumber('double-spoon-forceps', 'jawLength')
  const openingDeg = modelledNumber('double-spoon-forceps', 'jawOpeningAngle').value
  return {
    shaftRadiusMm,
    jawLengthMm,
    channelOffsetMm: modelledNumber('operative-telescope', 'channelExitOnTip').value,
    openJawsRadiusMm:
      jawLengthMm * Math.sin(((openingDeg / 2) * Math.PI) / 180) + shaftRadiusMm / 2,
  }
}

export function toolWith(extensionMm: number, jaws: 'closed' | 'open' = 'closed'): ToolState {
  const clamped = Math.max(0, Math.min(AUTHORED_TOOL_VALUES.reachMm, extensionMm))
  return { phase: clamped > 0 ? 'extended' : 'in-channel', extensionMm: clamped, jaws }
}

/** Whether the jaws are wholly out of the channel, and so may open. */
export function jawsOut(tool: ToolState, tools: Forceps): boolean {
  return tool.phase === 'extended' && tool.extensionMm >= tools.jawLengthMm
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
      radius: tool.jaws === 'open' ? tools.openJawsRadiusMm : tools.shaftRadiusMm,
    },
  }
}
