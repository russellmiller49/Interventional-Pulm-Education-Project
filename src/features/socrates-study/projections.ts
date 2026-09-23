import type { SocratesCaseDocument } from '@/features/socrates-builder/types'
import type { DeepZoomSlide, DemoAnnotation } from '@/features/socrates-demo/types'
import {
  annotationLegendIssues,
  type AnnotationLegend,
} from '@/features/socrates-builder/case-content'
import type { StudyAttempt, SurveyItem, TrainingProgress } from './model'

export interface CatalogCase {
  id: string
  slug: string
  title: string
  diagnosticCategory: string
  subcategory: string
  sortOrder: number
  revision: number
}
export interface TeachingContent {
  learnerNarrative?: string
  lowMagnificationObservations: string[]
  highMagnificationObservations: string[]
  keyLearningPoints: string[]
  adequacy: { designation: string; reasoning: string }
  cancer: { designation: string; reasoning: string }
  preliminaryDiagnosis: { designation: string; reasoning: string } | null
}
export interface TrainingCase extends CatalogCase {
  vignette: string
  slide: DeepZoomSlide
  legend: AnnotationLegend
  progress: TrainingProgress | null
}
export interface TrainingReveal {
  legend: AnnotationLegend
  teaching: TeachingContent
  annotations: DemoAnnotation[]
}
export interface TestCase {
  title: string
  slide: DeepZoomSlide
  legend: AnnotationLegend | null
  survey: SurveyItem[]
  attempt: StudyAttempt
  feedback: TeachingContent | null
}
export function reviewedLegend(legend: AnnotationLegend): AnnotationLegend {
  return legend.reviewed && !annotationLegendIssues(legend).length
    ? {
        reviewed: true,
        entries: legend.entries.map((e) => ({
          label: e.label,
          color: e.color,
          explanation: e.explanation,
        })),
      }
    : { reviewed: false, entries: [] }
}
export function catalogProjection(document: SocratesCaseDocument): CatalogCase {
  const c = document.caseContent
  return {
    id: document.recordId!,
    slug: document.slug,
    title: document.title,
    diagnosticCategory: c.diagnosticCategory || 'Uncategorized',
    subcategory: c.subcategory,
    sortOrder: c.sortOrder,
    revision: document.revision,
  }
}
/** No source identifiers, attribution text, diagnostic titles or arbitrary author metadata. */
function safeSlide(
  document: SocratesCaseDocument,
  imagePath: string,
  showColor: boolean,
): DeepZoomSlide {
  return {
    id: document.recordId!,
    descriptorUrl: `${imagePath}/tissue/slide.dzi`,
    ...(showColor ? { comparisonDescriptorUrl: `${imagePath}/color/slide.dzi` } : {}),
    expectedDimensions: {
      width: document.slide.expectedDimensions.width,
      height: document.slide.expectedDimensions.height,
    },
    initialImageRect: { ...document.slide.initialImageRect },
    attribution: { label: 'Invenio Imaging', href: 'https://www.invenioimaging.com/' },
    contentStatus: 'Education and research only. Not for clinical diagnosis.',
  }
}
export function teachingProjection(document: SocratesCaseDocument): TeachingContent {
  const c = document.caseContent
  const result = (d: typeof c.adequacy) => ({ designation: d.designation, reasoning: d.reasoning })
  return {
    ...(c.learnerNarrative !== undefined ? { learnerNarrative: c.learnerNarrative } : {}),
    lowMagnificationObservations: [...c.lowMagnificationObservations],
    highMagnificationObservations: [...c.highMagnificationObservations],
    keyLearningPoints: [...c.keyLearningPoints],
    adequacy: result(c.adequacy),
    cancer: result(c.cancer),
    preliminaryDiagnosis: c.preliminaryDiagnosis ? result(c.preliminaryDiagnosis) : null,
  }
}
export function trainingProjection(
  document: SocratesCaseDocument,
  paired: boolean,
  progress: TrainingProgress | null,
): TrainingCase {
  return {
    ...catalogProjection(document),
    vignette: document.caseContent.vignette,
    slide: safeSlide(
      document,
      `/api/socrates/images/training/${document.recordId}/${document.revision}`,
      paired,
    ),
    legend: { reviewed: false, entries: [] },
    progress,
  }
}
export function revealProjection(document: SocratesCaseDocument): TrainingReveal {
  return {
    legend: reviewedLegend(document.caseContent.annotationLegend),
    teaching: teachingProjection(document),
    annotations: document.annotations.map((a) => ({
      id: a.id,
      ...(a.parentId ? { parentId: a.parentId } : {}),
      label: a.label,
      polygon: a.polygon.map((p) => ({ x: p.x, y: p.y })) as unknown as DemoAnnotation['polygon'],
      style: a.style,
      enterZoomRatio: a.enterZoomRatio,
      exitZoomRatio: a.exitZoomRatio,
      summary: a.summary,
      explanation: a.explanation,
      placeholderNote: '',
      sortOrder: a.sortOrder,
    })),
  }
}
export function testProjection(
  document: SocratesCaseDocument,
  attempt: StudyAttempt,
  round: {
    showLegend: boolean
    showColorImage: boolean
    feedbackAfterSubmission: boolean
    survey: SurveyItem[]
  },
  paired: boolean,
): TestCase {
  return {
    title: `Case ${attempt.case_order}`,
    slide: safeSlide(
      document,
      `/api/socrates/images/testing/${attempt.id}/0`,
      paired && round.showColorImage,
    ),
    legend: round.showLegend ? reviewedLegend(document.caseContent.annotationLegend) : null,
    survey: round.survey.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      required: item.required,
      options: [...item.options],
    })),
    attempt: {
      id: attempt.id,
      user_id: attempt.user_id,
      study_id: attempt.study_id,
      study_version: attempt.study_version,
      round_key: attempt.round_key,
      case_id: attempt.case_id,
      case_revision: attempt.case_revision,
      case_order: attempt.case_order,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      elapsed_ms: attempt.elapsed_ms,
      responses: Object.fromEntries(
        round.survey.flatMap((item) =>
          typeof attempt.responses[item.id] === 'string'
            ? [[item.id, attempt.responses[item.id]]]
            : [],
        ),
      ),
      confidence: attempt.confidence,
      response_complete: attempt.response_complete,
      missing_items: [...attempt.missing_items],
    },
    feedback:
      attempt.submitted_at && round.feedbackAfterSubmission ? teachingProjection(document) : null,
  }
}
export function groupCatalog(cases: CatalogCase[]) {
  const groups = new Map<string, CatalogCase[]>()
  for (const entry of [...cases].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  )) {
    const group = groups.get(entry.diagnosticCategory) ?? []
    group.push(entry)
    groups.set(entry.diagnosticCategory, group)
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
}
