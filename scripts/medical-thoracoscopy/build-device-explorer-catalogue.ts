/**
 * Build the device explorer's presentation catalogue from an audited explorer commit.
 *
 *   npx tsx scripts/medical-thoracoscopy/build-device-explorer-catalogue.ts [--from <commit>] [--check]
 *
 * The explorer's content is authored against the device definitions, the kit manifest and the
 * showcase register (branch `claude/mt-05b-device-explorer`). Those files carry internal review
 * notes, document titles with manufacturer marks, and rights wording that a reviewer-facing page
 * must not ship. This script extracts them at one commit with `git archive` (the working trees are
 * not read or changed), resolves every hotspot's evidence exactly as the explorer does, and writes
 * only what the explorer shows:
 *
 *   src/features/medical-thoracoscopy/content/data/generated/deviceExplorerCatalogue.ts
 *
 * The sleeve's seat on the telescope, a derived measurement held only in the owner's local data,
 * is read from the staging manifest `stage-device-showcase.ts` wrote.
 *
 * `--check` fails if the committed file differs from what the commit would produce.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import prettier from 'prettier'

const ROOT = path.resolve(__dirname, '../..')
const DEFAULT_COMMIT = 'c6295d2aceafe59dd9bf088951cd13bad3daf45f'
const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const COMMIT = option('--from') ?? DEFAULT_COMMIT
const CHECK = args.includes('--check')
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const STAGING_MANIFEST = path.join(
  LOCAL_DATA,
  'raw-assets/medical-thoracoscopy/devices/showcase/staged/manifest.json',
)
const OUT = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/generated/deviceExplorerCatalogue.ts',
)
// Inside the checkout so the extracted TypeScript resolves this checkout's node_modules.
const SOURCE = path.join(ROOT, 'node_modules/.cache/device-explorer-source')

const SOURCES = [
  'src/features/medical-thoracoscopy/content',
  'docs/medical-thoracoscopy/registers/device-showcase-register.json',
]

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function extract(): void {
  rmSync(SOURCE, { recursive: true, force: true })
  mkdirSync(SOURCE, { recursive: true })
  const archive = execFileSync('git', ['archive', '--format=tar', COMMIT, ...SOURCES], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  })
  execFileSync('tar', ['-x', '-C', SOURCE], { input: archive })
}

type Anchor = { position: readonly number[]; direction: readonly number[] }

async function main(): Promise<void> {
  const fullCommit = execFileSync('git', ['rev-parse', `${COMMIT}^{commit}`], { cwd: ROOT })
    .toString()
    .trim()
  extract()
  const content = path.join(SOURCE, 'src/features/medical-thoracoscopy/content')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const explorer = require(path.join(content, 'deviceExplorer.ts'))
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const showcase = require(path.join(content, 'deviceShowcase.ts'))
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const definitions = require(path.join(content, 'deviceDefinitions.ts'))
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const kit = require(path.join(content, 'data/generated/deviceKit.ts')).deviceKitManifest

  const resolveSpot = (
    spot: {
      id: string
      title: string
      anchor?: string
      node?: string
      description: string
      evidence: unknown[]
      focusRadiusMm: number
    },
    device: string | null,
  ) => ({
    id: spot.id,
    title: spot.title,
    ...(spot.anchor ? { anchor: spot.anchor } : {}),
    ...(spot.node ? { node: spot.node } : {}),
    description: spot.description,
    focusRadiusMm: spot.focusRadiusMm,
    evidence: spot.evidence.map((ref) => explorer.resolveEvidence(ref, device)),
  })

  const devices = (explorer.EXPLORER_DEVICES as Record<string, unknown>[]).map((device) => {
    const entry = showcase.showcaseEntry(device.id as string)
    return {
      id: device.id,
      title: device.title,
      group: device.group,
      productNumber: device.productNumber,
      frame: device.frame,
      jaws: device.jaws,
      ...(device.pair ? { pair: device.pair } : {}),
      presentationNote: device.presentationNote,
      qualityClass: entry.qualityClass,
      configuration: entry.configuration,
      status: explorer.modelStatus(entry),
      kitModel: entry.kitModel,
      hotspots: (device.hotspots as Parameters<typeof resolveSpot>[0][]).map((spot) =>
        resolveSpot(spot, entry.definition),
      ),
    }
  })

  const assemblyHotspots = (
    explorer.ASSEMBLY_HOTSPOTS as {
      part: string
      device: string
      spot: Parameters<typeof resolveSpot>[0]
    }[]
  ).map(({ part, device, spot }) => ({ part, spot: resolveSpot(spot, device) }))

  // Only the anchors and the extras the explorer reads, for the models it shows.
  const usedKitModels = new Set(
    devices.map((device) => device.kitModel).filter((id): id is string => Boolean(id)),
  )
  const kitModels = Object.fromEntries(
    (kit.models as { id: string; anchors: Record<string, Anchor>; extras: object }[])
      .filter((model) => usedKitModels.has(model.id))
      .map((model) => [
        model.id,
        {
          anchors: Object.fromEntries(
            Object.entries(model.anchors).map(([name, anchor]) => [
              name,
              { position: anchor.position, direction: anchor.direction },
            ]),
          ),
          extras: model.extras,
        },
      ]),
  )

  const staging = JSON.parse(readFileSync(STAGING_MANIFEST, 'utf8')) as {
    registerSha256: string
    sleeveSeat: { distalEndFromDistalFaceMm: number; category: string }
  }
  const registerBytes = readFileSync(
    path.join(SOURCE, 'docs/medical-thoracoscopy/registers/device-showcase-register.json'),
  )
  if (staging.registerSha256 !== sha256(registerBytes)) {
    throw new Error('The staged showcase was built against another register: stage it again')
  }
  const fact = (device: string, key: string) => {
    const entry = definitions.factOf(device, key)
    return { value: entry.value as number, category: entry.category as string }
  }

  const catalogue = {
    provenance: {
      explorerCommit: fullCommit,
      definitionsSha256: sha256(readFileSync(path.join(content, 'data/device-definitions.json'))),
      showcaseRegisterSha256: sha256(registerBytes),
      kitGeometryDigest: kit.geometryDigest as string,
    },
    label: definitions.deviceDefinitions.labelUntilCad as string,
    groups: explorer.EXPLORER_GROUPS,
    devices,
    assemblyHotspots,
    kit: kitModels,
    values: {
      sleeveSeatMm: {
        value: staging.sleeveSeat.distalEndFromDistalFaceMm,
        category: staging.sleeveSeat.category,
      },
      channelLengthMm: fact('operative-telescope', 'channelLength'),
      sheathLengthMm: fact('double-spoon-forceps', 'sheathLength'),
    },
  }

  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  const text = await prettier.format(
    [
      '// Generated by scripts/medical-thoracoscopy/build-device-explorer-catalogue.ts. Do not edit.',
      `// From the audited explorer at ${fullCommit}: the device definitions, kit manifest and`,
      '// showcase register resolved into only what the explorer shows. Internal notes, document',
      '// titles and rights wording stay out of the pages that load this.',
      '',
      `export const deviceExplorerCatalogue = ${JSON.stringify(catalogue)} as const`,
      '',
    ].join('\n'),
    { ...options, parser: 'typescript' },
  )
  rmSync(SOURCE, { recursive: true, force: true })
  if (CHECK) {
    const current = readFileSync(OUT, 'utf8')
    if (current !== text) {
      console.error(`${path.relative(ROOT, OUT)} differs from ${fullCommit}`)
      process.exit(1)
    }
    console.log('catalogue matches', fullCommit)
    return
  }
  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, text)
  console.log(`wrote ${path.relative(ROOT, OUT)} from ${fullCommit}: ${devices.length} models`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
