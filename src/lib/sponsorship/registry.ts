import { z } from 'zod'

/**
 * The site's sponsored modules, and what learners are told about each.
 *
 * The rules are in `docs/sponsorship/POLICY.md`, a draft the owner has not yet adopted. Two of
 * them are enforced here and in `policy.ts`: the wording of a disclosure is the owner's, and
 * nothing is shown to a learner until the owner has approved it, by name and date. Until then a
 * module is sponsored in this record and silent on the page.
 *
 * The repository is public. Contract terms, contact names and correspondence are kept in the
 * owner's local data, never here.
 */
const isoDate = /^\d{4}-\d{2}-\d{2}$/

/** A person approves wording. These names are refused wherever an approver is recorded. */
export const NOT_A_PERSON = /claude|codex|gpt|gemini|copilot|\bai\b|assistant|\bllm\b|\bbot\b/i

const disclosureSchema = z
  .object({
    /** The words shown to learners, exactly. Null until the owner writes and approves them. */
    wording: z.string().min(1).nullable(),
    approvedBy: z.string().min(1).nullable(),
    approvedOn: z.string().regex(isoDate).nullable(),
    note: z.string().min(1),
  })
  .strict()

export const sponsorshipSchema = z
  .object({
    moduleId: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
    modulePath: z.string().regex(/^\/[a-z-]+$/),
    sponsor: z.string().min(1),
    /** The sponsor's legal entity, as the agreement names it. Null until the owner records it. */
    legalEntity: z.string().min(1).nullable(),
    /** Who decides what the module teaches. Under the policy this is always the owner. */
    editorialControl: z.literal('owner'),
    /** What the sponsor checks, in the policy's words. It never includes clinical teaching. */
    sponsorReviews: z.array(z.string().min(1)).min(1),
    disclosure: disclosureSchema,
    startedOn: z.string().regex(isoDate).nullable(),
    endedOn: z.string().regex(isoDate).nullable(),
  })
  .strict()
  .superRefine((record, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${record.moduleId}: ${message}` })
    const { wording, approvedBy, approvedOn } = record.disclosure
    const recorded = [approvedBy, approvedOn]

    if (wording === null) {
      if (recorded.some((value) => value !== null)) {
        issue('nothing can be approved before there is wording')
      }
      return
    }
    if (recorded.some((value) => value === null)) {
      issue('wording is shown only once the owner has approved it, by name and date')
    }
    if (approvedBy !== null && NOT_A_PERSON.test(approvedBy)) {
      issue('wording is approved by a person')
    }
    if (!wording.includes(record.sponsor)) issue('the disclosure names the sponsor')
    if (!/editorial/i.test(wording)) issue('the disclosure says who keeps editorial control')
    for (const reviewed of record.sponsorReviews) {
      if (/clinical/i.test(reviewed) && !/not/i.test(reviewed)) {
        issue('a sponsor does not review clinical teaching')
      }
    }
  })

export type Sponsorship = z.infer<typeof sponsorshipSchema>

export const sponsorships: readonly Sponsorship[] = z.array(sponsorshipSchema).parse([
  {
    moduleId: 'medical-thoracoscopy',
    modulePath: '/medical-thoracoscopy',
    sponsor: 'Richard Wolf',
    legalEntity: null,
    editorialControl: 'owner',
    sponsorReviews: [
      'Device descriptions, dimensions and part numbers',
      'Which products are available in which market',
      'How its trademarks are written',
      'Whether a depiction of its product is accurate',
    ],
    disclosure: {
      wording: null,
      approvedBy: null,
      approvedOn: null,
      note: 'The owner has not yet written or approved the disclosure. Until the owner does, nothing is shown.',
    },
    startedOn: null,
    endedOn: null,
  },
])
