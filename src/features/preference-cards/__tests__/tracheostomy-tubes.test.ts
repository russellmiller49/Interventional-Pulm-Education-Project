import { getUseDetail, searchProductFamiliesForRole } from '../server/catalog'
import bivonaSeed from '../../../../data/ip-preference-cards/seed/bivona-catalog.json'
import portexSeed from '../../../../data/ip-preference-cards/seed/portex-bluselect-catalog.json'

/**
 * Cuff status, fenestration, and subglottic suction decide which tube a physician pulls.
 * Both catalogues state them only in a table title, and both PDFs have text layers that
 * garble or drop those titles — the Bivona rows were corrupted by image captions bleeding
 * into the table, and the Portex titles do not appear in the text layer at all. These tests
 * pin the transcription so a re-parse cannot quietly reclassify a tube.
 */

interface SeedTube {
  productCode: string
  family: string
  cuffType: 'cuffed' | 'cuffless'
  tubeSizeMm: number
  innerDiameterMm: number
  outerDiameterMm: number | null
  tubeLengthMm: number | null
}

const bivonaTubes = (bivonaSeed as { tubes: SeedTube[] }).tubes
const portexTubes = (
  portexSeed as {
    tubes: (SeedTube & { roleCode: string; fenestrated: boolean; subglotticSuction: boolean })[]
  }
).tubes

describe('tracheostomy tube transcription', () => {
  it('never derives cuff status from the word "cuffed"', () => {
    // Fome-Cuf, Aire-Cuf and TTS are cuffed lines whose names do not say so; Cuffless and
    // Uncuffed lines are the only cuffless ones.
    for (const tube of bivonaTubes) {
      const line = tube.family.toLowerCase()
      const expected =
        /cuffless|uncuffed/.test(line) && !/fome-cuf|aire-cuf|\btts\b/.test(line)
          ? 'cuffless'
          : 'cuffed'
      expect({ code: tube.productCode, cuff: tube.cuffType }).toEqual({
        code: tube.productCode,
        cuff: expected,
      })
    }
  })

  it('keeps every tube physically possible', () => {
    for (const tube of [...bivonaTubes, ...portexTubes]) {
      expect(tube.innerDiameterMm).toBeGreaterThan(0)
      expect(tube.innerDiameterMm).toBeLessThanOrEqual(12)
      // A product code leaking into the size column is what broke 855180 before.
      expect(tube.tubeSizeMm).toBeLessThanOrEqual(12)
      if (tube.outerDiameterMm !== null) {
        expect(tube.outerDiameterMm).toBeGreaterThan(tube.innerDiameterMm)
      }
      if (tube.tubeLengthMm !== null) expect(tube.tubeLengthMm).toBeGreaterThanOrEqual(25)
    }
  })

  it('has the complete Bivona Fome-Cuf Talk Attachment line', () => {
    // The line the caption artifact damaged: 855180 was mangled and 855170 lost entirely.
    const line = bivonaTubes
      .filter((tube) => tube.family.includes('with Talk Attachment'))
      .sort((left, right) => left.tubeSizeMm - right.tubeSizeMm)
    expect(line.map((tube) => tube.productCode)).toEqual([
      '855150',
      '855160',
      '855170',
      '855180',
      '855190',
    ])
    expect(
      line.map((tube) => [tube.innerDiameterMm, tube.outerDiameterMm, tube.tubeLengthMm]),
    ).toEqual([
      [5, 7.3, 60],
      [6, 8.7, 70],
      [7, 10, 80],
      [8, 11, 88],
      [9, 12.3, 98],
    ])
  })

  it('routes Portex tubes by cuff, fenestration, and subglottic suction', () => {
    const byPrefix = (prefix: string) =>
      portexTubes.filter((tube) => tube.productCode.startsWith(prefix))

    for (const [prefix, cuff, fenestrated, role] of [
      ['101/815', 'cuffed', false, 'TRACH_TUBE_CUFFED'],
      ['101/816', 'cuffless', false, 'TRACH_TUBE_CUFFLESS'],
      ['101/817', 'cuffed', true, 'TRACH_TUBE_CUFFED'],
      ['101/818', 'cuffless', true, 'TRACH_TUBE_CUFFLESS'],
      ['101/875', 'cuffed', false, 'TRACH_TUBE_EVAC'],
    ] as const) {
      const tubes = byPrefix(prefix)
      expect(tubes.length).toBeGreaterThan(0)
      for (const tube of tubes) {
        expect({
          code: tube.productCode,
          cuff: tube.cuffType,
          fenestrated: tube.fenestrated,
          role: tube.roleCode,
        }).toEqual({ code: tube.productCode, cuff, fenestrated, role })
      }
    }
    // Subglottic suction is exactly the Suctionaid line, and it must not sit in the plain
    // cuffed bucket where someone reaching for an Evac tube would miss it.
    expect(
      portexTubes
        .filter((tube) => tube.subglotticSuction)
        .map((tube) => tube.productCode)
        .sort(),
    ).toEqual(
      byPrefix('101/875')
        .map((tube) => tube.productCode)
        .sort(),
    )
  })

  it('excludes Portex inner cannulas, which have no role to reach them', () => {
    for (const prefix of ['101/851', '101/856', '101/858']) {
      expect(portexTubes.some((tube) => tube.productCode.startsWith(prefix))).toBe(false)
    }
  })

  it('surfaces both manufacturers as distinct product lines in the catalog', () => {
    const cuffed = searchProductFamiliesForRole({ roleCode: 'TRACH_TUBE_CUFFED', limit: 40 })
    expect(cuffed.some((family) => family.familyName.startsWith('Bivona'))).toBe(true)
    expect(cuffed.some((family) => family.familyName.startsWith('Portex BLUselect'))).toBe(true)

    const evac = getUseDetail('TRACH_TUBE_EVAC')
    const evacNames = (evac?.manufacturerGroups ?? []).flatMap((group) =>
      group.items.map((item) => item.productName),
    )
    expect(evacNames.some((name) => name.includes('Suctionaid'))).toBe(true)
  })
})
