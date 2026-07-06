import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import {
  canEmbedPleuralAsset,
  pleuralModuleSourceRegistry,
} from '@/features/pleural-procedures/content/sourceRegistry'

import {
  pleuralDatasetCases,
  pleuralDatasetCollections,
  publicPleuralDatasetCases,
} from '../content/datasetCases'

function publicAssetPath(path: string) {
  return join(process.cwd(), 'public', path.replace(/^\//, ''))
}

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

describe('pleural dataset lab cases', () => {
  it('embeds only reviewed CC BY raw snapshot assets', () => {
    expect(publicPleuralDatasetCases).toHaveLength(pleuralDatasetCases.length)

    for (const caseItem of publicPleuralDatasetCases) {
      expect(caseItem.sourceType).toBe('dataset')
      expect(caseItem.license).toBe('CC BY 4.0')
      expect(caseItem.reusePolicy).toBe('embeddable')
      expect(caseItem.reviewStatus).toBe('reviewed')
      expect(caseItem.permissionStatus).toBe('granted-by-license')
      expect(canEmbedPleuralAsset(caseItem)).toBe(true)
    }
  })

  it('keeps every copied raw image present with its recorded checksum', () => {
    for (const caseItem of pleuralDatasetCases) {
      const path = publicAssetPath(caseItem.path)

      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path)).toHaveLength(caseItem.sizeBytes)
      expect(sha256(path)).toBe(caseItem.sha256)
    }
  })

  it('links cases to valid source registry entries and clinical references', () => {
    const sourceIds = new Set(pleuralModuleSourceRegistry.map((source) => source.id))
    const referenceIds = new Set(pleuralReferences.map((reference) => reference.id))

    for (const caseItem of pleuralDatasetCases) {
      expect(sourceIds.has(caseItem.sourceRegistryId)).toBe(true)
      expect(caseItem.referenceIds?.length).toBeGreaterThan(0)

      for (const referenceId of caseItem.referenceIds ?? []) {
        expect(referenceIds.has(referenceId)).toBe(true)
      }
    }
  })

  it('covers the currently imported Mendeley source labels', () => {
    expect(pleuralDatasetCollections).toHaveLength(1)
    expect(pleuralDatasetCases).toHaveLength(4)
    expect(new Set(pleuralDatasetCases.map((caseItem) => caseItem.groundTruth))).toEqual(
      new Set([
        'large-simple-effusion',
        'consolidation-no-pleural-target',
        'b-lines-no-pleural-target',
        'normal-no-pleural-target',
      ]),
    )
    expect(JSON.stringify(pleuralDatasetCases)).not.toContain('figshare')
  })

  it('keeps source metadata labels separate from pleural teaching targets', () => {
    const largeEffusion = pleuralDatasetCases.find(
      (caseItem) => caseItem.id === 'mendeley-raw-effusion-lower-posterior',
    )

    expect(largeEffusion).toMatchObject({
      groundTruth: 'large-simple-effusion',
      groundTruthLabel: 'Large simple effusion',
      sourceImageName: 'RT_LOWER_POST_LONG-12_30_33.png',
      metadataLookupKey: 'RT_LOWER_POST_LONG-12_30_33.png',
      sourceFindingLabel: 'Effusion',
      sourceRecordClass: 'Diseased lung but probably Not Covid',
      metadataReview: {
        worksheet: 'metadata.xlsx / sheet1',
        row: '19',
        imageColumn: 'AA Lower Posterior (Longitudinal)',
        findingColumn: 'AB Findings for Lower Posterior (Longitudinal)',
        findingValue: 'Effusion',
        positiveFlag: 'AF Findings for Lower Posterior (Longitudinal)/Effusion = 1',
      },
    })

    for (const caseItem of pleuralDatasetCases) {
      expect(caseItem.sourceFindingLabel).toEqual(expect.any(String))
      expect(caseItem.sourceImageName).toEqual(expect.any(String))
      expect(caseItem.metadataLookupKey).toEqual(expect.any(String))
      expect(caseItem.sourceRecordClass).toEqual(expect.any(String))
      expect(caseItem.metadataReview.row).toEqual(expect.any(String))
      expect(caseItem.metadataReview.findingValue).toEqual(expect.any(String))
    }
  })

  it('does not carry source workbook free text or patient names into app metadata', () => {
    const metadata = JSON.stringify(pleuralDatasetCases)

    expect(metadata).not.toContain('Patient Number')
    expect(metadata).not.toContain('Radiologist')
    expect(metadata).not.toContain('diagnosis free text')
    expect(metadata).not.toContain('姓名')
    expect(metadata).not.toContain('病理诊断')
    expect(metadata).not.toContain('描述')
  })

  it('keeps collection snapshot counts in sync with case data', () => {
    for (const collection of pleuralDatasetCollections) {
      expect(
        pleuralDatasetCases.filter((caseItem) => caseItem.sourceRegistryId === collection.id),
      ).toHaveLength(collection.snapshotCount)
      expect(collection.archiveSizeBytes).toBeGreaterThan(0)
      expect(collection.rawImageCount).toBeGreaterThanOrEqual(collection.snapshotCount)
    }
  })
})
