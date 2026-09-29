import { PLEURAL_ZONE_IDS } from '../../content/pleuralZones'
import type { ContactRuleFn } from './spatial/spatialWorld'

/**
 * One complete table of contact (plan, section 4.5; fidelity contract, "Contact"): every part of
 * the instrument, against every region, in every phase of the tool, authorised or not. Only the
 * working element may touch, and only an authorised teaching target, with the tool out of the
 * channel. Everything else is refused, with the limiting part named; the instrument is never moved
 * for the learner. These are engineering permissions, not statements about clinical safety.
 */
export const CONTACT_PARTS = ['sleeve', 'telescope', 'tool-shaft', 'working-element'] as const
export const CONTACT_REGIONS = [...PLEURAL_ZONE_IDS, 'lung', 'teaching-target'] as const
export const TOOL_PHASES = ['no-tool', 'in-channel', 'extended'] as const
export const AUTHORISATIONS = ['not-authorised', 'authorised'] as const

export type ContactPart = (typeof CONTACT_PARTS)[number]
export type ContactRegion = (typeof CONTACT_REGIONS)[number]
export type ToolPhase = (typeof TOOL_PHASES)[number]
export type Authorisation = (typeof AUTHORISATIONS)[number]
export type ContactRule = 'refuse' | 'may-touch'

export function contactRule(
  part: ContactPart,
  region: ContactRegion,
  phase: ToolPhase,
  authorisation: Authorisation,
): ContactRule {
  return part === 'working-element' &&
    region === 'teaching-target' &&
    phase === 'extended' &&
    authorisation === 'authorised'
    ? 'may-touch'
    : 'refuse'
}

/** The whole table, row by row, so that it can be read and checked complete. */
export const CONTACT_TABLE: readonly {
  readonly part: ContactPart
  readonly region: ContactRegion
  readonly phase: ToolPhase
  readonly authorisation: Authorisation
  readonly rule: ContactRule
}[] = CONTACT_PARTS.flatMap((part) =>
  CONTACT_REGIONS.flatMap((region) =>
    TOOL_PHASES.flatMap((phase) =>
      AUTHORISATIONS.map((authorisation) => ({
        part,
        region,
        phase,
        authorisation,
        rule: contactRule(part, region, phase, authorisation),
      })),
    ),
  ),
)

/**
 * The table as the collider asks it, for one phase of the tool and one authorisation: a part against
 * the wall, the lung or the teaching target. The wall is every region of the parietal pleura at once,
 * so a part may touch it only if every region allows it.
 */
export function colliderRule(phase: ToolPhase, authorisation: Authorisation): ContactRuleFn {
  return (part, obstacle) => {
    if (obstacle === 'lung') return contactRule(part, 'lung', phase, authorisation)
    if (obstacle === 'target') return contactRule(part, 'teaching-target', phase, authorisation)
    return PLEURAL_ZONE_IDS.every(
      (zone) => contactRule(part, zone, phase, authorisation) === 'may-touch',
    )
      ? 'may-touch'
      : 'refuse'
  }
}
