import { z } from 'zod'
import { narrativeTeaching } from './learner-narrative'
import { curriculumSourceSchema } from './curriculum-source'

const text = z.string().max(8000)
const designation = z.object({ designation: z.string().max(300), reasoning: text }).strict()
export const annotationLegendSchema = z
  .object({
    reviewed: z.boolean(),
    entries: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(120),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            explanation: z.string().max(2000),
          })
          .strict(),
      )
      .max(40),
  })
  .strict()

export const caseContentSchema = z
  .object({
    diagnosticCategory: z.string().max(160),
    subcategory: z.string().max(160),
    sortOrder: z.number().int().nonnegative(),
    trainingEligible: z.boolean(),
    testingEligible: z.boolean(),
    vignette: text,
    learnerNarrative: z.string().min(1).max(32000).optional(),
    lowMagnificationObservations: z.array(text).max(40),
    highMagnificationObservations: z.array(text).max(40),
    keyLearningPoints: z.array(text).max(40),
    adequacy: designation,
    cancer: designation,
    preliminaryDiagnosis: designation.nullable(),
    annotationLegend: annotationLegendSchema,
  })
  .strict()
  .superRefine((content, context) => {
    if (!content.learnerNarrative) return
    const derived = narrativeTeaching(content.learnerNarrative)
    for (const key of Object.keys(derived) as (keyof typeof derived)[]) {
      if (JSON.stringify(content[key]) !== JSON.stringify(derived[key]))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message:
            'Narrative is canonical. Reconcile the conflicting structured teaching field: ' + key,
        })
    }
  })
const readinessStatus = z.enum(['incomplete', 'ready', 'hold'])
export const authorContentSchema = z
  .object({
    curriculumSource: curriculumSourceSchema.optional(),
    internalHighlightNotes: text,
    provenanceNotes: text,
    readiness: z
      .object({
        contentReview: readinessStatus,
        deidentificationVerified: z.boolean(),
        identifiersVerified: z.boolean(),
        imaging: readinessStatus,
        secondaryRose: z.enum(['not-applicable', 'incomplete', 'ready', 'hold']),
        technicalHold: z.boolean(),
        holdReason: text,
      })
      .strict(),
  })
  .strict()
export type CaseContent = z.infer<typeof caseContentSchema>
export type AuthorContent = z.infer<typeof authorContentSchema>
export type AnnotationLegend = z.infer<typeof annotationLegendSchema>

export function emptyCaseContent(): CaseContent {
  return {
    diagnosticCategory: '',
    subcategory: '',
    sortOrder: 0,
    trainingEligible: false,
    testingEligible: false,
    vignette: '',
    lowMagnificationObservations: [],
    highMagnificationObservations: [],
    keyLearningPoints: [],
    adequacy: { designation: '', reasoning: '' },
    cancer: { designation: '', reasoning: '' },
    preliminaryDiagnosis: null,
    annotationLegend: { reviewed: false, entries: [] },
  }
}
export function emptyAuthorContent(): AuthorContent {
  return {
    internalHighlightNotes: '',
    provenanceNotes: '',
    readiness: {
      contentReview: 'incomplete',
      deidentificationVerified: false,
      identifiersVerified: false,
      imaging: 'incomplete',
      secondaryRose: 'incomplete',
      technicalHold: false,
      holdReason: '',
    },
  }
}
export function testingReadinessIssues(content: CaseContent, author: AuthorContent): string[] {
  const r = author.readiness
  return [
    !content.testingEligible && 'Testing eligibility is not enabled.',
    r.contentReview !== 'ready' && 'Content review is not ready.',
    !r.deidentificationVerified && 'De-identification has not been verified.',
    !r.identifiersVerified && 'Image and case label matching has not been verified.',
    r.imaging !== 'ready' && 'Imaging / WSI is not ready.',
    !['ready', 'not-applicable'].includes(r.secondaryRose) && 'Secondary ROSE review is not ready.',
    r.technicalHold && 'A technical hold is active.',
    !content.adequacy.designation.trim() && 'Adequacy designation is missing.',
    !content.adequacy.reasoning.trim() && 'Adequacy reasoning is missing.',
    !content.cancer.designation.trim() && 'Cancer designation is missing.',
    !content.cancer.reasoning.trim() && 'Cancer reasoning is missing.',
  ].filter((issue): issue is string => Boolean(issue))
}

/** A placeholder cannot become a reviewed provider key by checking a box. */
export function annotationLegendIssues(legend: {
  entries: { label: string; color: string; explanation: string }[]
}): string[] {
  if (!legend.entries.length) return ['Add at least one provider-approved key entry.']
  return legend.entries.flatMap((entry, index) =>
    [
      (!entry.label.trim() || /^pending label$/i.test(entry.label.trim())) &&
        `Key ${index + 1}: enter the provider-approved category label.`,
      !/^#[0-9a-fA-F]{6}$/.test(entry.color) &&
        `Key ${index + 1}: use an exact six-digit hex color (#RRGGBB).`,
      !entry.explanation.trim() && `Key ${index + 1}: add the reviewed meaning.`,
    ].filter((issue): issue is string => Boolean(issue)),
  )
}
