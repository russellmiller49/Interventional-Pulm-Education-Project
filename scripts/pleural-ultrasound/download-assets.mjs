#!/usr/bin/env node
/**
 * Localize the pleural-ultrasound pattern-lab images.
 *
 * The pattern lab originally hotlinked CC BY 4.0 figures from the NCBI PMC CDN.
 * Hotlinks rot and can be blocked, so this script downloads each image into
 * public/module-assets/v1/pleural-ultrasound/source/ and writes an
 * ATTRIBUTION.md (CC BY 4.0 requires attribution + a link back).
 *
 * Idempotent: existing files are skipped. Per-asset failures are logged and do
 * NOT abort the run, so a single dead URL doesn't block the rest.
 *
 * The manifest below mirrors src/features/pleural-ultrasound/content/assets.ts.
 * Keep them in sync (id + sourceUrl + license live in assets.ts as the
 * canonical record; this is a one-time fetch utility).
 *
 *   node scripts/pleural-ultrasound/download-assets.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.join(
  process.cwd(),
  'public',
  'module-assets',
  'v1',
  'pleural-ultrasound',
  'source',
)

const LICENSE = 'CC BY 4.0'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'

const assets = [
  {
    id: 'simple-anechoic-reference',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ff17/11127929/626d2921fbee/41598_2024_62807_Fig3_HTML.jpg',
    attribution:
      'Chest ultrasound is better than CT in identifying septated effusion of patients with pleural disease. Scientific Reports. 2024.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11127929/',
  },
  {
    id: 'complex-nonseptated-reference',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/f40972c6f29f/PM2019-5628267.002.jpg',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6398002/',
  },
  {
    id: 'septated-reference',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/5018901711c4/PM2019-5628267.001.jpg',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6398002/',
  },
  {
    id: 'echogenic-reference',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/91df/6264615/26c179cbed45/12890_2018_745_Fig2_HTML.jpg',
    attribution: 'Role of medical Thoracoscopy in the Management of Multiloculated Empyema. 2018.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6264615/',
  },
  {
    id: 'ambiguous-simple-exudate',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/5d66/6837853/b796c0a971fd/RCR2-8-e00498-g001.jpg',
    attribution:
      'Intrapleural urokinase directly under medical thoracoscopy for the diagnosis of tuberculous pleurisy. 2019.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6837853/',
  },
  {
    id: 'b-lines-no-effusion-distractor',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/3901/5234763/f5a7096c0f31/1679-4508-eins-14-03-0443-gf03.jpg',
    attribution: 'Advances in lung ultrasound. Einstein (Sao Paulo). 2016.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5234763/',
  },
  {
    id: 'subpleural-consolidation-distractor',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/3901/5234763/fc258bc6a417/1679-4508-eins-14-03-0443-gf04.jpg',
    attribution: 'Advances in lung ultrasound. Einstein (Sao Paulo). 2016.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5234763/',
  },
  {
    id: 'atelectasis-with-effusion-reference',
    url: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/40f9ffb61505/PM2019-5628267.003.jpg',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6398002/',
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
    const ext = extFromUrl(asset.url)
    const fileName = `${asset.id}${ext}`
    const dest = path.join(OUT_DIR, fileName)

    if (fs.existsSync(dest)) {
      console.log(`✓ skip (exists): ${fileName}`)
      results.push({ ...asset, fileName, ok: true })
      continue
    }

    try {
      const response = await fetch(asset.url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
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
  const attributionLines = [
    '# Pleural Ultrasound Pattern Lab — Image Attributions',
    '',
    `All images are licensed [${LICENSE}](${LICENSE_URL}) and are redistributed here with attribution.`,
    '',
    '| Asset id | Local file | Source | Attribution |',
    '| --- | --- | --- | --- |',
    ...ok.map(
      (r) =>
        `| ${r.id} | source/${r.fileName} | [link](${r.sourceUrl}) | ${r.attribution.replace(/\|/g, '\\|')} |`,
    ),
    '',
  ]
  fs.writeFileSync(
    path.join(OUT_DIR, '..', 'ATTRIBUTION.md'),
    attributionLines.join('\n'),
    'utf8',
  )

  console.log(`\nDone. ${ok.length}/${assets.length} localized. Wrote ATTRIBUTION.md.`)
  if (ok.length < assets.length) {
    console.log('Some downloads failed — those assets keep their remote `path` fallback in assets.ts.')
    process.exitCode = 1
  }
}

main()
