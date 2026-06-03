import { canEmbedPleuralAsset, pleuralModuleSourceRegistry } from './sourceRegistry'
import type { PleuralAsset } from './types'

type TestPolicyAsset = Pick<
  PleuralAsset,
  'license' | 'reusePolicy' | 'permissionStatus' | 'reviewStatus'
>

const reviewedEmbeddableAsset: TestPolicyAsset = {
  license: 'CC BY 4.0',
  reusePolicy: 'embeddable',
  permissionStatus: 'granted-by-license',
  reviewStatus: 'reviewed',
}

describe('pleural source registry', () => {
  it('tracks the requested external source triage set', () => {
    expect(pleuralModuleSourceRegistry.map((source) => source.id)).toEqual([
      'mendeley-lus-katumba-2025',
      'figshare-lung-ultrasound-2025',
      'jannisborn-covid19-ultrasound',
      'mendeley-lus-raw-snapshot-2026-06-03',
      'figshare-lung-ultrasound-raw-snapshot-2026-06-03',
      'nrc-cnrc-covid-us',
      'covid-blues',
      'iame-sonoworld-archive',
      'gusi-pleural-effusion-videos',
    ])
  })

  it('embeds reviewed CC BY 4.0 assets by default', () => {
    expect(canEmbedPleuralAsset(reviewedEmbeddableAsset)).toBe(true)
  })

  it('blocks NC, ND, all-rights-reserved, mixed, and unknown assets by default', () => {
    const blockedLicenses: TestPolicyAsset['license'][] = [
      'CC BY-NC 4.0',
      'CC BY-NC-SA 4.0',
      'CC BY-NC-ND 4.0',
      'All rights reserved',
      'Mixed or row-level',
      'Unknown',
    ]

    for (const license of blockedLicenses) {
      expect(canEmbedPleuralAsset({ ...reviewedEmbeddableAsset, license })).toBe(false)
    }
  })

  it('allows explicitly permission-granted reviewed assets even when the default license is blocked', () => {
    expect(
      canEmbedPleuralAsset({
        ...reviewedEmbeddableAsset,
        license: 'All rights reserved',
        permissionStatus: 'permission-granted',
      }),
    ).toBe(true)
  })

  it('blocks assets that still need audit or are only reference sources', () => {
    expect(
      canEmbedPleuralAsset({
        ...reviewedEmbeddableAsset,
        reusePolicy: 'audit-required',
      }),
    ).toBe(false)
    expect(
      canEmbedPleuralAsset({
        ...reviewedEmbeddableAsset,
        reviewStatus: 'pending-audit',
      }),
    ).toBe(false)
    expect(
      canEmbedPleuralAsset({
        ...reviewedEmbeddableAsset,
        permissionStatus: 'reference-only',
      }),
    ).toBe(false)
  })
})
