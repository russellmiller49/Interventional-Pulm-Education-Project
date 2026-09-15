/**
 * @jest-environment node
 */
import { readFileSync } from 'fs'
import { join } from 'path'

import { CAPSTONE_CASES } from '../content/capstone'
import { fiveControlsLearnInputs } from '../content/fiveControlsLearn'
import { LOCAL_POLICIES } from '../content/localPolicies'
import { bronchMicroCaseById } from '../content/microCases'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { BRONCH_SECTIONS } from '../content/sections'
import { SOURCE_BY_ID } from '../data/sources'

/**
 * The BF-01 claim review queue enforces honesty only: it holds at most ten items, no decision is
 * recorded without a named, non-AI reviewer, every cited source and surface resolves, each quoted
 * learner wording still exists at this content version (so a wording change reopens review), and
 * nothing in the queue was applied to the course in this batch.
 */
interface QueueItem {
  readonly id: string
  readonly surfaces: readonly Record<string, string>[]
  readonly sourceRefs: readonly string[]
  readonly learnerWording: string
  readonly sourceCheck: { readonly checkedBy: string; readonly supportStatus: string }
  readonly recommendation: string
  readonly proposedWording: string | null
  readonly changeInThisBatch: string
  readonly reviewerDecision: {
    readonly decision: string
    readonly reviewer: string | null
    readonly role: string | null
    readonly date: string | null
    readonly reviewedVersion: string | null
  }
}

const QUEUE = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../docs/gap-remediation/self-paced/BF-01-claim-review-queue.json'),
    'utf8',
  ),
) as { readonly items: readonly QueueItem[] }

function collectStrings(value: unknown, out: string[], seen: WeakSet<object>): string[] {
  if (typeof value === 'string') out.push(value)
  else if (value && typeof value === 'object' && !(value instanceof RegExp)) {
    if (seen.has(value)) return out
    seen.add(value)
    for (const entry of Object.values(value)) collectStrings(entry, out, seen)
  }
  return out
}

const CONTENT_STRINGS = collectStrings(
  [BRONCH_SECTIONS, CAPSTONE_CASES, fiveControlsLearnInputs(), LOCAL_POLICIES],
  [],
  new WeakSet(),
)

const inContent = (wording: string) => CONTENT_STRINGS.some((text) => text.includes(wording))

describe('the BF-01 claim review queue', () => {
  it('holds at most ten items, none carrying a decision without a named non-AI reviewer', () => {
    expect(QUEUE.items.length).toBeGreaterThan(0)
    expect(QUEUE.items.length).toBeLessThanOrEqual(10)
    expect(new Set(QUEUE.items.map((item) => item.id)).size).toBe(QUEUE.items.length)
    for (const item of QUEUE.items) {
      expect(item.id).toMatch(/^BF-01-C\d{2}$/)
      const decision = item.reviewerDecision
      if (decision.decision === 'NOT REVIEWED') {
        expect([decision.reviewer, decision.role, decision.date, decision.reviewedVersion]).toEqual(
          [null, null, null, null],
        )
      } else {
        expect(decision.reviewer).toBeTruthy()
        expect(decision.reviewer).not.toMatch(/claude|codex|gpt|\bai\b|assistant/i)
        expect(decision.role).toBeTruthy()
        expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(decision.reviewedVersion).toBeTruthy()
      }
    }
  })

  it('cites registered sources and surfaces that exist', () => {
    const capstoneIds = new Set(CAPSTONE_CASES.map((entry) => entry.id))
    for (const item of QUEUE.items) {
      expect(item.sourceRefs.length).toBeGreaterThan(0)
      for (const ref of item.sourceRefs)
        expect(SOURCE_BY_ID.has(ref.split(',')[0].trim())).toBe(true)
      expect(item.surfaces.length).toBeGreaterThan(0)
      for (const surface of item.surfaces) {
        if (surface.sectionId) expect(BRONCH_SECTION_IDS).toContain(surface.sectionId)
        if (surface.capstoneCaseId) expect(capstoneIds.has(surface.capstoneCaseId)).toBe(true)
        if (surface.practiceCaseId)
          expect(bronchMicroCaseById.has(surface.practiceCaseId)).toBe(true)
      }
    }
  })

  it('quotes learner wording that still exists at this content version', () => {
    for (const item of QUEUE.items) {
      expect(item.learnerWording.length).toBeGreaterThanOrEqual(40)
      expect({ id: item.id, found: inContent(item.learnerWording) }).toEqual({
        id: item.id,
        found: true,
      })
    }
  })

  it('records the check, and changes nothing in the course in this batch', () => {
    for (const item of QUEUE.items) {
      expect(item.sourceCheck.checkedBy).toMatch(/AI authoring assistant/)
      expect([
        'supported-at-location',
        'partially-supported',
        'not-found-at-location',
        'source-unavailable',
      ]).toContain(item.sourceCheck.supportStatus)
      expect(['keep', 'narrow', 'hold']).toContain(item.recommendation)
      expect(item.changeInThisBatch).toBe('none')
      if (item.recommendation === 'narrow') {
        expect(item.proposedWording).toBeTruthy()
        expect(inContent(item.proposedWording!)).toBe(false)
      } else {
        expect(item.proposedWording).toBeNull()
      }
    }
  })
})
