import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { createTranslator } from 'use-intl'

import enMessages from '../../../../messages/en.json'
import esMessages from '../../../../messages/es.json'
import zhCnMessages from '../../../../messages/zh-CN.json'

/**
 * jest.setup.ts mocks next-intl with naive placeholder substitution, so a message needing
 * ICU arguments still "renders" in component tests while the real formatter throws
 * FORMATTING_ERROR in the browser. These tests check the message bundles directly:
 * every message carrying a placeholder must declare the arguments callers pass, and every
 * locale must keep the same argument names.
 *
 * The whole `preferenceCards` namespace is covered, not just `catalog.*` — the dashboard,
 * wizard, and admin messages are exactly as capable of throwing at render time.
 */

/**
 * Arguments the preference-card pages pass for each parameterized message. Adding a
 * placeholder to a message without adding it here fails the declaration test below.
 */
const parameterizedMessages: Record<string, string[]> = {
  catalogAlternatives: ['count', 'total'],
  curatedDefaults: ['count', 'total'],
  coverageFraction: ['count', 'total'],
  step: ['step', 'total'],
  searchLocalOptionsFor: ['requirement'],
  selectLocalOptionFor: ['requirement'],
  requirementExceptionCount: ['exceptions', 'requirements'],
  quantityValue: ['quantity'],
  localNumberValue: ['number'],
  duplicateTitle: ['title'],
  'customItem.descriptionPlaceholder': ['requirement'],
  'printNotes.unverifiedFootnote': ['count'],
  'printNotes.customFootnote': ['count'],
  'admin.page': ['page', 'pages'],
  'admin.eligibleProductCount': ['count'],
  'sets.memberCount': ['count'],
  'sets.roleCount': ['count'],
  'catalog.overviewCounts': ['products', 'manufacturers', 'uses'],
  'catalog.removeFilter': ['filter'],
  'catalog.resultCount': ['count'],
  'catalog.excludedMissingSpec': ['count'],
  'catalog.invalidFilterBody': ['filter'],
  'catalog.uses.countsLine': ['products', 'manufacturers', 'unverified'],
  'catalog.uses.manufacturerProducts': ['count', 'verified'],
  'catalog.uses.variantCount': ['count'],
  'catalog.uses.showEveryVariant': ['count'],
  'catalog.uses.groupByFamily': ['families'],
  'catalog.product.listedAs': ['name'],
  'catalog.picker.resultCount': ['count'],
  'catalog.picker.familyCount': ['count'],
  'catalog.picker.familyVariantCount': ['count'],
}

const locales = [
  ['en', enMessages],
  ['es', esMessages],
  ['zh-CN', zhCnMessages],
] as const

function preferenceCardMessages(messages: unknown): Record<string, unknown> {
  return (messages as { preferenceCards: Record<string, unknown> }).preferenceCards
}

