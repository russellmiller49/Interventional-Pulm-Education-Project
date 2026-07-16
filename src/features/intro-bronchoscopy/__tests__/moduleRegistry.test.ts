import { introBronchoscopyModules } from '../content/modules'

describe('intro bronchoscopy module registry', () => {
  it('contains the complete 9-module syllabus spine', () => {
    expect(introBronchoscopyModules.map((courseModule) => courseModule.slug)).toEqual([
      'decision-risk-planning',
      'scope-anatomy-handling',
      'airway-anatomy',
      'airway-pathology-description',
      'diagnostic-tools-bal',
      'therapeutic-tools-foreign-body',
      'icu-bronchoscopy',
      'airway-emergencies',
      'documentation-communication',
    ])
  })

  it('gives every module objectives, practice, assessment, and syllabus mapping', () => {
    for (const courseModule of introBronchoscopyModules) {
      expect(courseModule.objectives.length).toBeGreaterThanOrEqual(3)
      expect(courseModule.syllabusSections.length).toBeGreaterThan(0)
      expect(courseModule.learnBlocks.length).toBeGreaterThan(0)
      expect(courseModule.practiceActivities.length).toBeGreaterThan(0)
      expect(courseModule.assessmentItems.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('covers all planned practice activity types', () => {
    const types = new Set(
      introBronchoscopyModules.flatMap((courseModule) =>
        courseModule.practiceActivities.map((activity) => activity.type),
      ),
    )
    expect(types).toEqual(
      new Set([
        'case-triage',
        'hotspot-diagram',
        'simulator',
        'scope-size-explorer',
        'image-description',
        'drag-drop',
        'sequence-builder',
        'report-builder',
      ]),
    )
  })

  it('keeps quiz choices unique and explanations out of answer labels', () => {
    for (const courseModule of introBronchoscopyModules) {
      for (const question of courseModule.assessmentItems) {
        expect(question.answerIndex).toBeGreaterThanOrEqual(0)
        expect(question.answerIndex).toBeLessThan(question.options.length)
        expect(new Set(question.options).size).toBe(question.options.length)
        for (const option of question.options) {
          expect(question.explanation).not.toBe(option)
        }
      }
    }
  })

  it('uses public asset references for linked assets', () => {
    for (const courseModule of introBronchoscopyModules) {
      for (const asset of courseModule.assets) {
        expect(asset.startsWith('/')).toBe(true)
      }
    }
  })
})
