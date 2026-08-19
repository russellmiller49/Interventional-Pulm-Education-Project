import enMessages from '../../../../messages/en.json'
import esMessages from '../../../../messages/es.json'
import zhCnMessages from '../../../../messages/zh-CN.json'
import manufacturersJson from '../../../../data/ip-preference-cards/generated/manufacturers.json'

import {
  DEVICE_CLASS_CODES,
  DEVICE_SUBTYPE_CLASS,
  DEVICE_SUBTYPE_CODES,
  FALLBACK_DEVICE_CLASS,
  FALLBACK_DEVICE_SUBTYPE,
  deviceClassOfSubtype,
  isDeviceClassCode,
  isDeviceSubtypeCode,
} from '@/features/device-intelligence/domain/product-taxonomy'

/**
 * The D2C controlled vocabulary itself: the class/subtype code space, its ownership
 * relation, and the owner's structural rules — the primary facet answers "what kind of
 * device is this", so procedure domains, clinical applications, workflows, manufacturers,
 * and brand families are all barred from being device classes.
 */

const locales: [string, unknown][] = [
  ['en', enMessages],
  ['es', esMessages],
  ['zh-CN', zhCnMessages],
]

function taxonomyMessages(messages: unknown): {
  classes: Record<string, string>
  subtypes: Record<string, string>
} {
  return (
    messages as {
      deviceIntelligence: {
        taxonomy: { classes: Record<string, string>; subtypes: Record<string, string> }
      }
    }
  ).deviceIntelligence.taxonomy
}

describe('D2C taxonomy vocabulary', () => {
  it('holds the owner target of roughly 15–35 top-level classes', () => {
    expect(DEVICE_CLASS_CODES.length).toBeGreaterThanOrEqual(15)
    expect(DEVICE_CLASS_CODES.length).toBeLessThanOrEqual(35)
    expect(new Set(DEVICE_CLASS_CODES).size).toBe(DEVICE_CLASS_CODES.length)
  })

  it('maps every subtype to exactly one existing class', () => {
    expect(DEVICE_SUBTYPE_CODES.length).toBeGreaterThan(0)
    expect(new Set(DEVICE_SUBTYPE_CODES).size).toBe(DEVICE_SUBTYPE_CODES.length)
    for (const subtype of DEVICE_SUBTYPE_CODES) {
      const owner = deviceClassOfSubtype(subtype)
      expect(isDeviceClassCode(owner)).toBe(true)
      expect(DEVICE_SUBTYPE_CLASS[subtype]).toBe(owner)
    }
    expect(deviceClassOfSubtype(FALLBACK_DEVICE_SUBTYPE)).toBe(FALLBACK_DEVICE_CLASS)
  })

  it('recognizes exactly its own codes', () => {
    for (const code of DEVICE_CLASS_CODES) expect(isDeviceClassCode(code)).toBe(true)
    for (const code of DEVICE_SUBTYPE_CODES) expect(isDeviceSubtypeCode(code)).toBe(true)
    expect(isDeviceClassCode('Airway stenting')).toBe(false)
    expect(isDeviceClassCode('Flexible bronchoscopy')).toBe(false)
    expect(isDeviceClassCode('airway_stenting')).toBe(false)
    expect(isDeviceClassCode('flexible_bronchoscopy')).toBe(false)
    expect(isDeviceSubtypeCode('bronchoscope')).toBe(false)
  })

  it.each(locales)(
    'carries exactly one %s label per class and subtype code',
    (_locale, messages) => {
      const { classes, subtypes } = taxonomyMessages(messages)
      expect(Object.keys(classes).sort()).toEqual([...DEVICE_CLASS_CODES].sort())
      expect(Object.keys(subtypes).sort()).toEqual([...DEVICE_SUBTYPE_CODES].sort())
      for (const label of [...Object.values(classes), ...Object.values(subtypes)]) {
        expect(label.trim().length).toBeGreaterThan(0)
      }
    },
  )

  it('bars procedure domains and clinical applications from being device classes', () => {
    // The production defects this phase corrects, plus the owner's explicit list: these
    // are clinical applications or procedure domains, never physical device classes.
    const bannedClassConcepts = [
      'Airway stenting',
      'Flexible bronchoscopy',
      'Rigid bronchoscopy',
      'Therapeutic bronchoscopy',
      'Peripheral bronchoscopy',
      'Peripheral navigation',
      'Pleural procedures',
      'Medical thoracoscopy',
      'Bronchoscopic lung volume reduction',
      'Airway dilation',
      'Airway isolation',
      'Airway management',
      'Pleurodesis',
      'Sampling',
      'Reprocessing',
      'Retrieval',
    ]
    const enClasses = Object.values(taxonomyMessages(enMessages).classes)
    for (const banned of bannedClassConcepts) {
      // Exact label identity: a class label may legitimately CONTAIN a word like
      // "reprocessing" ("Reprocessing and cleaning equipment" names the equipment, not
      // the workflow), but the bare application phrase is not a class.
      expect(enClasses).not.toContain(banned)
    }
  })

  it('never names a class or subtype after a manufacturer or brand', () => {
    // Whole-word matching: the manufacturer "Thoracent" must not falsely hit inside the
    // ordinary clinical word "thoracentesis".
    const manufacturerPatterns = (manufacturersJson as { manufacturer: string }[])
      .map((row) => row.manufacturer)
      .filter((name) => name.length >= 4)
      .map((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
    const { classes, subtypes } = taxonomyMessages(enMessages)
    for (const label of [...Object.values(classes), ...Object.values(subtypes)]) {
      for (const pattern of manufacturerPatterns) {
        expect({ label, pattern: pattern.source, hit: pattern.test(label) }).toEqual({
          label,
          pattern: pattern.source,
          hit: false,
        })
      }
    }
  })
})
