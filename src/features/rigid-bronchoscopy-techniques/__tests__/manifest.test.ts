import {
  getOrderedTechniqueLessons,
  techniqueLessons,
} from '@/features/rigid-bronchoscopy-techniques/content/techniqueLessons'
import { techniqueClips } from '@/features/rigid-bronchoscopy-techniques/content/techniqueVideos'
import {
  collectManifestIssues,
  parseClipManifest,
} from '@/features/rigid-bronchoscopy-techniques/lib/validation'
import type { RigidBronchoscopyClip } from '@/features/rigid-bronchoscopy-techniques/types'

describe('technique-video manifest', () => {
  it('validates against the runtime schema', () => {
    expect(() => parseClipManifest(techniqueClips)).not.toThrow()
  })

  it('has no cross-field integrity issues', () => {
    expect(collectManifestIssues(techniqueClips, techniqueLessons)).toEqual([])
  })

  it('has unique clip ids', () => {
    const ids = techniqueClips.map((clip) => clip.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('references only clips that exist, and only lessons that exist', () => {
    const clipIds = new Set(techniqueClips.map((clip) => clip.id))
    const lessonIds = new Set(techniqueLessons.map((lesson) => lesson.id))

    for (const lesson of techniqueLessons) {
      for (const clipId of lesson.clipIds) {
        expect(clipIds.has(clipId)).toBe(true)
      }
    }
    for (const clip of techniqueClips) {
      expect(lessonIds.has(clip.lessonId)).toBe(true)
    }
  })

  it('orders lessons 1..9 without gaps', () => {
    const orders = getOrderedTechniqueLessons().map((lesson) => lesson.order)
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('starts entirely as planned (no media generated yet)', () => {
    expect(techniqueClips.every((clip) => clip.reviewStatus === 'planned')).toBe(true)
    expect(techniqueClips.every((clip) => clip.videoPath === '')).toBe(true)
  })

  it('flags every synthetic clip for the synthetic-content label', () => {
    for (const clip of techniqueClips) {
      if (clip.sourceType === 'higgsfield-synthetic' || clip.sourceType === 'validated-3d-render') {
        expect(clip.syntheticLabelRequired).toBe(true)
      }
    }
  })

  it('documents a camera orientation for every side-specific clip', () => {
    for (const clip of techniqueClips) {
      if (clip.anatomicalSide === 'left' || clip.anatomicalSide === 'right') {
        expect(clip.cameraOrientation.trim().length).toBeGreaterThan(0)
      }
    }
  })

  describe('collectManifestIssues catches bad records', () => {
    const base: RigidBronchoscopyClip = {
      id: 'RB-TEST-001',
      lessonId: 'positioning',
      title: 'Test',
      objective: 'Test objective',
      sourceType: 'higgsfield-synthetic',
      anatomicalSide: 'not-applicable',
      cameraOrientation: 'External',
      durationSeconds: 5,
      videoPath: '',
      posterPath: '',
      reviewStatus: 'planned',
      syntheticLabelRequired: true,
      leftRightVerified: false,
      medicalAccuracyVerified: false,
      safetyNotes: [],
    }

    it('detects duplicate clip ids', () => {
      const issues = collectManifestIssues([base, { ...base }])
      expect(issues).toContain('Duplicate clip id: RB-TEST-001')
    })

    it('detects an approved clip that is not medically verified', () => {
      const issues = collectManifestIssues([
        { ...base, reviewStatus: 'approved', medicalAccuracyVerified: false },
      ])
      expect(issues).toContain('Clip RB-TEST-001 is approved but medicalAccuracyVerified is false')
    })

    it('detects an approved side-specific clip that is not left/right verified', () => {
      const issues = collectManifestIssues([
        {
          ...base,
          anatomicalSide: 'left',
          reviewStatus: 'approved',
          medicalAccuracyVerified: true,
          leftRightVerified: false,
        },
      ])
      expect(issues).toContain(
        'Clip RB-TEST-001 is approved and side-specific but leftRightVerified is false',
      )
    })

    it('detects a synthetic clip missing its synthetic-content label flag', () => {
      const issues = collectManifestIssues([{ ...base, syntheticLabelRequired: false }])
      expect(issues).toContain(
        'Clip RB-TEST-001 is higgsfield-synthetic but syntheticLabelRequired is false',
      )
    })

    it('detects a side-specific clip missing a documented camera orientation', () => {
      const issues = collectManifestIssues([
        { ...base, anatomicalSide: 'right', cameraOrientation: '   ' },
      ])
      expect(issues).toContain(
        'Side-specific clip RB-TEST-001 is missing a documented cameraOrientation',
      )
    })

    it('detects a lesson referencing an unknown clip', () => {
      const issues = collectManifestIssues(
        [base],
        [
          {
            id: 'positioning',
            order: 1,
            title: 'x',
            objective: 'x',
            approxDurationSeconds: 10,
            safetyStatement: 'x',
            keyMovementRule: 'x',
            commonError: 'x',
            clipIds: ['RB-DOES-NOT-EXIST'],
            retrievalQuestions: [],
          },
        ],
      )
      expect(issues).toContain('Lesson positioning references unknown clip id: RB-DOES-NOT-EXIST')
    })
  })
})