function flatten(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

/**
 * Names of ICU arguments in a message. Matches `{name}`, `{name, number}`, and
 * `{name, plural, ...}` while ignoring plural bodies such as `{# products}`.
 */
function icuArgumentNames(message: string): string[] {
  const names = new Set<string>()
  for (const match of message.matchAll(/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/g)) {
    names.add(match[1])
  }
  return [...names].sort()
}

describe('preference-card message arguments', () => {
  it('declares every message that carries an ICU placeholder', () => {
    const undeclared = flatten(preferenceCardMessages(enMessages))
      .filter(([, message]) => icuArgumentNames(message).length > 0)
      .filter(([key]) => !(key in parameterizedMessages))
      .map(([key]) => key)
    expect(undeclared).toEqual([])
  })

  it('has no declared message that lost its placeholders', () => {
    const flat = new Map(flatten(preferenceCardMessages(enMessages)))
    for (const key of Object.keys(parameterizedMessages)) {
      expect(flat.has(key)).toBe(true)
      expect(icuArgumentNames(flat.get(key)!).length).toBeGreaterThan(0)
    }
  })

  it.each(locales)('supplies exactly the arguments %s messages require', (_locale, messages) => {
    const flat = new Map(flatten(preferenceCardMessages(messages)))
    for (const [key, declaredArgs] of Object.entries(parameterizedMessages)) {
      const message = flat.get(key)
      expect(message).toBeDefined()
      // Missing an argument throws FORMATTING_ERROR at render time; an extra one is dead weight.
      expect(icuArgumentNames(message!)).toEqual([...declaredArgs].sort())
    }
  })

  it.each(locales)('leaves argument-free %s messages free of placeholders', (_locale, messages) => {
    for (const [key, message] of flatten(preferenceCardMessages(messages))) {
      if (key in parameterizedMessages) continue
      expect({ key, args: icuArgumentNames(message) }).toEqual({ key, args: [] })
    }
  })
})

/**
 * The static checks above read the bundles; this one actually formats them.
 *
 * `createTranslator` from use-intl is the same formatter next-intl uses in the browser, so a
 * message whose ICU syntax is malformed — an unclosed brace, a plural without an `other`
 * arm, a locale missing a required plural category — fails here rather than at render time.
 * jest.setup.ts's next-intl mock cannot catch any of that.
 */
describe('preference-card messages format under the real ICU formatter', () => {
  /**
   * `createTranslator` is generic over the message bundle so call sites get key completion.
   * These tests deliberately iterate keys discovered at runtime, so the generic buys nothing
   * — one cast at the boundary keeps the loop readable.
   */
  type LooseTranslator = (key: string, values?: Record<string, string | number>) => string

  function translatorFor(locale: string, messages: unknown): LooseTranslator {
    return createTranslator({
      locale,
      namespace: 'preferenceCards',
      messages,
      // Surface a formatting failure instead of falling back to the key.
      onError: (error: Error) => {
        throw error
      },
    } as never) as unknown as LooseTranslator
  }

  // Values are shaped to the argument name: counts must be numeric for plural selection.
  function sampleValue(name: string): string | number {
    return /count|total|step|page|pages|percent|products|manufacturers|uses|unverified|verified|families|requirements|exceptions|quantity|number/i.test(
      name,
    )
      ? 1
      : 'sample'
  }

  it.each(locales)('formats every %s preference-card message', (locale, messages) => {
    const translate = translatorFor(locale, messages)

    const failures: string[] = []
    for (const [key, message] of flatten(preferenceCardMessages(messages))) {
      const values = Object.fromEntries(
        icuArgumentNames(message).map((name) => [name, sampleValue(name)]),
      )
      try {
        const rendered = translate(key, values)
        // A message that still shows its own placeholder never got formatted.
        if (typeof rendered === 'string' && /\{\s*[a-zA-Z_]/.test(rendered)) {
          failures.push(`${key}: left an unformatted placeholder in "${rendered}"`)
        }
      } catch (error) {
        failures.push(`${key}: ${(error as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })

  it.each([2, 0])('selects a plural arm for count = %i', (count) => {
    const translate = translatorFor('en', enMessages)
    for (const key of ['sets.memberCount', 'catalog.picker.familyVariantCount']) {
      expect(translate(key, { count })).toContain(String(count))
    }
  })
})

const REPO_ROOT = join(__dirname, '../../../..')
const PREFERENCE_CARD_SOURCE_DIRS = [
  join(REPO_ROOT, 'src/app/[locale]/preference-cards'),
  join(REPO_ROOT, 'src/app/[locale]/admin/preference-cards'),
  join(REPO_ROOT, 'src/features/preference-cards/components'),
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

describe('preference-card message call sites', () => {
  const sources = PREFERENCE_CARD_SOURCE_DIRS.flatMap(sourceFiles).map((path) => ({
    path: path.slice(REPO_ROOT.length + 1),
    text: readFileSync(path, 'utf8'),
  }))

  it('never renders a parameterized message without its arguments', () => {
    // `t('uses.manufacturerProducts')` with no values throws FORMATTING_ERROR at runtime.
    const offenders: string[] = []
    for (const key of Object.keys(parameterizedMessages)) {
      // A call site may be scoped to any ancestor namespace, so allow any leading segments
      // to be dropped: t('catalog.picker.resultCount'), t('picker.resultCount'), t('resultCount').
      const segments = key.split('.')
      const suffixes = segments.map((_, index) => segments.slice(index).join('\\.'))
      const bareCall = new RegExp(`\\bt\\(\\s*'(?:${suffixes.join('|')})'\\s*\\)`)
      for (const source of sources) {
        if (bareCall.test(source.text)) offenders.push(`${source.path}: t('${key}')`)
      }
    }
    expect(offenders).toEqual([])
  })
})
