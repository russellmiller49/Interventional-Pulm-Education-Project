import { getStentModelAsset, stentExamples, stentModelAssets } from '../content/stentExamples'

describe('specific airway stent teaching examples', () => {
  it('maps every optimized model to a unique protected asset URL', () => {
    expect(stentModelAssets).toHaveLength(9)
    expect(new Set(stentModelAssets.map((asset) => asset.id)).size).toBe(stentModelAssets.length)
    expect(new Set(stentModelAssets.map((asset) => asset.url)).size).toBe(stentModelAssets.length)

    for (const asset of stentModelAssets) {
      expect(asset.url).toMatch(/^\/airway-stent-mechanics\/models\/v1\/.+\.glb\?rev=\d{8}\.\d+$/)
      expect(asset.sourceFile).toMatch(/\.glb$/)
      expect(asset.triangleBudget).toBeLessThanOrEqual(120_000)
      expect(asset.morphTargets.length).toBeGreaterThan(0)
    }
  })

  it('keeps covered and uncovered pair relationships symmetric', () => {
    const pairedAssets = stentModelAssets.filter((asset) => asset.pairedAssetId)
    expect(pairedAssets).toHaveLength(6)
    for (const asset of pairedAssets) {
      const pair = getStentModelAsset(asset.pairedAssetId!)
      expect(pair.pairedAssetId).toBe(asset.id)
      expect(pair.family).toBe(asset.family)
      expect(pair.coverage).not.toBe(asset.coverage)
    }
  })

  it('requires commitment for six distinct source-grounded examples', () => {
    expect(stentExamples).toHaveLength(6)
    expect(new Set(stentExamples.map((example) => example.sceneKind)).size).toBe(6)
    for (const example of stentExamples) {
      expect(example.choices).toHaveLength(3)
      expect(example.choices.some((choice) => choice.id === example.correctChoiceId)).toBe(true)
      expect(example.assetIds).toContain(example.defaultAssetId)
      expect(example.explanation.length).toBeGreaterThan(100)
      expect(example.markerLabels).toHaveLength(3)
      expect(example.teachingPoints).toHaveLength(3)
      expect(example.sourceRefs.length).toBeGreaterThan(0)
      expect(example.boundary.length).toBeGreaterThan(80)
    }
  })
})
