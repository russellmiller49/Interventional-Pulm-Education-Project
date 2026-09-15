import { readFileSync } from 'fs'
import path from 'path'

import { ventilationEvidenceById } from '../content/evidence'
import { ventilationQuestionById } from '../content/learningQuestions'
import {
  VENTILATION_QUESTION_TEACHING_VERSION,
  ventilationQuestionTeaching,
  ventilationQuestionTeachingById,
} from '../content/questionTeaching'

interface ReviewerDecision {
  status: string
  reviewer: string | null
  role: string | null
  date: string | null
  reviewedVersion: string | null
}
interface QuestionItem {
  id: string
  unchangedForLegacyRecords: {
    prompt: string
    correctId: string
    choices: { id: string; label: string; unsafe: boolean }[]
  }
  changedWording: { field: string; previous: string | null; current: string | null }[]
  safetyExplanations: { choiceId: string; current: string }[]
  sourceLocators: { evidenceId: string; finding: string }[]
  notChecked: string[]
  unresolvedQuestions: string[]
  reviewerDecision: ReviewerDecision
}
interface SourceItem {
  evidenceId: string
  current: { title: string; citation: string }
  /** Keys into the packet's document list, so each checked file is described once. */
  documentsChecked: string[]
  reviewerDecision: ReviewerDecision
}
interface Packet {
  contentVersion: string
  preparedBy: string
  documents: Record<string, { sha256: string; location: string; printedIdentity: string }>
  questionItems: QuestionItem[]
  sourceIdentityItems: SourceItem[]
}

const packet = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'docs/gap-remediation/self-paced/MV-03-review-packet.json'),
    'utf8',
  ),
) as Packet

function honestDecision(decision: ReviewerDecision) {
  if (decision.status === 'NOT REVIEWED') {
    expect(decision.reviewer).toBeNull()
    expect(decision.role).toBeNull()
    expect(decision.date).toBeNull()
    expect(decision.reviewedVersion).toBeNull()
    return
  }
  expect(decision.reviewer).toBeTruthy()
  expect(decision.reviewer).not.toMatch(/claude|openai|gpt|assistant|\bai\b/i)
  expect(decision.role).toBeTruthy()
  expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(decision.reviewedVersion).toBe(VENTILATION_QUESTION_TEACHING_VERSION)
}

function currentValue(questionId: string, field: string): string | null {
  const teaching = ventilationQuestionTeachingById.get(questionId)!
  const question = ventilationQuestionById.get(questionId)!
  const choice = /^choices\[(\d+)\]\.(rationale|safety)$/.exec(field)
  if (choice)
    return question.choices[Number(choice[1])][choice[2] as 'rationale' | 'safety'] ?? null
  if (field === 'hint') return teaching.presentation === 'question' ? (teaching.hint ?? null) : null
  if (field === 'purpose' || field === 'explanation' || field === 'nextCheck')
    return teaching[field]
  throw new Error(`Unknown packet field ${field}`)
}

describe('MV-03 review packet', () => {
  it('is a request for review, not an approval', () => {
    expect(packet.contentVersion).toBe(VENTILATION_QUESTION_TEACHING_VERSION)
    expect(packet.preparedBy).toMatch(/not a clinical reviewer/)
    expect(packet.questionItems.length).toBeLessThanOrEqual(10)
    expect(packet.questionItems.map((item) => item.id).sort()).toEqual(
      ventilationQuestionTeaching.map((item) => item.questionId).sort(),
    )
    for (const item of [...packet.questionItems, ...packet.sourceIdentityItems])
      honestDecision(item.reviewerDecision)
  })

  it('quotes the current wording, so any later change reopens review', () => {
    for (const item of packet.questionItems) {
      expect(item.changedWording.length).toBeGreaterThan(0)
      for (const change of item.changedWording)
        expect(change.current).toBe(currentValue(item.id, change.field))
      const question = ventilationQuestionById.get(item.id)!
      expect(item.safetyExplanations).toEqual(
        question.choices
          .filter((choice) => choice.safety)
          .map((choice) =>
            expect.objectContaining({ choiceId: choice.id, current: choice.safety }),
          ),
      )
    }
  })

  it('records the legacy-facing fields that may not change without new ids', () => {
    for (const item of packet.questionItems) {
      const question = ventilationQuestionById.get(item.id)!
      expect(item.unchangedForLegacyRecords.prompt).toBe(question.prompt)
      expect(item.unchangedForLegacyRecords.correctId).toBe(question.correctId)
      expect(item.unchangedForLegacyRecords.choices).toEqual(
        question.choices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          unsafe: Boolean(choice.unsafe),
        })),
      )
    }
  })

  it('cites registered sources or says plainly that a locator is unregistered or missing', () => {
    for (const item of packet.questionItems) {
      expect(item.sourceLocators.length).toBeGreaterThan(0)
      expect(item.notChecked.length).toBeGreaterThan(0)
      expect(Array.isArray(item.unresolvedQuestions)).toBe(true)
      for (const locator of item.sourceLocators) {
        const known =
          locator.evidenceId === 'none' ||
          locator.evidenceId.startsWith('unregistered:') ||
          ventilationEvidenceById.has(locator.evidenceId)
        expect(known).toBe(true)
        expect([
          'supports',
          'partly supports',
          'narrows',
          'does not address',
          'conflicts',
        ]).toContain(locator.finding)
      }
    }
    expect(packet.sourceIdentityItems.map((item) => item.evidenceId)).toEqual([
      ...Array.from({ length: 8 }, (_, index) => `casebook-source-${index + 1}`),
      'supplied-casebook-2026',
    ])
    for (const item of packet.sourceIdentityItems) {
      const record = ventilationEvidenceById.get(item.evidenceId)!
      expect(item.current.title).toBe(record.title)
      expect(item.current.citation).toBe(record.citation)
      expect(item.documentsChecked.length).toBeGreaterThan(0)
      for (const key of item.documentsChecked) {
        expect(packet.documents[key]?.sha256).toMatch(/^[0-9a-f]{64}$/)
        expect(packet.documents[key]?.printedIdentity.length).toBeGreaterThan(40)
      }
    }
  })
})
