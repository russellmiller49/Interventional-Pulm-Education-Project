/** @jest-environment node */
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import {
  ASSEMBLY_HOTSPOTS,
  ASSEMBLY_STEP_WORDS,
  catalogue,
  CLAIM_KINDS,
  EXPLORER_DEVICES,
  EXPLORER_WORDS,
  explorerDevice,
  kitModel,
  QUALITY_CLASS_WORDS,
} from '../../content/deviceExplorerCatalogue'
import { WOLF_PREVIEW_WORDS } from '../paths'

/**
 * The catalogue the preview ships was generated from the audited explorer commit; these tests hold
 * it to what that commit's own tests held the content to.
 */
// The sponsorship policy's promotional-wording rule (src/lib/sponsorship/policy.ts on the
// course's scaffold branch, not yet on main), applied here to the same words.
const PROMOTIONAL_WORDING =
  /\b(best|leading|superior|unrivalled|unrivaled|unique|unmatched|world-class|state-of-the-art|cutting-edge|revolutionary|innovative|optimal|optimum|maximum versatility|seamless|effortless|premium|trusted|preferred)\b/i

const PART_KIT = {
  telescope: 'operative-telescope',
  forceps: 'double-spoon-forceps',
  sleeve: 'trocar-sleeve-flexible',
} as const

function words(): string[] {
  const spots = [
    ...EXPLORER_DEVICES.flatMap((device) => device.hotspots),
    ...ASSEMBLY_HOTSPOTS.map((entry) => entry.spot),
  ]
  return [
    ...spots.flatMap((spot) => [
      spot.title,
      spot.description,
      ...spot.evidence.flatMap((row) => [
        row.label,
        row.value ?? '',
        row.detail ?? '',
        row.basis ?? '',
      ]),
    ]),
    ...EXPLORER_DEVICES.flatMap((device) => [
      device.title,
      device.status,
      device.presentationNote ?? '',
    ]),
    ...Object.values(CLAIM_KINDS).flatMap((kind) => [kind.title, kind.description]),
    ...Object.values(QUALITY_CLASS_WORDS).flatMap((word) => [word.title, word.description]),
    ...Object.values(ASSEMBLY_STEP_WORDS).flatMap((step) => [
      step.title,
      step.caption({
        sleeveSeatMm: 58.76,
        channelLengthMm: 291.5,
        sheathLengthMm: 330,
        sheathBeyondMm: 38.5,
        jawOpeningDeg: 44,
      }),
    ]),
    EXPLORER_WORDS.title,
    EXPLORER_WORDS.subtitle,
    EXPLORER_WORDS.assembly.together,
  ].filter((word) => word.length > 0)
}

describe('device explorer catalogue', () => {
  it('comes from the audited explorer commit', () => {
    expect(catalogue.provenance.explorerCommit).toBe('c6295d2aceafe59dd9bf088951cd13bad3daf45f')
  })

  it('holds the thirteen showcase models with classes and status', () => {
    expect(EXPLORER_DEVICES).toHaveLength(13)
    expect(
      EXPLORER_DEVICES.map((device) => device.qualityClass)
        .sort()
        .join(''),
    ).toBe('ABBBBBBBBBBBC')
    expect(explorerDevice('tower-blockout').status).toBe(
      'Illustrative blockout — awaiting manufacturer reference or CAD',
    )
    expect(explorerDevice('operative-telescope').status).toBe(
      'Parametric educational model — awaiting manufacturer fact-check',
    )
    for (const id of [
      'operative-telescope-illustrative-cutaway',
      'double-spoon-forceps',
      'dissection-forceps',
      'tower-blockout',
    ]) {
      expect(explorerDevice(id).presentationNote).toBeTruthy()
    }
  })

  it('puts every hotspot on an anchor its kit model holds', () => {
    for (const device of EXPLORER_DEVICES) {
      for (const spot of device.hotspots) {
        if (spot.node) continue
        expect(Object.keys(kitModel(device.kitModel!).anchors)).toContain(spot.anchor)
      }
    }
    for (const { part, spot } of ASSEMBLY_HOTSPOTS) {
      expect(Object.keys(kitModel(PART_KIT[part]).anchors)).toContain(spot.anchor)
    }
  })

  it('keeps the kinds of claim apart', () => {
    for (const device of EXPLORER_DEVICES) {
      for (const spot of device.hotspots) {
        for (const row of spot.evidence) {
          expect(Object.keys(CLAIM_KINDS)).toContain(row.kind)
          if (row.kind === 'derived') expect(row.value).toMatch(/±/)
          if (row.kind === 'sourced') expect(row.basis).toMatch(/^Manufacturer /)
        }
      }
    }
    expect(catalogue.values.sleeveSeatMm.category).toBe('derived measurement')
    expect(catalogue.values.channelLengthMm).toEqual({
      value: 291.5,
      category: 'derived measurement',
    })
    expect(catalogue.values.sheathLengthMm).toEqual({ value: 330, category: 'device fact' })
  })

  it('uses words the course gates accept, with no mark or internal vocabulary', () => {
    for (const word of words()) {
      expect({ word, flagged: flaggedLearnerCopyTerms(word) }).toEqual({ word, flagged: [] })
      expect(word).not.toMatch(PROMOTIONAL_WORDING)
      expect(word).not.toMatch(/wolf|eragon|endocam|R-DEVICE|NOT REVIEWED|packet|register/i)
    }
  })

  it('discloses the preview for what it is, and claims nothing it is not', () => {
    expect(WOLF_PREVIEW_WORDS.disclosure).toBe(
      'Development preview for manufacturer review. Parametric educational models; not manufacturer CAD. Device details remain subject to manufacturer fact-check.',
    )
    const all = JSON.stringify(WOLF_PREVIEW_WORDS)
    expect(all).not.toMatch(/approved|validated|manufacturer accurate|\bfinal\b|production ready/i)
  })
})
