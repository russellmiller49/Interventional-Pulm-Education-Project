import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { criticalCareMeasurementClarificationById } from '@/features/critical-care/content/measurementClarifications'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'

import { MCS_CONTENT_VERSION } from '../content/release'
import { mcsSourceById } from '../content/sources'

interface LearnerSurface {
  readonly file: string
  readonly locator: string
  readonly excerpt: string
}

interface SourceLocation {
  readonly sourceRecordId: string | null
  readonly documentId: string | null
  readonly location: string
  readonly finding: string
  readonly note: string
}

interface ReviewerDecision {
  readonly decision: string
  readonly reviewer: string | null
  readonly role: string | null
  readonly date: string | null
  readonly reviewedContentVersion: string | null
}

interface QueueItem {
  readonly id: string
  readonly deviceFamily: string
  readonly category: string
  readonly claimKind: string
  readonly deviceProfile: string
  readonly learnerSurfaces: readonly LearnerSurface[]
  readonly learnerWording: string
  readonly intendedTeachingPoint: string
  readonly sourceRecordIds: readonly string[]
  readonly sharedRecordIds: readonly string[]
  readonly sourceLocations: readonly SourceLocation[]
  readonly modelOutput: string
  readonly unresolvedDisagreement: string
  readonly missingAndReassess: string
  readonly clinicalQuestion: string
  readonly hold: string
  readonly changeInThisBatch: string
  readonly contentVersion: string
  readonly reviewerDecision: ReviewerDecision
}

interface ReviewQueue {
  readonly moduleContentVersion: string
  readonly decisionValues: readonly string[]
  readonly deviceFamilies: readonly string[]
  readonly categories: readonly string[]
  readonly claimKinds: readonly string[]
  readonly findingValues: readonly string[]
  readonly sourceDocumentsChecked: readonly { readonly documentId: string }[]
  readonly items: readonly QueueItem[]
}

const REQUIRED_TEXT_FIELDS = [
  'deviceProfile',
  'learnerWording',
  'intendedTeachingPoint',
  'modelOutput',
  'unresolvedDisagreement',
  'missingAndReassess',
  'clinicalQuestion',
  'hold',
  'changeInThisBatch',
  'contentVersion',
] as const

const queue = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/gap-remediation/self-paced/MCS-03-claim-review-queue.json'),
    'utf8',
  ),
) as ReviewQueue

const MEASURAND_CLARIFICATION = 'clarification.mcs.impella-cp-flow-measurands'
const TEXTBOOK_CONFLICT = 'conflict.mcs.impella-cp-textbook-flow'

/**
 * The MCS-03 claim queue is plain JSON an MCS or device reviewer can fill in. These checks keep it
 * honest rather than enforce a workflow: a decision is absent or attributable to a named person,
 * every cited record or document resolves, the manufacturer-measurand clarification and the
 * textbook disagreement stay separate items, and each item still quotes the learner wording the
 * decision would be about.
 */
