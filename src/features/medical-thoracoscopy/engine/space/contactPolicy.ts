import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../../content/pleuralZones'
import type { ContactRuleFn } from './spatial/spatialWorld'

/**
 * One complete table of contact (plan, section 4.5; fidelity contract, "Contact"): every part of
 * the instrument, against every region, in every phase of the tool, with the jaws open or closed,
 * authorised or not. Only the working element may touch, only with the tool out of the channel, and
 * only a region the scenario has authorised; the lung is never one. Everything else is refused, with
 * the limiting part named; the instrument is never moved for the learner.
 *
 * Each region of the parietal pleura carries its own authorisation (independent review, R8), so a
 * scenario can let the jaws touch one region of the chest wall and not the next. The jaws' state
 * changes the working element's shape, not its permission. These are engineering permissions, a
 * contract the collider enforces; they say nothing about which region is clinically safe to touch,
 * and no scenario here is a biopsy.
 */
export const CONTACT_PARTS = ['sleeve', 'telescope', 'tool-shaft', 'working-element'] as const
export const CONTACT_REGIONS = [...PLEURAL_ZONE_IDS, 'lung', 'teaching-target'] as const
export const TOOL_PHASES = ['no-tool', 'in-channel', 'extended'] as const
export const JAW_STATES = ['closed', 'open'] as const
export const AUTHORISATIONS = ['not-authorised', 'authorised'] as const

export type ContactPart = (typeof CONTACT_PARTS)[number]
export type ContactRegion = (typeof CONTACT_REGIONS)[number]
export type ToolPhase = (typeof TOOL_PHASES)[number]
export type JawState = (typeof JAW_STATES)[number]
export type Authorisation = (typeof AUTHORISATIONS)[number]
export type ContactRule = 'refuse' | 'may-touch'

/** Regions no scenario can authorise: the lung (visceral pleura) is outside this contract. */
export const NEVER_AUTHORISED: readonly ContactRegion[] = ['lung']

/** What a scenario authorises when it says only "authorised": the teaching target (slice 13). */
export const DEFAULT_AUTHORISED_REGIONS: readonly ContactRegion[] = ['teaching-target']

export function contactRule(
  part: ContactPart,
  region: ContactRegion,
  phase: ToolPhase,
  authorisation: Authorisation,
  // the jaws' state changes the working element's shape, not its permission
  jaws: JawState = 'closed',
): ContactRule {
  return part === 'working-element' &&
    JAW_STATES.includes(jaws) &&
    phase === 'extended' &&
    authorisation === 'authorised' &&
    !NEVER_AUTHORISED.includes(region)
    ? 'may-touch'
    : 'refuse'
}

/** The whole table, row by row, so that it can be read and checked complete. */
export const CONTACT_TABLE: readonly {
  readonly part: ContactPart
  readonly region: ContactRegion
  readonly phase: ToolPhase
  readonly jaws: JawState
  readonly authorisation: Authorisation
  readonly rule: ContactRule
}[] = CONTACT_PARTS.flatMap((part) =>
  CONTACT_REGIONS.flatMap((region) =>
    TOOL_PHASES.flatMap((phase) =>
      JAW_STATES.flatMap((jaws) =>
        AUTHORISATIONS.map((authorisation) => ({
          part,
          region,
          phase,
          jaws,
          authorisation,
          rule: contactRule(part, region, phase, authorisation, jaws),
        })),
      ),
    ),
  ),
)

/**
 * The table as the collider asks it, for one phase of the tool and one scenario's authorisation: a
 * part against a region of the wall, the lung or the teaching target. `authorisation` says whether
 * the scenario authorises anything; `regions` says which regions (by default the teaching target
 * alone). Asked about the wall without a region, a part may touch it only if every region allows it.
 */
export function colliderRule(
  phase: ToolPhase,
  authorisation: Authorisation,
  regions: readonly ContactRegion[] = DEFAULT_AUTHORISED_REGIONS,
): ContactRuleFn {
  const of = (region: ContactRegion): Authorisation =>
    authorisation === 'authorised' && regions.includes(region) ? 'authorised' : 'not-authorised'
  const rule = (part: ContactPart, region: ContactRegion) =>
    contactRule(part, region, phase, of(region))
  return (part, obstacle, zone?: PleuralZoneId) => {
    if (obstacle === 'lung') return rule(part, 'lung')
    if (obstacle === 'target') return rule(part, 'teaching-target')
    if (zone) return rule(part, zone)
    return PLEURAL_ZONE_IDS.every((z) => rule(part, z) === 'may-touch') ? 'may-touch' : 'refuse'
  }
}
