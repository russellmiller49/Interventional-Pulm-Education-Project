import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ICU_HEMODYNAMICS_CONTENT_VERSION } from '../content/release'
import { hemodynamicsSourceById } from '../content/sources'

interface LearnerSurface {
  readonly file: string
  readonly locator: string
  readonly excerpt: string
}

interface SourceLocation {
  readonly sourceRecordId: string
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
  readonly category: string
  readonly claimKind: string
  readonly learnerSurfaces: readonly LearnerSurface[]
  readonly learnerWording: string
  readonly intendedTeachingPoint: string
  readonly sourceRecordIds: readonly string[]
  readonly sourceLocations: readonly SourceLocation[]
  readonly clinicalQuestion: string
  readonly hold: string
  readonly changeInThisBatch: string
  readonly contentVersion: string
  readonly reviewerDecision: ReviewerDecision
}

interface ReviewQueue {
  readonly moduleContentVersion: string
  readonly decisionValues: readonly string[]
  readonly categories: readonly string[]
  readonly claimKinds: readonly string[]
  readonly findingValues: readonly string[]
  readonly items: readonly QueueItem[]
}

const REQUIRED_TEXT_FIELDS = [
  'learnerWording',
  'intendedTeachingPoint',
  'clinicalQuestion',
  'hold',
  'changeInThisBatch',
  'contentVersion',
] as const

const queue = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/gap-remediation/self-paced/HD-03-claim-review-queue.json'),
    'utf8',
  ),
) as ReviewQueue

/**
 * The HD-03 claim queue is plain JSON a hemodynamics educator can fill in. These checks keep it
 * honest rather than enforce a workflow: a decision is absent or attributable to a named person,
 * every cited record resolves, the diagnostic-definition / model-condition / treatment-target kinds
 * stay distinct, and each item still quotes the learner wording the decision would be about.
 */
describe('HD-03 hemodynamics claim-review queue', () => {
  it('is one bounded batch of at most ten items across the five HD-03 topics', () => {
    expect(queue.items.length).toBeGreaterThan(0)
    expect(queue.items.length).toBeLessThanOrEqual(10)
    expect(new Set(queue.items.map((item) => item.id)).size).toBe(queue.items.length)
    expect(queue.categories).toEqual([
      'signal-validity',
      'direct-versus-derived',
      'invalid-input-handling',
      'wedge-safety',
      'numerical-definition',
    ])
    for (const category of queue.categories) {
      expect(queue.items.some((item) => item.category === category)).toBe(true)
    }
    for (const item of queue.items) {
      expect(queue.categories).toContain(item.category)
      expect(queue.claimKinds).toContain(item.claimKind)
    }
  })

  it('gives a reviewer the wording, teaching point, source locations, question and hold', () => {
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

  it('cites only registered hemodynamics sources', () => {
    for (const item of queue.items) {
      const cited = [
        ...item.sourceRecordIds,
        ...item.sourceLocations.map((location) => location.sourceRecordId),
      ]
      for (const id of cited) {
        expect({ item: item.id, id, registered: hemodynamicsSourceById.has(id) }).toEqual({
          item: item.id,
          id,
          registered: true,
        })
      }
    }
  })

  it('still quotes the learner wording a reviewer would be deciding on', () => {
    // A content-version change or a reworded surface means the queue must be re-checked before review.
    expect(queue.moduleContentVersion).toBe(ICU_HEMODYNAMICS_CONTENT_VERSION)
    for (const item of queue.items) {
      expect(item.contentVersion).toBe(ICU_HEMODYNAMICS_CONTENT_VERSION)
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
