/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { IMAGING_HUB_HERO, validateImagingHubHero } from '../content/hubHero'
import { CHAIN_STOPS } from '../content/imagingChain'

describe('the hub picture', () => {
  it('validates clean at import', () => {
    expect(validateImagingHubHero()).toEqual([])
  })

  it('declares the size the file actually has', () => {
    // The still is re-rendered by a script the hub does not own. If it comes back at another size,
    // a stale declaration here would stretch it; read the PNG header rather than trust the number.
    const png = readFileSync(path.join(process.cwd(), 'public', IMAGING_HUB_HERO.src))
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(IMAGING_HUB_HERO.width)
    expect(png.readUInt32BE(20)).toBe(IMAGING_HUB_HERO.height)
  })

  it('says where every stop of the chain is, and no stop the chain does not have', () => {
    expect(Object.keys(IMAGING_HUB_HERO.where).sort()).toEqual(
      CHAIN_STOPS.map((stop) => stop.id).sort(),
    )
  })
})
