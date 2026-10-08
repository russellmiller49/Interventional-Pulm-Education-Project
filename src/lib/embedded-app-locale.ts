import { defaultLocale } from '@/i18n/locale'

export type EmbeddedAppLocale = 'en' | 'es' | 'zh-CN'

export const bronchNavigationTrainerAppPath = '/bronch-navigation-trainer/app/index.html'
export const socalEbusCourseAppPath = '/socal-ebus-course/app/index.html'
/** Standalone EUS-B simulator entry of the same embedded build (EBUS-course/apps/web/eus-b.html). */
export const socalEusBSimulatorAppPath = '/socal-ebus-course/app/eus-b.html'

export function normalizeEmbeddedAppLocale(locale: string | null | undefined): EmbeddedAppLocale {
  if (locale === 'es' || locale === 'zh-CN') {
    return locale
  }

  if (locale === 'zh-Hans') {
    return 'zh-CN'
  }

  return defaultLocale
}

export function buildEmbeddedAppSrc(
  appPath: string,
  locale: string | null | undefined,
  params: Record<string, string> = {},
  hashPath?: string,
) {
  const searchParams = new URLSearchParams({
    locale: normalizeEmbeddedAppLocale(locale),
    ...params,
  })
  const hash = hashPath ? `#${hashPath}` : ''

  return `${appPath}?${searchParams.toString()}${hash}`
}
