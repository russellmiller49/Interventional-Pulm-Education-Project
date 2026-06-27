import {
  activeLocales,
  getLocaleDirection,
  getLocaleFromAcceptLanguage,
  isActiveLocale,
  plannedLocales,
  translationStatus,
} from './locale'
import { localizePath, stripLocalePrefix, unlocalizedPathname } from './path'
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
