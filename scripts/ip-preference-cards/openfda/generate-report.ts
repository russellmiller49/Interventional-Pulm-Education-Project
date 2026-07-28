import { readFile } from 'node:fs/promises'

import { openFdaEnrichmentProposalsSchema } from './schemas'
import { writeOpenFdaCsvReports } from './csv'

const DEFAULT_OUTPUT_DIRECTORY = 'data/ip-preference-cards/generated/openfda'

export async function generateOpenFdaReports(
  outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
): Promise<number> {
  let proposalText: string
  try {
    proposalText = await readFile(`${outputDirectory}/enrichment-proposals.json`, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'No openFDA proposal file exists. Run ip-cards:openfda:query successfully before generating reports.',
      )
    }
    throw error
  }
  const proposals = openFdaEnrichmentProposalsSchema.parse(JSON.parse(proposalText) as unknown)
  await writeOpenFdaCsvReports(proposals, outputDirectory)
  return proposals.length
}

async function main() {
  const count = await generateOpenFdaReports()
  console.log(`Wrote deterministic openFDA CSV reports for ${count} proposals.`)
}

if (process.argv[1]?.endsWith('generate-report.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
