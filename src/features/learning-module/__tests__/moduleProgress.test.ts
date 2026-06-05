import {
  countCompletedSections,
  isModuleComplete,
  isModuleStarted,
  withSectionComplete,
} from '../engine/moduleProgress'

const NOW = '2026-06-04T00:00:00.000Z'

describe('module progress engine', () => {
  it('marks a section complete without mutating the input map', () => {
    const start = {}
    const next = withSectionComplete(start, 'pleural-ultrasound', 'learn', true, NOW)

    expect(start).toEqual({})
    expect(next['pleural-ultrasound']).toEqual({ learn: true, updatedAt: NOW })
  })

  it('accumulates multiple sections for the same module', () => {
    let map = withSectionComplete({}, 'pleural-ultrasound', 'learn', true, NOW)
    map = withSectionComplete(map, 'pleural-ultrasound', 'practice', true, NOW)

    expect(countCompletedSections(map['pleural-ultrasound'])).toBe(2)
    expect(isModuleStarted(map['pleural-ultrasound'])).toBe(true)
    expect(isModuleComplete(map['pleural-ultrasound'])).toBe(false)
  })

  it('reports completion only when all three sections are done', () => {
    let map = withSectionComplete({}, 'm', 'learn', true, NOW)
    map = withSectionComplete(map, 'm', 'practice', true, NOW)
    map = withSectionComplete(map, 'm', 'assessment', true, NOW)

    expect(isModuleComplete(map['m'])).toBe(true)
    expect(countCompletedSections(map['m'])).toBe(3)
  })

  it('can toggle a section back off', () => {
    let map = withSectionComplete({}, 'm', 'learn', true, NOW)
    map = withSectionComplete(map, 'm', 'learn', false, NOW)

    expect(countCompletedSections(map['m'])).toBe(0)
    expect(isModuleStarted(map['m'])).toBe(false)
  })

  it('treats an unknown module as not started', () => {
    expect(countCompletedSections(undefined)).toBe(0)
    expect(isModuleStarted(undefined)).toBe(false)
    expect(isModuleComplete(undefined)).toBe(false)
  })
})
