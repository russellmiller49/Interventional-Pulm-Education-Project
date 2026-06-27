import { getTranslations } from 'next-intl/server'

import { translateHandoffText, type HandoffRawTranslator } from './handoff-core'

const protectedKeys = new Set([
  'audioFile',
  'audioPath',
  'canonical',
  'doi',
  'filename',
  'href',
  'id',
  'imageFile',
  'imagePath',
  'licenseUrl',
  'pathname',
  'pmid',
  'pubmedId',
  'route',
  'slug',
  'sourceFile',
  'sourceUrl',
  'src',
  'url',
])

function localizeValue<T>(t: HandoffRawTranslator, value: T, key?: string): T {
  if (typeof value === 'string') {
    if (key && protectedKeys.has(key)) {
      return value
    }
    return translateHandoffText(t, value) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => localizeValue(t, item)) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      localizeValue(t, childValue, childKey),
    ]),
  ) as T
}

/** Localize metadata and other server-side plain data without changing its shape. */
export async function localizeHandoffServerValue<T>(locale: string, value: T): Promise<T> {
  const t = (await getTranslations({
    locale,
    namespace: 'handoff',
  })) as unknown as HandoffRawTranslator

  return localizeValue(t, value)
}
