import { createInvenioDemoDocument } from '@/features/socrates-builder/content/invenio-demo-document'
import { upgradeSocratesDocument } from '@/features/socrates-builder/schema'
import type { StudyAttempt, SurveyItem } from '../model'
export function caseFixture() {
  const doc = upgradeSocratesDocument(createInvenioDemoDocument())
  doc.revision = 1
  doc.title = 'ANSWER_IN_TITLE'
  doc.slug = 'synthetic-case'
  Object.assign(doc.caseContent, {
    diagnosticCategory: 'Synthetic category',
    trainingEligible: true,
    testingEligible: true,
    vignette: 'Synthetic case context',
    lowMagnificationObservations: ['LOW_OBSERVATION'],
    highMagnificationObservations: ['HIGH_OBSERVATION'],
    keyLearningPoints: ['LEARNING_POINT'],
    adequacy: { designation: 'ADEQUACY_KEY', reasoning: 'ADEQUACY_REASON' },
    cancer: { designation: 'CANCER_KEY', reasoning: 'CANCER_REASON' },
    preliminaryDiagnosis: { designation: 'DIAGNOSIS_KEY', reasoning: 'DIAGNOSIS_REASON' },
    annotationLegend: {
      reviewed: true,
      entries: [
        { label: 'Synthetic swatch', color: '#808080', explanation: 'Synthetic visual only' },
      ],
    },
  })
  doc.authorContent = {
    internalHighlightNotes: 'PRIVATE_HIGHLIGHT',
    provenanceNotes: 'PRIVATE_PROVENANCE',
    readiness: {
      contentReview: 'ready',
      deidentificationVerified: true,
      identifiersVerified: true,
      imaging: 'ready',
      secondaryRose: 'not-applicable',
      technicalHold: false,
      holdReason: 'PRIVATE_READINESS',
    },
  }
  doc.annotations[0].placeholderNote = 'PRIVATE_REGION_NOTE'
  doc.annotations[0].explanation = 'REGION_EXPLANATION'
  return doc
}
export const survey: SurveyItem[] = (['adequacy', 'cancer', 'confidence'] as const).map((id) => ({
  id,
  prompt: `Synthetic ${id}`,
  required: true,
  options: ['Option A', 'Option B'],
}))
export function attemptFixture(): StudyAttempt {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    user_id: '10000000-0000-4000-8000-000000000001',
    study_id: '30000000-0000-4000-8000-000000000001',
    study_version: 'synthetic-1',
    round_key: 'round-1',
    case_id: caseFixture().recordId!,
    case_revision: 1,
    case_order: 1,
    started_at: '2026-09-22T12:00:00Z',
    submitted_at: null,
    elapsed_ms: null,
    responses: {},
    confidence: null,
    response_complete: false,
    missing_items: [],
  }
}
