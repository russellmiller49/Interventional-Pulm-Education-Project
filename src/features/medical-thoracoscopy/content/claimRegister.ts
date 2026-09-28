import { z } from 'zod'

import rawRegister from './data/claim-register.json'
import {
  claimCategorySchema,
  isAccepted,
  reviewDecisionSchema,
  statusWordSchema,
} from './reviewRecords'
import { KNOWN_SOURCE_IDS } from './sources'

/**
 * The claim register. Every statement the course teaches and every rule the simulation follows
 * is a claim: an exact assertion, its category, where it is supported, where it is shown, and
 * the decision of a named reviewer.
 *
 * Two rules in the rest of the module rest on it:
 *
 * - A clinical consequence is modelled only from a claim a reviewer has accepted. Until then the
 *   simulation says the consequence is not modeled.
 * - A relationship a lesson cannot exist without may be shown before review only when its entry
 *   says so, and then only under the label the entry gives.
 */
export const REVIEW_LANES = ['clinical', 'manufacturer', 'rights'] as const

export type ReviewLane = (typeof REVIEW_LANES)[number]

const claimSourceSchema = z
  .object({
    source: z.string().min(1),
    /** Where in the source: a page, a section, a recommendation number, a table. */
    locator: z.string().min(1),
    /** How much of the source was read to find it. */
    read: z.enum(['abstract', 'full text']),
    /** What the source supports, which may be narrower than the assertion. */
    supports: z.string().min(1),
  })
  .strict()

const surfaceSchema = z
  .object({
    kind: z.enum(['section', 'practice', 'case', 'prototype', 'asset', 'reference']),
    id: z.string().min(1),
    state: z.enum(['planned', 'written']),
  })
  .strict()

const claimSchema = z
  .object({
    id: z.string().regex(/^MT-C-\d{4}$/),
    revision: z.number().int().positive(),
    category: claimCategorySchema,
    lane: z.enum(REVIEW_LANES),
    assertion: z.string().min(1),
    context: z.string().min(1),
    sources: z.array(claimSourceSchema),
    sourceNote: z.string().min(1).optional(),
    surfaces: z.array(surfaceSchema).min(1),
    dependentRules: z.array(z.string().min(1)),
    limitations: z.string().min(1),
    status: statusWordSchema,
    shownBeforeReview: z
      .object({
        allowed: z.boolean(),
        learnerLabel: z.string().min(1),
        basis: z.string().min(1),
      })
      .strict(),
    blocksPublication: z.boolean(),
    decision: reviewDecisionSchema,
  })
  .strict()
  .superRefine((claim, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${claim.id}: ${message}` })

    if (claim.category === 'device fact') {
      issue('device facts are held in the device definitions')
    }
    if (claim.category === 'clinical evidence' && claim.sources.length === 0) {
      issue('clinical evidence names its source and locator')
    }
    if (claim.sources.length === 0 && !claim.sourceNote) {
      issue('a claim with no source says so')
    }
    if (claim.category === 'clinical evidence' && claim.shownBeforeReview.allowed) {
      issue('clinical evidence is not shown as fact before review')
    }

    const accepted = isAccepted(claim.decision)
    if (claim.status === 'accepted with attributable approval' && !accepted) {
      issue('accepted needs a recorded decision')
    }
    if (accepted && claim.status !== 'accepted with attributable approval') {
      issue('a recorded acceptance changes the status')
    }
    if (!accepted && !claim.blocksPublication) {
      issue('a claim that is not accepted blocks publication')
    }
    for (const source of claim.sources) {
      if (!KNOWN_SOURCE_IDS.has(source.source)) issue(`unknown source ${source.source}`)
    }
  })

export const claimRegisterSchema = z
  .object({
    register: z.literal('medical-thoracoscopy-claims'),
    version: z.number().int().positive(),
    preparedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    preparedBy: z.string().min(1),
    statement: z.string().min(1),
    idPattern: z.literal('MT-C-0000'),
    claims: z.array(claimSchema),
  })
  .strict()
  .superRefine((register, context) => {
    const ids = register.claims.map((claim) => claim.id)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'claim ids are unique' })
    }
  })

export type ClaimRegister = z.infer<typeof claimRegisterSchema>
export type Claim = ClaimRegister['claims'][number]

export const claimRegister: ClaimRegister = claimRegisterSchema.parse(rawRegister)

export const claims: readonly Claim[] = claimRegister.claims

export function claimById(id: string): Claim {
  const claim = claims.find((entry) => entry.id === id)
  if (!claim) throw new Error(`Unknown claim: ${id}`)
  return claim
}

export type ClaimStanding =
  /** A named reviewer accepted it. It may be taught and modelled as written. */
  | { readonly kind: 'accepted' }
  /** Not accepted, and its entry allows it to be shown under a label. */
  | { readonly kind: 'shown-with-label'; readonly learnerLabel: string }
  /** Not accepted and not allowed before review. The simulation says it is not modeled. */
  | { readonly kind: 'not-modeled' }

/** What the course may do with a claim right now. */
export function claimStanding(claim: Claim): ClaimStanding {
  if (isAccepted(claim.decision)) return { kind: 'accepted' }
  if (claim.decision.decision === 'rejected' || claim.decision.decision === 'held') {
    return { kind: 'not-modeled' }
  }
  if (claim.shownBeforeReview.allowed) {
    return { kind: 'shown-with-label', learnerLabel: claim.shownBeforeReview.learnerLabel }
  }
  return { kind: 'not-modeled' }
}

/** Claims that stop the module being published as it stands. */
export function claimsBlockingPublication(register: ClaimRegister = claimRegister): Claim[] {
  return register.claims.filter((claim) => claim.blocksPublication)
}
