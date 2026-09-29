import { claimRegister } from '../../content/claimRegister'

/**
 * What the model may show as a consequence (plan, section 4.5). A clinical consequence can be
 * modelled only from a claim with an accepted decision; at this stage none has one, so everything is
 * "not modelled" or a stated limit of the model, except the one relationship the survey cannot exist
 * without: with air in the space, the lung falls away (MT-C-0001, MT-C-0002). That one is authored,
 * shown labelled as awaiting clinical review, and blocks publication until it is reviewed.
 */
export type OutcomeStanding =
  | { readonly kind: 'not-modelled' }
  | {
      readonly kind: 'authored-awaiting-review'
      readonly claims: readonly string[]
      readonly label: string
      readonly blocksPublication: true
    }

export const OUTCOME_EVENTS = [
  'lung-falls-away',
  'lung-re-expands',
  'tissue-touched',
  'bleeding',
  'air-leak',
] as const
export type OutcomeEvent = (typeof OUTCOME_EVENTS)[number]

const AUTHORED: Partial<Record<OutcomeEvent, readonly string[]>> = {
  'lung-falls-away': ['MT-C-0001', 'MT-C-0002'],
}

export function outcomeStanding(event: OutcomeEvent): OutcomeStanding {
  const claims = AUTHORED[event]
  if (!claims) return { kind: 'not-modelled' }
  const entries = claims.map((id) => claimRegister.claims.find((claim) => claim.id === id))
  if (entries.some((entry) => !entry || !entry.blocksPublication)) {
    throw new Error(`${event}: its claims must exist and block publication until reviewed`)
  }
  return {
    kind: 'authored-awaiting-review',
    claims,
    label: 'Authored, illustrative',
    blocksPublication: true,
  }
}
