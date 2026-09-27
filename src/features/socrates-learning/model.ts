import { z } from 'zod'
import { socratesSlideDocumentSchema } from '@/features/socrates-builder/schema'
import { narrativeSections } from '@/features/socrates-builder/learner-narrative'
import type { SocratesCaseDocument, SocratesSlideDocument } from '@/features/socrates-builder/types'

export type LearningMode = 'teaching' | 'testing'
export const COLLECTION_KEY = 'socrates-curriculum-preview:v1'
export const PROGRESS_KEY = 'socrates-curriculum-progress:v1'
export const collectionSchema = z
  .object({
    format: z.literal('socrates-local-curriculum-v1'),
    title: z.string().min(1).max(160),
    documents: z.array(socratesSlideDocumentSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>()
    for (const doc of value.documents) {
      if (
        doc.schemaVersion !== 2 ||
        !doc.caseContent ||
        !doc.authorContent ||
        doc.workflowStatus !== 'draft' ||
        doc.recordId ||
        doc.revision !== 0 ||
        doc.publishedAt ||
        doc.caseContent.trainingEligible ||
        doc.caseContent.testingEligible ||
        ids.has(doc.slug)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Import unique local draft previews with no saved database identity or eligibility.',
        })
      }
      ids.add(doc.slug)
    }
  })
export type LearningCollection = z.infer<typeof collectionSchema>
export function learningDocuments(documents: SocratesSlideDocument[]): SocratesCaseDocument[] {
  return documents
    .filter(
      (d): d is SocratesCaseDocument =>
        d.schemaVersion === 2 && Boolean(d.caseContent && d.authorContent),
    )
    .sort((a, b) => order(a) - order(b) || a.slug.localeCompare(b.slug))
}
export function order(document: SocratesCaseDocument) {
  return (
    document.authorContent.curriculumSource?.sourceValues['Overall Order'] ??
    document.caseContent.sortOrder
  )
}
export function caseKey(document: SocratesCaseDocument) {
  return document.recordId ?? document.slug
}
export function signature(document: SocratesCaseDocument) {
  // Exact content comparison invalidates local progress when a draft changes.
  return JSON.stringify([document.caseContent, document.slide, document.annotations])
}
export function moduleName(document: SocratesCaseDocument) {
  return document.authorContent.curriculumSource?.sourceValues.Module ?? 'Slide collection'
}
export function teachingTitle(document: SocratesCaseDocument) {
  const source = document.authorContent.curriculumSource?.sourceValues['Full Case Name']
  return /^Slide \d+$/.test(document.title)
    ? source?.split(' · ').slice(2).join(' · ') || document.title
    : document.title
}

export interface TeachingSection {
  id: string
  title: string
  text: string
}
export function teachingSections(document: SocratesCaseDocument): TeachingSection[] {
  const context = document.caseContent.vignette.trim()
  return [
    ...(context ? [{ id: 'context', title: 'Case context', text: context }] : []),
    ...teachingObservations(document),
  ]
}
function teachingObservations(document: SocratesCaseDocument): TeachingSection[] {
  const content = document.caseContent
  if (content.learnerNarrative) {
    const sections = narrativeSections(content.learnerNarrative)
    // Only partition explicitly labeled source text. Never infer missing observations.
    if (!sections.length || !/^What to notice\r?\n/.test(content.learnerNarrative))
      return [{ id: 'narrative', title: 'Teaching explanation', text: content.learnerNarrative }]
    return sections.flatMap((section, index) => {
      const match =
        section.heading === 'What to notice' &&
        section.body.match(
          /^\s*At low magnification:([\s\S]*?)\r?\nAt high magnification:([\s\S]*)$/,
        )
      return match
        ? [
            { id: 'low', title: 'Low magnification', text: match[1].trim() },
            { id: 'high', title: 'High magnification', text: match[2].trim() },
          ]
        : [{ id: `section-${index}`, title: section.heading, text: section.body.trim() }]
    })
  }
  return [
    {
      id: 'low',
      title: 'Low magnification',
      text: content.lowMagnificationObservations.filter(Boolean).join('\n\n'),
    },
    {
      id: 'high',
      title: 'High magnification',
      text: content.highMagnificationObservations.filter(Boolean).join('\n\n'),
    },
    {
      id: 'key',
      title: 'Key learning points',
      text: content.keyLearningPoints.filter(Boolean).join('\n\n'),
    },
    {
      id: 'interpretation',
      title: 'Teaching interpretation',
      text: [
        content.adequacy.designation &&
          `Adequacy: ${content.adequacy.designation}. ${content.adequacy.reasoning}`,
        content.cancer.designation &&
          `Cancer vs non-cancer: ${content.cancer.designation}. ${content.cancer.reasoning}`,
        content.preliminaryDiagnosis?.designation &&
          `Preliminary diagnosis: ${content.preliminaryDiagnosis.designation}. ${content.preliminaryDiagnosis.reasoning}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ].filter((s) => s.text)
}
export const answerSchema = z
  .object({
    adequacy: z.enum(['Adequate', 'Not adequate', 'Uncertain']),
    cancer: z.enum(['Cancer', 'Non-cancer', 'Uncertain']),
    confidence: z.enum(['Low', 'Moderate', 'High']),
    reasoning: z.string().max(4000),
  })
  .strict()
export type Answers = z.infer<typeof answerSchema>
export const progressSchema = z.record(
  z.object({
    signature: z.string(),
    teachingStep: z.number().int().nonnegative().default(0),
    teachingViewed: z.boolean().default(false),
    teachingComplete: z.boolean().default(false),
    draft: answerSchema.partial().default({}),
    submission: z
      .object({ answers: answerSchema, submittedAt: z.string(), teachingSeen: z.boolean() })
      .optional(),
  }),
)
export type LearningProgress = z.infer<typeof progressSchema>
export type CaseProgress = LearningProgress[string]
export function currentProgress(
  document: SocratesCaseDocument,
  progress: LearningProgress,
): CaseProgress {
  const saved = progress[caseKey(document)]
  return saved?.signature === signature(document)
    ? saved
    : {
        signature: signature(document),
        teachingStep: 0,
        teachingViewed: false,
        teachingComplete: false,
        draft: {},
      }
}
