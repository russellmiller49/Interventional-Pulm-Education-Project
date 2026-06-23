import { defaultLocale } from './locale'

/**
 * Select a locale-specific variant of a structured content value (e.g. learn
 * blocks, quiz questions) with an English fallback.
 *
 * Companion to next-intl `messages/*.json`: those hold UI chrome strings, while
 * large typed content arrays stay in TS and are localized through this helper so
 * we keep type-safety and don't break the data shape consumed by tests/engines.
 *
 * Pass the English value under `en`; add `es` / `zh-CN` as translations land.
 * Any locale without a variant falls back to English.
 */
export function pickLocaleContent<T>(
  locale: string,
  variants: { en: T } & Partial<Record<string, T>>,
): T {
  return variants[locale] ?? variants[defaultLocale] ?? variants.en
}
