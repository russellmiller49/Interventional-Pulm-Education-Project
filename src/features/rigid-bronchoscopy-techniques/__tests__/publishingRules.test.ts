import { techniqueClips } from '@/features/rigid-bronchoscopy-techniques/content/techniqueVideos'
import {
  canPublishClip,
  getLearnerVisibleClips,
} from '@/features/rigid-bronchoscopy-techniques/lib/validation'
import type { RigidBronchoscopyClip } from '@/features/rigid-bronchoscopy-techniques/types'

function clip(overrides: Partial<RigidBronchoscopyClip> = {}): RigidBronchoscopyClip {
  return {
    id: 'RB-X-001',
    lessonId: 'positioning',
    title: 'Test',
    objective: 'Test',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'External',
    durationSeconds: 5,
    videoPath: 'clips/approved/RB-X-001.mp4',
    posterPath: 'posters/RB-X-001.jpg',
    reviewStatus: 'approved',
    syntheticLabelRequired: true,
    leftRightVerified: false,
    medicalAccuracyVerified: true,
    safetyNotes: [],
    ...overrides,
  }
}

describe('canPublishClip', () => {
  it('publishes an approved, verified, non-side-specific clip', () => {
    expect(canPublishClip(clip())).toBe(true)
  })

  it('publishes an approved, verified, side-specific clip only when left/right is verified', () => {
    expect(canPublishClip(clip({ anatomicalSide: 'left', leftRightVerified: true }))).toBe(true)
    expect(canPublishClip(clip({ anatomicalSide: 'left', leftRightVerified: false }))).toBe(false)
    expect(canPublishClip(clip({ anatomicalSide: 'right', leftRightVerified: false }))).toBe(false)
  })

  it('never publishes non-approved clips', () => {
    for (const status of [
      'planned',
      'generated-draft',
      'faculty-review',
      'revision-required',
      'rejected',
    ] as const) {
      expect(canPublishClip(clip({ reviewStatus: status }))).toBe(false)
    }
  })

  it('never publishes an approved clip that is not medically verified', () => {
    expect(canPublishClip(clip({ medicalAccuracyVerified: false }))).toBe(false)
  })
})

describe('getLearnerVisibleClips', () => {
  it('excludes drafts by default (production route never falls back to drafts)', () => {
    const clips = [clip({ id: 'ok' }), clip({ id: 'draft', reviewStatus: 'generated-draft' })]
    expect(getLearnerVisibleClips(clips).map((c) => c.id)).toEqual(['ok'])
  })

  it('includes drafts only when explicitly requested (dev/admin)', () => {
    const clips = [clip({ id: 'ok' }), clip({ id: 'draft', reviewStatus: 'generated-draft' })]
    expect(getLearnerVisibleClips(clips, { includeDrafts: true }).map((c) => c.id)).toEqual([
      'ok',
      'draft',
    ])
  })

  it('yields nothing publishable for the current all-planned manifest', () => {
    expect(getLearnerVisibleClips(techniqueClips)).toEqual([])
  })
})
