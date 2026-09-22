import { z } from 'zod'

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
    lowMagnificationObservations: z.array(text).max(40),
    highMagnificationObservations: z.array(text).max(40),
    keyLearningPoints: z.array(text).max(40),
    adequacy: designation,
    cancer: designation,
    preliminaryDiagnosis: designation.nullable(),
    annotationLegend: annotationLegendSchema,
  })
  .strict()
const readinessStatus = z.enum(['incomplete', 'ready', 'hold'])
export const authorContentSchema = z
  .object({
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