describe('MCS-03 claim-review queue', () => {
  it('is one bounded batch of at most ten items that reaches all three device families', () => {
    expect(queue.items.length).toBeGreaterThan(0)
    expect(queue.items.length).toBeLessThanOrEqual(10)
    expect(new Set(queue.items.map((item) => item.id)).size).toBe(queue.items.length)
    for (const family of ['iabp', 'microaxial', 'durable-lvad']) {
      expect(queue.items.some((item) => item.deviceFamily === family)).toBe(true)
    }
    for (const item of queue.items) {
      expect(queue.deviceFamilies).toContain(item.deviceFamily)
      expect(queue.categories).toContain(item.category)
      expect(queue.claimKinds).toContain(item.claimKind)
    }
  })

  it('keeps the measurand clarification and the textbook disagreement as separate items', () => {
    const clarificationItems = queue.items.filter((item) =>
      item.sharedRecordIds.includes(MEASURAND_CLARIFICATION),
    )
    const conflictItems = queue.items.filter((item) =>
      item.sharedRecordIds.includes(TEXTBOOK_CONFLICT),
    )
    expect(clarificationItems).toHaveLength(1)
    expect(conflictItems).toHaveLength(1)
    expect(clarificationItems[0].id).not.toBe(conflictItems[0].id)
    expect(clarificationItems[0].sharedRecordIds).not.toContain(TEXTBOOK_CONFLICT)
    expect(conflictItems[0].sharedRecordIds).not.toContain(MEASURAND_CLARIFICATION)
  })

  it('gives a reviewer the wording, source locations, model output, disagreement and hold', () => {
    for (const item of queue.items) {
      for (const field of REQUIRED_TEXT_FIELDS) {
        expect({ item: item.id, field, filled: item[field].trim().length > 0 }).toEqual({
          item: item.id,
          field,
          filled: true,
        })
      }
      expect(item.learnerSurfaces.length).toBeGreaterThan(0)
      expect(item.sourceLocations.length).toBeGreaterThan(0)
      for (const location of item.sourceLocations) {
        expect(queue.findingValues).toContain(location.finding)
        expect(location.location.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('holds either no decision or an attributable human one, never a generated approval', () => {
    expect(queue.decisionValues).toEqual([
      'NOT REVIEWED',
      'APPROVE AS SCOPED',
      'REVISE',
      'REJECT',
      'UNCERTAIN',
    ])
    for (const { id, reviewerDecision: decision } of queue.items) {
      expect(queue.decisionValues).toContain(decision.decision)
      if (decision.decision === 'NOT REVIEWED') {
        expect({
          id,
          fields: [
            decision.reviewer,
            decision.role,
            decision.date,
            decision.reviewedContentVersion,
          ],
        }).toEqual({ id, fields: [null, null, null, null] })
      } else {
        expect(decision.reviewer).toMatch(/\S/)
        expect(decision.reviewer).not.toMatch(/claude|codex|\bagent\b|\bAI\b|assistant|\bLLM\b/i)
        expect(decision.role).toMatch(/\S/)
        expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(decision.reviewedContentVersion).toMatch(/\S/)
      }
    }
  })

  it('cites only registered sources, the shared MCS records and documents it lists as checked', () => {
    const checked = new Set(queue.sourceDocumentsChecked.map((document) => document.documentId))
    for (const item of queue.items) {
      for (const id of item.sourceRecordIds) {
        expect({ item: item.id, id, registered: mcsSourceById.has(id) }).toEqual({
          item: item.id,
          id,
          registered: true,
        })
      }
      for (const id of item.sharedRecordIds) {
        expect({
          item: item.id,
          id,
          registered:
            criticalCareMeasurementClarificationById.has(id) ||
            criticalCareSourceConflictById.has(id),
        }).toEqual({ item: item.id, id, registered: true })
      }
      for (const location of item.sourceLocations) {
        const resolves =
          (location.sourceRecordId !== null && mcsSourceById.has(location.sourceRecordId)) ||
          (location.documentId !== null && checked.has(location.documentId))
        expect({ item: item.id, location: location.location, resolves }).toEqual({
          item: item.id,
          location: location.location,
          resolves: true,
        })
      }
    }
  })

  it('still quotes the learner wording a reviewer would be deciding on', () => {
    // A content-version change or a reworded surface means the queue must be re-checked before review.
    expect(queue.moduleContentVersion).toBe(MCS_CONTENT_VERSION)
    for (const item of queue.items) {
      expect(item.contentVersion).toBe(MCS_CONTENT_VERSION)
      for (const surface of item.learnerSurfaces) {
        const path = join(process.cwd(), surface.file)
        expect({ item: item.id, file: surface.file, exists: existsSync(path) }).toEqual({
          item: item.id,
          file: surface.file,
          exists: true,
        })
        expect({
          item: item.id,
          excerpt: surface.excerpt,
          quoted: readFileSync(path, 'utf8').includes(surface.excerpt),
        }).toEqual({ item: item.id, excerpt: surface.excerpt, quoted: true })
      }
    }
  })
})
