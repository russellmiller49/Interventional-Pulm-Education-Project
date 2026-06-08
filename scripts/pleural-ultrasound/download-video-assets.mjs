#!/usr/bin/env node
/**
 * Localize the pleural-ultrasound dynamic-sign videos.
 *
 * The selected clips come from jannisborn/covid19_ultrasound rows with
 * reviewed CC BY or CC BY-NC licenses. This script downloads the original
 * MOV/GIF/AVI source files into a temporary directory, converts each to a
 * browser-playable MP4, and writes a video attribution table.
 *
 *   node scripts/pleural-ultrasound/download-video-assets.mjs
 *   node scripts/pleural-ultrasound/download-video-assets.mjs --force
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const force = process.argv.includes('--force')
const outDir = path.join(
  process.cwd(),
  'public',
  'module-assets',
  'v1',
  'pleural-ultrasound',
  'video',
)
const tempDir = path.join(os.tmpdir(), 'interventionalpulm-pleural-video-assets')

const assets = [
  {
    id: 'dynamic-normal-a-lines',
    sourceFilename: 'Reg_recommendations_alines_mov1',
    inputUrl:
      'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Reg_recommendations_alines_mov1.mov',
    sourceUrl:
      'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Reg_recommendations_alines_mov1.mov',
    outputFile: 'dynamic-normal-a-lines.mp4',
    inputFile: 'Reg_recommendations_alines_mov1.mov',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      'jannisborn/covid19_ultrasound row Reg_recommendations_alines_mov1; source article: Role of point-of-care ultrasound during the COVID-19 pandemic.',
  },
  {
    id: 'dynamic-b-lines-pleural-irregularity',
    sourceFilename: 'Cov_convex_volpecelli_sonographic_v1',
    inputUrl:
      'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Cov_convex_volpecelli_sonographic_v1.mov',
    sourceUrl:
      'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Cov_convex_volpecelli_sonographic_v1.mov',
    outputFile: 'dynamic-b-lines-pleural-irregularity.mp4',
    inputFile: 'Cov_convex_volpecelli_sonographic_v1.mov',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      'jannisborn/covid19_ultrasound row Cov_convex_volpecelli_sonographic_v1; source article: Sonographic signs and patterns of COVID-19 pneumonia.',
  },
  {
    id: 'dynamic-subpleural-consolidation',
    sourceFilename: 'Cov_recommendations_likebutterfly_mov5',
    inputUrl:
      'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Cov_recommendations_likebutterfly_mov5.mov',
    sourceUrl:
      'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Cov_recommendations_likebutterfly_mov5.mov',
    outputFile: 'dynamic-subpleural-consolidation.mp4',
    inputFile: 'Cov_recommendations_likebutterfly_mov5.mov',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      'jannisborn/covid19_ultrasound row Cov_recommendations_likebutterfly_mov5; source article: Role of point-of-care ultrasound during the COVID-19 pandemic.',
  },
  {
    id: 'dynamic-lung-curtain-no-target',
    sourceFilename: 'Reg-Atlas-lungcurtain',
    inputUrl:
      'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Reg-Atlas-lungcurtain.gif',
    sourceUrl:
      'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Reg-Atlas-lungcurtain.gif',
    outputFile: 'dynamic-lung-curtain-no-target.mp4',
    inputFile: 'Reg-Atlas-lungcurtain.gif',
    license: 'CC BY-NC 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    attribution:
      'jannisborn/covid19_ultrasound row Reg-Atlas-lungcurtain; source noted as a normal lung curtain clip from The POCUS Atlas.',
  },
  {
    id: 'dynamic-effusion-adjacent-consolidation',
    sourceFilename: 'Pneu_northumbria_0409_set6_vid8',
    inputUrl:
      'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Pneu_northumbria_0409_set6_vid8.avi',
    sourceUrl:
      'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Pneu_northumbria_0409_set6_vid8.avi',
    outputFile: 'dynamic-effusion-adjacent-consolidation.mp4',
    inputFile: 'Pneu_northumbria_0409_set6_vid8.avi',
    license: 'CC BY-NC 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    attribution:
      'jannisborn/covid19_ultrasound row Pneu_northumbria_0409_set6_vid8; Northumbria Specialist Emergency Care Hospital contribution.',
  },
]

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`)
  }
}

async function download(asset, destination) {
  if (fs.existsSync(destination) && !force) {
    console.log(`skip source (exists): ${asset.inputFile}`)
    return
  }

  const response = await fetch(asset.inputUrl)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${asset.inputUrl}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(destination, buffer)
  console.log(`saved source: ${asset.inputFile} (${buffer.length.toLocaleString()} bytes)`)
}

function convert(asset, sourcePath, destination) {
  if (fs.existsSync(destination) && !force) {
    console.log(`skip mp4 (exists): ${asset.outputFile}`)
    return
  }

  run('ffmpeg', [
    '-y',
    '-i',
    sourcePath,
    '-an',
    '-vf',
    'fps=24,scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    destination,
  ])
  console.log(`saved mp4: ${asset.outputFile}`)
}

function writeAttribution() {
  const lines = [
    '# Pleural Ultrasound Dynamic Sign Videos — Attributions',
    '',
    'Selected clips are redistributed from row-level Creative Commons metadata in jannisborn/covid19_ultrasound. MOV, GIF, and AVI source files were converted to MP4 for browser playback.',
    '',
    '| Asset id | Local file | Source filename | License | Source | Attribution |',
    '| --- | --- | --- | --- | --- | --- |',
    ...assets.map(
      (asset) =>
        `| ${asset.id} | ${asset.outputFile} | ${asset.sourceFilename} | [${asset.license}](${asset.licenseUrl}) | [clip](${asset.sourceUrl}) | ${asset.attribution.replace(/\|/g, '\\|')} |`,
    ),
    '',
  ]

  fs.writeFileSync(path.join(outDir, 'ATTRIBUTION.md'), lines.join('\n'), 'utf8')
  console.log('wrote video/ATTRIBUTION.md')
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  fs.mkdirSync(tempDir, { recursive: true })

  for (const asset of assets) {
    const sourcePath = path.join(tempDir, asset.inputFile)
    const destination = path.join(outDir, asset.outputFile)
    await download(asset, sourcePath)
    convert(asset, sourcePath, destination)
  }

  writeAttribution()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
