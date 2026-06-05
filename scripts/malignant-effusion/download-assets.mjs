#!/usr/bin/env node
/**
 * Localize the malignant-effusion image references (CC BY 4.0) that were
 * hotlinked from the NCBI PMC CDN. Mirrors scripts/pleural-ultrasound/download-assets.mjs.
 * Idempotent; per-asset failures are logged and do not abort the run.
 *
 *   node scripts/malignant-effusion/download-assets.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.join(
  process.cwd(),
  'public',
  'module-assets',
  'v1',
  'malignant-effusion',
  'source',
)

const LICENSE = 'CC BY 4.0'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'

const assets = [
  {
    id: 'pleural-nodularity-ultrasound',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/1446/9870740/6a2bcfb957db/TCA-14-223-g001.jpg',
    attribution: 'Diagnosis of malignant pleural disease: Ultrasound as a detective probe. 2022.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9870740/',
  },
  {
    id: 'pleuroscopy-malignancy',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/fc70/7891332/3e8047b795cd/CRJ-15-91-g003.jpg',
    attribution: 'Evaluation of the efficacy and safety of a new flex-rigid pleuroscope. 2021.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7891332/',
  },
  {
    id: 'ipc-pleuroscope-equipment',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/fc70/7891332/86d583d62497/CRJ-15-91-g001.jpg',
    attribution: 'Evaluation of the efficacy and safety of a new flex-rigid pleuroscope. 2021.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7891332/',
  },
]

function extFromUrl(url) {
  const match = /\.(jpg|jpeg|png|gif|webp)(?:$|\?)/i.exec(url)
  return match ? `.${match[1].toLowerCase()}` : '.jpg'
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const results = []

  for (const asset of assets) {
    const fileName = `${asset.id}${extFromUrl(asset.url)}`
    const dest = path.join(OUT_DIR, fileName)

    if (fs.existsSync(dest)) {
      console.log(`✓ skip (exists): ${fileName}`)
      results.push({ ...asset, fileName, ok: true })
      continue
    }

    try {
      const response = await fetch(asset.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      fs.writeFileSync(dest, buffer)
      console.log(`✓ saved: ${fileName} (${buffer.length.toLocaleString()} bytes)`)
      results.push({ ...asset, fileName, ok: true })
    } catch (error) {
      console.error(`✗ FAILED ${asset.id}: ${error.message}`)
      results.push({ ...asset, fileName, ok: false })
    }
  }

  const ok = results.filter((r) => r.ok)
  const lines = [
    '# Malignant Effusion — Image Attributions',
    '',
    `All images are licensed [${LICENSE}](${LICENSE_URL}) and redistributed here with attribution.`,
    '',
    '| Asset id | Local file | Source | Attribution |',
    '| --- | --- | --- | --- |',
    ...ok.map(
      (r) => `| ${r.id} | source/${r.fileName} | [link](${r.sourceUrl}) | ${r.attribution.replace(/\|/g, '\\|')} |`,
    ),
    '',
  ]
  fs.writeFileSync(path.join(OUT_DIR, '..', 'ATTRIBUTION.md'), lines.join('\n'), 'utf8')

  console.log(`\nDone. ${ok.length}/${assets.length} localized. Wrote ATTRIBUTION.md.`)
  if (ok.length < assets.length) process.exitCode = 1
}

main()
