import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { createTranslator } from 'use-intl'

import enMessages from '../../../../messages/en.json'
import esMessages from '../../../../messages/es.json'
import zhCnMessages from '../../../../messages/zh-CN.json'

const locales = [
  ['en', enMessages],
  ['es', esMessages],
  ['zh-CN', zhCnMessages],
] as const

function namespaceOf(messages: unknown): Record<string, unknown> {
  return (messages as { deviceIntelligence: Record<string, unknown> }).deviceIntelligence
}

function flatten(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function icuArgumentNames(message: string): string[] {
  const names = new Set<string>()
  for (const match of message.matchAll(/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/g)) {
    names.add(match[1])
  }
  return [...names].sort()
}

describe('deviceIntelligence message bundles', () => {
  it('keeps complete key parity across all three locales', () => {
    const enKeys = flatten(namespaceOf(enMessages))
      .map(([key]) => key)
      .sort()
    expect(enKeys.length).toBeGreaterThan(100)
    for (const [locale, messages] of locales) {
      const keys = flatten(namespaceOf(messages))
        .map(([key]) => key)
        .sort()
      expect({ locale, keys }).toEqual({ locale, keys: enKeys })
    }
  })

  it('keeps identical ICU argument names across locales', () => {
    const enArgs = new Map(
      flatten(namespaceOf(enMessages)).map(([key, message]) => [key, icuArgumentNames(message)]),
    )
    for (const [locale, messages] of locales) {
      for (const [key, message] of flatten(namespaceOf(messages))) {
        expect({ locale, key, args: icuArgumentNames(message) }).toEqual({
          locale,
          key,
          args: enArgs.get(key),
        })
      }
    }
  })

  it.each(locales)('formats every %s message under the real ICU formatter', (locale, messages) => {
    type LooseTranslator = (key: string, values?: Record<string, string | number>) => string
    const translate = createTranslator({
      locale,
      namespace: 'deviceIntelligence',
      messages,
      onError: (error: Error) => {
        throw error
      },
    } as never) as unknown as LooseTranslator

    const sampleValue = (name: string): string | number =>
      /count|total|rows|carried|preferred|required|contingency|optional/i.test(name) ? 2 : 'sample'

    const failures: string[] = []
    for (const [key, message] of flatten(namespaceOf(messages))) {
      const values = Object.fromEntries(
        icuArgumentNames(message).map((name) => [name, sampleValue(name)]),
      )
      try {
        const rendered = translate(key, values)
        if (typeof rendered === 'string' && /\{\s*[a-zA-Z_]/.test(rendered)) {
          failures.push(`${key}: left an unformatted placeholder in "${rendered}"`)
        }
      } catch (error) {
        failures.push(`${key}: ${(error as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })
})

describe('deviceIntelligence message call sites', () => {
  const REPO_ROOT = join(__dirname, '../../../..')
  const SOURCE_DIRS = [
    join(REPO_ROOT, 'src/app/[locale]/devices'),
    join(REPO_ROOT, 'src/app/[locale]/clinical-roles'),
    join(REPO_ROOT, 'src/app/[locale]/procedures'),
    join(REPO_ROOT, 'src/features/device-intelligence/components'),
  ]

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) return sourceFiles(path)
      return /\.tsx?$/.test(entry) ? [path] : []
    })
  }

  it('never renders a parameterized message without its arguments', () => {
    // The exact failure mode the browser walkthrough caught once: a `{count, plural, …}`
    // message used as a bare aria-label throws FORMATTING_ERROR at request time.
    const allEntries = flatten(namespaceOf(enMessages))
    const parameterlessSuffixes = new Set(
      allEntries
        .filter(([, message]) => icuArgumentNames(message).length === 0)
        .flatMap(([key]) => {
          const segments = key.split('.')
          return segments.map((_, index) => segments.slice(index).join('.'))
        }),
    )
    const parameterizedKeys = allEntries
      .filter(([, message]) => icuArgumentNames(message).length > 0)
      .map(([key]) => key)
    const sources = SOURCE_DIRS.flatMap(sourceFiles).map((path) => ({
      path: path.slice(REPO_ROOT.length + 1),
      text: readFileSync(path, 'utf8'),
    }))
    const offenders: string[] = []
    for (const key of parameterizedKeys) {
      const segments = key.split('.')
      // A suffix that is also a complete suffix of some parameterless key is ambiguous
      // across translator scopes and cannot be flagged from text alone.
      const suffixes = segments
        .map((_, index) => segments.slice(index).join('.'))
        .filter((suffix) => !parameterlessSuffixes.has(suffix))
        .map((suffix) => suffix.replaceAll('.', '\\.'))
      if (suffixes.length === 0) continue
      const bareCall = new RegExp(
        `\\bt(?:Common|Workspace|CrossLinks)?\\(\\s*'(?:${suffixes.join('|')})'\\s*\\)`,
      )
      for (const source of sources) {
        if (bareCall.test(source.text)) offenders.push(`${source.path}: t('${key}')`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('D2D localized regulatory wording', () => {
  it('pins every required English conclusion label without calling 510(k) clearance approval', () => {
    expect(enMessages.deviceIntelligence.d2d.regulatory.conclusion).toEqual({
      cleared_510k: '510(k) cleared',
      approved_pma: 'PMA approved',
      granted_de_novo: 'De Novo granted',
      approved_hde: 'HDE approved',
      premarket_exempt_classification: 'Premarket-exempt classification',
      fda_listed_device: 'FDA-listed device',
      exact_identity_unresolved: 'Exact regulatory identity unresolved',
      not_yet_researched: 'Exact regulatory profile not yet researched',
    })
    expect(enMessages.deviceIntelligence.d2d.regulatory.conclusion.cleared_510k).not.toMatch(
      /approv/i,
    )
  })

  it('uses genuine Spanish and Simplified Chinese chrome and preserves clearance/approval distinctions', () => {
    const english = enMessages.deviceIntelligence.d2d
    const spanish = esMessages.deviceIntelligence.d2d
    const chinese = zhCnMessages.deviceIntelligence.d2d

    for (const localized of [spanish, chinese]) {
      expect(localized.profile.heading).not.toBe(english.profile.heading)
      expect(localized.regulatory.heading).not.toBe(english.regulatory.heading)
      expect(localized.profile.contentLanguageNotice).not.toBe(
        english.profile.contentLanguageNotice,
      )
      expect(localized.regulatory.commercialDistributionDisclaimer).not.toBe(
        english.regulatory.commercialDistributionDisclaimer,
      )
      expect(localized.fallback.profileUnavailable).not.toBe(english.fallback.profileUnavailable)
    }

    expect(spanish.regulatory.conclusion.cleared_510k).toContain('autorización')
    expect(spanish.regulatory.conclusion.cleared_510k).not.toContain('aprobado')
    expect(spanish.regulatory.conclusion.approved_pma).toContain('aprobado')
    expect(chinese.regulatory.conclusion.cleared_510k).toContain('许可')
    expect(chinese.regulatory.conclusion.approved_pma).toContain('批准')
  })
})

describe('deviceIntelligence copy safety', () => {
  const BANNED = [
    /equivalen/i,
    /interchangeab/i,
    /substitut/i,
    /alternative to/i,
    /replacement for/i,
  ]

  /**
   * Keys whose copy is REQUIRED to name equivalence/substitution in order to deny it —
   * the mandatory discovery-fact captions. Each must carry an explicit negation.
   */
  const DISCLAIMER_KEYS = new Set([
    'common.noEquivalenceNote',
    'device.rolesDiscoveryNote',
    'device.displayOnlyGroupingNote',
    'device.roleDiscoveryCaption',
    // D2C: the taxonomy caption must name equivalence/substitution in order to deny it.
    'device.taxonomy.discoveryNote',
    'role.membershipNote',
    'readiness.noProcurementNote',
  ])

  /**
   * FDA's 510(k) decision vocabulary is a regulatory determination, not a claim that two Atlas
   * products are clinically equivalent or substitutable. Keep the exception closed to these two
   * pathway-decision labels; profile prose and every other UI string still pass the stricter wall.
   */
  const REGULATORY_DETERMINATION_KEYS = new Set([
    'd2d.regulatory.pathwayDecision.substantially_equivalent',
    'd2d.regulatory.pathwayDecision.not_substantially_equivalent',
  ])

  it('asserts no equivalence or substitution claim outside the explicit disclaimers', () => {
    for (const [, messages] of locales) {
      for (const [key, message] of flatten(namespaceOf(messages))) {
        const hits = BANNED.filter((pattern) => pattern.test(message))
        if (hits.length === 0) continue
        if (REGULATORY_DETERMINATION_KEYS.has(key)) continue
        expect({ key, allowed: DISCLAIMER_KEYS.has(key) }).toEqual({ key, allowed: true })
        // A disclaimer must deny the relationship, never assert it.
        expect(/\bnot\b|\bnever\b|\bno\b/i.test(message)).toBe(true)
      }
    }
  })

  it('confines substantially-equivalent wording to the closed 510(k) decision vocabulary', () => {
    for (const [, messages] of locales) {
      const keys = flatten(namespaceOf(messages))
        .filter(([, message]) => /equivalen/i.test(message))
        .map(([key]) => key)
      for (const key of keys) {
        expect(DISCLAIMER_KEYS.has(key) || REGULATORY_DETERMINATION_KEYS.has(key)).toBe(true)
      }
    }
  })

  it('carries the mandatory related-product wording verbatim', () => {
    const en = namespaceOf(enMessages) as {
      device: { sameLineHeading: string; otherManufacturersHeading: string }
    }
    expect(en.device.sameLineHeading).toBe('Same manufacturer product line')
    expect(en.device.otherManufacturersHeading).toBe(
      'Other manufacturers with products mapped to this clinical role',
    )
  })

  it('carries the mandatory demo and draft watermark texts', () => {
    const en = namespaceOf(enMessages) as {
      readiness: { demoTitle: string }
      common: { draftTitle: string }
    }
    expect(en.readiness.demoTitle).toBe('DEMO DATA — NOT AN ACTUAL INSTITUTION')
    expect(en.common.draftTitle).toBe('DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE')
  })

  it('never presents the empty formulary as institutional data', () => {
    const en = namespaceOf(enMessages) as {
      readiness: { realFormularyHeadline: string; realFormularyNote: string }
    }
    expect(en.readiness.realFormularyHeadline).toContain('no institutional data')
    expect(en.readiness.realFormularyNote).toContain('not institutional data')
  })
})
