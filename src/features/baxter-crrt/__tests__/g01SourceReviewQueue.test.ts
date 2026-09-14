import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { isResolvableCrrtSourceId } from '../content/learnerSourceMap'
import { BAXTER_CRRT_CONTENT_VERSION } from '../content/versions'

interface LearnerSurface {
  readonly file: string
  readonly locator: string
  readonly excerpt: string
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
  readonly learnerSurfaces: readonly LearnerSurface[]
  readonly learnerWording: string
  readonly intendedTeachingPoint: string
  readonly sourceRecordIds: readonly string[]
  readonly sourceDocumentIds: readonly string[]
  readonly supportingLocation: string
  readonly limitation: string
  readonly clinicalDecisionNeeded: string
  readonly hold: string
  readonly changeInThisBatch: string
  readonly contentVersion: string
  readonly reviewerDecision: ReviewerDecision
}

interface ReviewQueue {
  readonly moduleContentVersion: string
  readonly decisionValues: readonly string[]
  readonly items: readonly QueueItem[]
}

const REQUIRED_TEXT_FIELDS = [
  'learnerWording',
  'intendedTeachingPoint',
  'supportingLocation',
  'limitation',
  'clinicalDecisionNeeded',
  'hold',
  'changeInThisBatch',
  'contentVersion',
] as const

const queue = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json'),
    'utf8',
  ),
) as ReviewQueue

/**
 * The G01 reviewer queue is plain JSON a clinician can fill in. These checks keep it honest rather
 * than enforce a workflow: a decision is either explicitly absent or attributable to a person, and
 * each item still quotes the content that decision would be about.
 */
describe('G01 CRRT source-review queue', () => {
  it('is one bounded batch of at most ten items', () => {
    expect(queue.items.length).toBeGreaterThan(0)
    expect(queue.items.length).toBeLessThanOrEqual(10)
    expect(new Set(queue.items.map((item) => item.id)).size).toBe(queue.items.length)
  })

  it('gives a reviewer the wording, teaching point, source location, limit and decision needed', () => {
    for (const item of queue.items) {
      for (const field of REQUIRED_TEXT_FIELDS) {
        expect({ item: item.id, field, filled: item[field].trim().length > 0 }).toEqual({
          item: item.id,
          field,
          filled: true,
        })
      }
      expect(item.learnerSurfaces.length).toBeGreaterThan(0)
      expect(Array.isArray(item.sourceRecordIds)).toBe(true)
      expect(Array.isArray(item.sourceDocumentIds)).toBe(true)
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
      expect({ id, decision: decision.decision }).toEqual({
        id,
        decision: expect.stringMatching(new RegExp(`^(?:${queue.decisionValues.join('|')})$`)),
      })
      if (decision.decision === 'NOT REVIEWED') {
        expect([
          decision.reviewer,
          decision.role,
          decision.date,
          decision.reviewedContentVersion,
        ]).toEqual([null, null, null, null])
      } else {
        expect(decision.reviewer).toMatch(/\S/)
        expect(decision.reviewer).not.toMatch(/claude|codex|\bagent\b|\bAI\b|assistant|\bLLM\b/i)
        expect(decision.role).toMatch(/\S/)
        expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(decision.reviewedContentVersion).toMatch(/\S/)
      }
    }
  })

  it('cites only sources that a learner citation resolves to', () => {
    for (const item of queue.items) {
      for (const id of item.sourceRecordIds) {
        expect({ item: item.id, id, resolves: isResolvableCrrtSourceId(id) }).toEqual({
          item: item.id,
          id,
          resolves: true,
        })
      }
    }
  })

  it('still quotes the content a reviewer would be deciding on', () => {
    // A content-version bump or reworded surface means the queue must be re-checked before review.
    expect(queue.moduleContentVersion).toBe(BAXTER_CRRT_CONTENT_VERSION)
    for (const item of queue.items) {
      for (const surface of item.learnerSurfaces) {
        const path = join(process.cwd(), surface.file)
        expect({ item: item.id, file: surface.file, exists: existsSync(path) }).toEqual({
          item: item.id,
          file: surface.file,
          exists: true,
        })
        expect({
          item: item.id,
          file: surface.file,
          quoted: readFileSync(path, 'utf8').includes(surface.excerpt),
        }).toEqual({ item: item.id, file: surface.file, quoted: true })
      }
    }
  })
})
