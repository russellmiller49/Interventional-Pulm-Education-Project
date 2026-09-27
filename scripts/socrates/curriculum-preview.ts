/** Offline author-review pool. This is not a database case bootstrap or study import. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectWorkbook, privateOutput, readProvider } from './bootstrap-io'
import { bootstrapCatalogSchema } from './bootstrap-plan'
import {
  getInvenioPair,
  INVENIO_DEMO_ORIGIN,
} from '../../src/features/socrates-builder/invenio-source'
import { parseDziDescriptorXml } from '../../src/features/socrates-builder/descriptor'
import {
  emptyAuthorContent,
  emptyCaseContent,
} from '../../src/features/socrates-builder/case-content'
import { curriculumSourceSchema } from '../../src/features/socrates-builder/curriculum-source'
import {
  narrativeIssues,
  narrativeTeaching,
} from '../../src/features/socrates-builder/learner-narrative'
import { collectionSchema } from '../../src/features/socrates-learning/model'
import type { SocratesCaseDocument } from '../../src/features/socrates-builder/types'
import { imageSourceKey } from './import-plan'

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--workbook' || args[2] !== '--output')
    throw new Error(
      'Usage: curriculum-preview.ts --workbook <xlsx> --output <new private JSON outside Git>',
    )
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const source = inspectWorkbook(args[1], root)
  const catalog = bootstrapCatalogSchema.parse(
    JSON.parse(await readProvider(`${INVENIO_DEMO_ORIGIN}/generated/catalog.json`)),
  )
  const slides = catalog.cases.flatMap((item) => item.slides)
  const documents: SocratesCaseDocument[] = []
  // Bounded provider reads, with source order restored below.
  for (let offset = 0; offset < source.records.length; offset += 4) {
    const batch = await Promise.all(
      source.records.slice(offset, offset + 4).map(async (record) => {
        const matches = slides.filter(
          (slide) =>
            Number(slide.caseNumber) === Number(record.identity.caseNumberAsWritten) &&
            Number(slide.series) === Number(record.identity.seriesNumberAsWritten),
        )
        if (matches.length !== 1)
          throw new Error(`Source row ${record.sourceRow}: image identity is missing or ambiguous.`)
        const match = matches[0]
        const pair = getInvenioPair(`${INVENIO_DEMO_ORIGIN}/slides/${match.id}`)
        if (
          !pair ||
          imageSourceKey(pair.tissueUrl) !== record.identity.key ||
          new URL(match.originalDzi, `${INVENIO_DEMO_ORIGIN}/`).href !== pair.tissueUrl ||
          new URL(match.analysisDzi, `${INVENIO_DEMO_ORIGIN}/`).href !== pair.annotatedUrl ||
          !pair.id.endsWith(`-barcode-${match.barcode.toLowerCase()}`)
        )
          throw new Error(`Source row ${record.sourceRow}: provider pair does not match.`)
        const [tissue, color] = await Promise.all(
          [pair.tissueUrl, pair.annotatedUrl].map(async (url) =>
            parseDziDescriptorXml(await readProvider(url)),
          ),
        )
        if (tissue.width !== color.width || tissue.height !== color.height)
          throw new Error('Paired image dimensions disagree.')
        const narrative = record.sourceValues['Full Learner-Facing Text']
        if (narrativeIssues(narrative).length)
          throw new Error(`Source row ${record.sourceRow}: narrative needs manual review.`)
        const number = String(record.sourceValues['Overall Order']).padStart(2, '0')
        const author = emptyAuthorContent()
        // Membership/retention decisions stay unresolved. No saved record is created,
        // updated, reconciled, made eligible, or promoted by this local preview pool.
        author.readiness.holdReason =
          record.membershipHold ?? 'Preview only; release allocation and author review pending.'
        author.readiness.technicalHold = Boolean(record.membershipHold)
        author.curriculumSource = curriculumSourceSchema.parse({
          workbookSha256: record.workbookSha256,
          sourceSheet: record.sourceSheet,
          sourceRow: record.sourceRow,
          sourceValues: record.sourceValues,
        })
        return {
          schemaVersion: 2,
          slug: `socrates-preview-${number}`,
          title: `Slide ${number}`,
          workflowStatus: 'draft',
          revision: 0,
          annotations: [],
          slide: {
            id: pair.id,
            descriptorUrl: pair.tissueUrl,
            expectedDimensions: { width: tissue.width, height: tissue.height },
            initialImageRect: { x: 0, y: 0, width: tissue.width, height: tissue.height },
            attribution: { label: 'Invenio Imaging · UCSD Slide Viewer', href: pair.viewerUrl },
            contentStatus: 'Teaching content awaiting author review.',
          },
          caseContent: {
            ...emptyCaseContent(),
            learnerNarrative: narrative,
            ...narrativeTeaching(narrative),
          },
          authorContent: author,
        } satisfies SocratesCaseDocument
      }),
    )
    documents.push(...batch)
  }
  const result = collectionSchema.parse({
    format: 'socrates-local-curriculum-v1',
    title: 'SOCRATES slide curriculum',
    documents,
  })
  privateOutput(args[3], result)
  console.log(
    JSON.stringify({
      slides: documents.length,
      modules: source.modules.length,
      annotations: 0,
      databaseWrites: 0,
      eligibilityEnabled: 0,
      purpose: 'local author preview; allocation pending',
    }),
  )
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Preview generation failed.')
  process.exitCode = 1
})
