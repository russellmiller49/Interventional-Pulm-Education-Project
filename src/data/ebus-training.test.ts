import {
  adminEbusTrainingModules,
  getEmbeddedCourseModuleSrc,
  publicEbusTrainingModules,
  tnm9TrainingModule,
} from './ebus-training'

describe('getEmbeddedCourseModuleSrc', () => {
  it('passes locale and public EBUS scope before the hash route', () => {
    expect(getEmbeddedCourseModuleSrc(publicEbusTrainingModules[0], 'es')).toBe(
      '/socal-ebus-course/app/index.html?locale=es&publicTraining=1&publicScope=ebus#/knobology',
    )
  })

  it('normalizes zh-Hans to zh-CN for embedded app locale handoff', () => {
    expect(getEmbeddedCourseModuleSrc(tnm9TrainingModule, 'zh-Hans')).toBe(
      '/socal-ebus-course/app/index.html?locale=zh-CN&publicTraining=1&publicScope=tnm#/tnm-staging',
    )
  })

  it('preserves admin preview mode with localized simulator route', () => {
    expect(getEmbeddedCourseModuleSrc(adminEbusTrainingModules[0], 'zh-CN')).toBe(
      '/socal-ebus-course/app/index.html?locale=zh-CN&adminPreview=1#/simulator',
    )
  })

  it('falls back to English for unsupported locale values', () => {
    expect(getEmbeddedCourseModuleSrc(publicEbusTrainingModules[1], 'fr')).toBe(
      '/socal-ebus-course/app/index.html?locale=en&publicTraining=1&publicScope=ebus#/stations/explore',
    )
  })
})
