import {
  activeLocales,
  getLocaleDirection,
  getLocaleFromAcceptLanguage,
  isActiveLocale,
  plannedLocales,
  translationStatus,
} from './locale'
import {
  localizePath,
  pathShouldBypassLocaleRedirect,
  stripLocalePrefix,
  unlocalizedPathname,
} from './path'
import { isDraftModulePath, isVisibleModulePath } from '@/lib/draft-modules'

describe('i18n locale helpers', () => {
  it('exposes reviewed active locales and hidden planned locales', () => {
    expect(activeLocales).toEqual(['en', 'es', 'zh-CN'])
    expect(plannedLocales).toEqual(['ko', 'ja', 'ar', 'fr', 'de', 'hi'])
    expect(translationStatus.es).toBe('active')
    expect(translationStatus.ko).toBe('planned')
    expect(isActiveLocale('zh-CN')).toBe(true)
    expect(isActiveLocale('ko')).toBe(false)
  })

  it('strips and applies locale prefixes without changing stable route slugs', () => {
    expect(stripLocalePrefix('/es/board-prep/airway-stents')).toEqual({
      locale: 'es',
      pathname: '/board-prep/airway-stents',
    })
    expect(unlocalizedPathname('/zh-CN/pleural-procedures')).toBe('/pleural-procedures')
    expect(localizePath('/board-prep/airway-stents?mode=review', 'zh-CN')).toBe(
      '/zh-CN/board-prep/airway-stents?mode=review',
    )
  })

  it('resolves browser language preferences to active public locales', () => {
    expect(getLocaleFromAcceptLanguage('es-MX,es;q=0.9,en;q=0.7')).toBe('es')
    expect(getLocaleFromAcceptLanguage('zh-Hans-CN,zh;q=0.9,en;q=0.2')).toBe('zh-CN')
    expect(getLocaleFromAcceptLanguage('ko-KR,fr;q=0.9')).toBe('en')
  })

  it('tracks right-to-left only for planned Arabic until it is activated', () => {
    expect(getLocaleDirection('en')).toBe('ltr')
    expect(getLocaleDirection('zh-CN')).toBe('ltr')
    expect(getLocaleDirection('ar')).toBe('rtl')
  })

  it('evaluates draft-module visibility after removing locale prefixes', () => {
    expect(isDraftModulePath('/es/pleural-procedures')).toBe(true)
    expect(isVisibleModulePath('/zh-CN/rapid-onsite-cytology', { isAdmin: true })).toBe(true)
  })
})

describe('locale redirect bypass', () => {
  it('bypasses the legacy fluoroview asset root, and localizes real page routes', () => {
    // `/fluoroview/` is both the original simulator's route and its asset root (GLBs, the Draco
    // decoder, case data), so the whole prefix skips the locale redirect.
    expect(pathShouldBypassLocaleRedirect('/fluoroview/draco/draco_decoder.js')).toBe(true)
    expect(
      pathShouldBypassLocaleRedirect('/fluoroview/cases/patient-new/carm/c_arm_animation.glb'),
    ).toBe(true)

    // The peripheral bronchoscopy imaging course has page routes under `/peripheral-imaging`,
    // which must be localized. Its static assets live under the same prefix but always carry a
    // file extension, which is what the trailing rule keys on — so the two never collide, and
    // the course needs no bypass entry of its own.
    expect(pathShouldBypassLocaleRedirect('/peripheral-imaging')).toBe(false)
    expect(pathShouldBypassLocaleRedirect('/peripheral-imaging/learn')).toBe(false)
    expect(pathShouldBypassLocaleRedirect('/peripheral-imaging/practice')).toBe(false)
    expect(pathShouldBypassLocaleRedirect('/peripheral-imaging/assess')).toBe(false)
    expect(pathShouldBypassLocaleRedirect('/peripheral-imaging/anatomy/thorax.glb')).toBe(true)
    expect(pathShouldBypassLocaleRedirect('/peripheral-imaging/anatomy/manifest.json')).toBe(true)
  })
})
