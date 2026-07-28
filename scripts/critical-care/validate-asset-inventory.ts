import {
  criticalCareAssetInventorySchema,
  criticalCareAssets,
} from '../../src/features/critical-care/content/assets'

const validated = criticalCareAssetInventorySchema.parse(criticalCareAssets)
const heavy = validated.filter((asset) => asset.bandwidthClass === 'heavy')
const alternatives = new Set(validated.map((asset) => asset.id))

for (const asset of heavy) {
  if (
    !asset.lightweightAlternativeAssetId ||
    !alternatives.has(asset.lightweightAlternativeAssetId)
  ) {
    throw new Error(`Heavy asset ${asset.id} does not resolve a lightweight alternative.`)
  }
}

process.stdout.write(
  `Validated ${validated.length} critical-care assets (${heavy.length} heavy assets with alternatives).\n`,
)
