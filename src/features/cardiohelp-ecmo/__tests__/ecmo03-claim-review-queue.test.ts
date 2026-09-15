import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { evidenceById } from '../content/evidence'

interface LearnerSurface {
  readonly file: string
  readonly locator: string
  readonly excerpt: string
}

interface SourceLocation {
  readonly sourceRecordId: string | null
  readonly documentId: string | null
  readonly repositoryPath: string | null
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
  readonly previousWording: string
  readonly intendedTeachingPoint: string
  readonly sourceRecordIds: readonly string[]
  readonly sourceLocations: readonly SourceLocation[]
  readonly modelOutput: string
  readonly unresolvedDisagreement: string
  readonly clinicalQuestion: string
  readonly questionDisposition: string
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
  readonly sourceDocumentsChecked: readonly { readonly documentId: string }[]
  readonly items: readonly QueueItem[]
}

const REQUIRED_TEXT_FIELDS = [
  'learnerWording',
  'previousWording',
  'intendedTeachingPoint',
  'modelOutput',
  'unresolvedDisagreement',
  'clinicalQuestion',
  'questionDisposition',
  'hold',
  'changeInThisBatch',
  'contentVersion',
] as const

const queue = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/gap-remediation/self-paced/ECMO-03-claim-review-queue.json'),
    'utf8',
  ),
) as ReviewQueue

const collapse = (text: string) => text.replace(/\s+/g, ' ')

/**
 * The ECMO-03 queue is plain JSON an ECMO or device reviewer can fill in. These checks keep it
 * honest rather than enforce a workflow: at most ten items, a decision that is absent or
 * attributable to a named person, every cited record, document or repository path resolving, and
 * each item still quoting the learner wording the decision would be about.
 */
describe('ECMO-03 claim-review queue', () => {
  it('is one bounded batch of at most ten items with known categories', () => {
    expect(queue.items.length).toBeGreaterThan(0)
    expect(queue.items.length).toBeLessThanOrEqual(10)
    expect(new Set(queue.items.map((item) => item.id)).size).toBe(queue.items.length)
    for (const item of queue.items) {
      expect(queue.categories).toContain(item.category)
      expect(queue.claimKinds).toContain(item.claimKind)
    }
  })

  it('gives a reviewer the wording, what it replaced, the locations, the model output and the hold', () => {
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

  it('cites only registered sources, documents it lists as checked, or repository files that exist', () => {
    const checked = new Set(queue.sourceDocumentsChecked.map((document) => document.documentId))
    for (const item of queue.items) {
      for (const id of item.sourceRecordIds) {
        expect({ item: item.id, id, registered: evidenceById.has(id) }).toEqual({
          item: item.id,
          id,
          registered: true,
        })
      }
      for (const location of item.sourceLocations) {
        const resolves =
          (location.sourceRecordId !== null && evidenceById.has(location.sourceRecordId)) ||
          (location.documentId !== null && checked.has(location.documentId)) ||
          (location.repositoryPath !== null &&
            existsSync(join(process.cwd(), location.repositoryPath)))
        expect({ item: item.id, location: location.location, resolves }).toEqual({
          item: item.id,
          location: location.location,
          resolves: true,
        })
        if (location.documentId !== null) {
          expect({
            item: item.id,
            document: location.documentId,
            listed: checked.has(location.documentId),
          }).toEqual({
            item: item.id,
            document: location.documentId,
            listed: true,
          })
        }
      }
    }
  })

  it('still quotes the learner wording a reviewer would be deciding on', () => {
    // A reworded surface means the queue must be re-checked before anyone reviews it.
    for (const item of queue.items) {
      expect(item.contentVersion).toBe(queue.moduleContentVersion)
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
          quoted: collapse(readFileSync(path, 'utf8')).includes(collapse(surface.excerpt)),
        }).toEqual({ item: item.id, excerpt: surface.excerpt, quoted: true })
      }
    }
  })
})
