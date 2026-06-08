import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const casePath = path.resolve(
  'public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001/case.json',
)
const outputDir = path.resolve(
  'public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001/frame-atlas',
)

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function hasTag(entry, tag) {
  return entry.tags?.includes(tag)
}

function frameGeometry(entry) {
  const safe = hasTag(entry, 'best-window') || hasTag(entry, 'narrow-interspace')
  const ribShadow = hasTag(entry, 'rib-shadow')
  const diaphragm = hasTag(entry, 'diaphragm-hazard')
  const solidOrgan = hasTag(entry, 'solid-organ-hazard')
  const miss = hasTag(entry, 'fluid-miss')
  const shallow = hasTag(entry, 'shallow-depth')
  const deep = hasTag(entry, 'deep-depth')
  const cranial = hasTag(entry, 'cranial-edge')
  const caudal = hasTag(entry, 'caudal-edge')

  return {
    fluidCenterX: miss ? 255 : solidOrgan ? 290 : cranial ? 245 : caudal ? 275 : 260,
    fluidTop: shallow ? 188 : deep ? 285 : diaphragm ? 282 : solidOrgan ? 260 : 224,
    fluidHeight: miss ? 58 : ribShadow ? 92 : shallow ? 82 : deep ? 118 : safe ? 150 : 112,
    fluidWidth: miss ? 118 : ribShadow ? 176 : safe ? 244 : 210,
    ribLeft: ribShadow ? 128 : 76,
    ribRight: ribShadow ? 390 : 444,
    shadowOpacity: ribShadow ? 0.68 : 0.28,
    diaphragmY: diaphragm ? 348 : solidOrgan ? 398 : 430,
    organY: solidOrgan ? 358 : 458,
    gain: entry.probe.gain,
  }
}

function ultrasoundSvg(entry) {
  const g = frameGeometry(entry)
  const bright = Math.min(1, Math.max(0.72, g.gain / 1.45))
  const fluidInteriorOpacity = hasTag(entry, 'echogenic-fluid') ? 0.28 : 0.78
  const shadowOpacity = Math.min(0.86, g.shadowOpacity + (hasTag(entry, 'rib-shadow') ? 0.12 : 0))
  const diaphragmOpacity = hasTag(entry, 'diaphragm-hazard') ? 0.72 : 0.44
  const solidOrganOpacity = hasTag(entry, 'solid-organ-hazard') ? 0.34 : 0.16
  const anteriorFluidBoundaryY = g.fluidTop + 14
  const posteriorFluidBoundaryY = g.fluidTop + g.fluidHeight
  const debris = hasTag(entry, 'echogenic-fluid')
    ? Array.from({ length: 28 }, (_, index) => {
        const x = g.fluidCenterX - 80 + ((index * 37) % 162)
        const y = g.fluidTop + 16 + ((index * 23) % Math.max(24, g.fluidHeight - 30))
        const opacity = 0.28 + ((index % 5) * 0.08)
        return `<circle cx="${x}" cy="${y}" r="${1.3 + (index % 3)}" fill="#d1d5db" opacity="${opacity.toFixed(2)}"/>`
      }).join('\n')
    : ''
  const septations = hasTag(entry, 'septated-fluid')
    ? `<path d="M${g.fluidCenterX - 78} ${g.fluidTop + 24} C${g.fluidCenterX - 18} ${g.fluidTop + 52}, ${g.fluidCenterX + 22} ${g.fluidTop + 82}, ${g.fluidCenterX + 80} ${g.fluidTop + 112}" stroke="#d1d5db" stroke-width="2.5" opacity="0.62" fill="none"/>
       <path d="M${g.fluidCenterX + 62} ${g.fluidTop + 18} C${g.fluidCenterX + 10} ${g.fluidTop + 58}, ${g.fluidCenterX - 28} ${g.fluidTop + 94}, ${g.fluidCenterX - 92} ${g.fluidTop + 128}" stroke="#d1d5db" stroke-width="1.8" opacity="0.46" fill="none"/>`
    : ''
  const tissueBands = Array.from({ length: 46 }, (_, index) => {
    const y = 36 + index * 12
    const width = index % 5 === 0 ? 1.35 : 0.7
    const opacity = index < 12 ? 0.24 : index % 4 === 0 ? 0.13 : 0.08
    return `<path d="M${90 - index * 0.68} ${y} C174 ${y + 4}, 342 ${y - 4}, ${430 + index * 0.68} ${y}" stroke="#9ca3af" stroke-width="${width}" opacity="${opacity}" fill="none"/>`
  }).join('\n')
  const reverberationLines = Array.from({ length: 7 }, (_, index) => {
    const y = 215 + index * 30
    const opacity = Math.max(0.04, 0.18 - index * 0.018)
    return `<path d="M160 ${y} C224 ${y + 12}, 302 ${y + 12}, 368 ${y}" stroke="#e5e7eb" stroke-width="1.5" opacity="${opacity.toFixed(2)}" fill="none"/>`
  }).join('\n')
  const organSpeckle = Array.from({ length: 56 }, (_, index) => {
    const x = 82 + ((index * 47) % 360)
    const y = g.organY + 12 + ((index * 31) % Math.max(64, 596 - g.organY))
    const opacity = 0.07 + ((index % 7) * 0.012)
    return `<circle cx="${x}" cy="${y}" r="${0.8 + (index % 3) * 0.6}" fill="#e5e7eb" opacity="${opacity.toFixed(2)}"/>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="620" viewBox="0 0 520 620" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(entry.label)}</title>
  <desc id="desc">${escapeXml(entry.description)}</desc>
  <defs>
    <radialGradient id="fanGlow" cx="50%" cy="16%" r="82%">
      <stop offset="0%" stop-color="#202936"/>
      <stop offset="54%" stop-color="#0b111c"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <radialGradient id="enhancement" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#64748b" stop-opacity="0.24"/>
      <stop offset="66%" stop-color="#334155" stop-opacity="0.11"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="anechoicFluid" x1="0%" x2="0%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="${fluidInteriorOpacity}"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="${Math.min(0.92, fluidInteriorOpacity + 0.1)}"/>
    </linearGradient>
    <linearGradient id="shadowFade" x1="0%" x2="0%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="${shadowOpacity.toFixed(2)}"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${Math.min(0.96, shadowOpacity + 0.12).toFixed(2)}"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${entry.id.length * 17}" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.24"/>
      </feComponentTransfer>
    </filter>
    <filter id="fineSpeckle">
      <feTurbulence type="fractalNoise" baseFrequency="1.7" numOctaves="2" seed="${entry.id.length * 29}" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.11"/>
      </feComponentTransfer>
    </filter>
    <clipPath id="sector">
      <path d="M260 22 C130 118, 58 330, 36 604 L484 604 C462 330, 390 118, 260 22 Z"/>
    </clipPath>
  </defs>
  <rect width="520" height="620" fill="#000"/>
  <g clip-path="url(#sector)">
    <rect width="520" height="620" fill="url(#fanGlow)"/>
    <rect width="520" height="620" filter="url(#grain)" opacity="${(0.78 * bright).toFixed(2)}"/>
    <g>${tissueBands}</g>
    <path d="M80 150 C162 128, 350 130, 440 154" stroke="#f9fafb" stroke-width="6" opacity="${(0.54 * bright).toFixed(2)}" fill="none"/>
    <path d="M96 174 C180 156, 342 158, 424 176" stroke="#cbd5e1" stroke-width="3" opacity="0.34" fill="none"/>
    <path d="M${g.fluidCenterX - g.fluidWidth * 0.42} ${posteriorFluidBoundaryY + 8}
             C${g.fluidCenterX - g.fluidWidth * 0.08} ${posteriorFluidBoundaryY + 28}, ${g.fluidCenterX + g.fluidWidth * 0.2} ${posteriorFluidBoundaryY + 34}, ${g.fluidCenterX + g.fluidWidth * 0.46} ${posteriorFluidBoundaryY + 10}
             L${g.fluidCenterX + g.fluidWidth * 0.52} ${Math.min(610, posteriorFluidBoundaryY + 126)}
             C${g.fluidCenterX + g.fluidWidth * 0.1} ${Math.min(612, posteriorFluidBoundaryY + 154)}, ${g.fluidCenterX - g.fluidWidth * 0.35} ${Math.min(612, posteriorFluidBoundaryY + 134)}, ${g.fluidCenterX - g.fluidWidth * 0.5} ${Math.min(610, posteriorFluidBoundaryY + 104)} Z"
          fill="url(#enhancement)" opacity="${hasTag(entry, 'fluid-miss') ? 0.05 : 0.9}"/>
    <path d="M${g.fluidCenterX - g.fluidWidth / 2} ${g.fluidTop + 16}
             C${g.fluidCenterX - g.fluidWidth / 2 + 34} ${g.fluidTop - 18}, ${g.fluidCenterX + g.fluidWidth / 2 - 38} ${g.fluidTop - 16}, ${g.fluidCenterX + g.fluidWidth / 2} ${g.fluidTop + 18}
             C${g.fluidCenterX + g.fluidWidth / 2 - 12} ${g.fluidTop + g.fluidHeight}, ${g.fluidCenterX - g.fluidWidth / 2 + 18} ${g.fluidTop + g.fluidHeight + 6}, ${g.fluidCenterX - g.fluidWidth / 2} ${g.fluidTop + 16} Z"
          fill="url(#anechoicFluid)" stroke="#cbd5e1" stroke-width="${hasTag(entry, 'fluid-miss') ? 1 : 1.6}" stroke-opacity="${hasTag(entry, 'fluid-miss') ? 0.1 : 0.18}" opacity="${hasTag(entry, 'fluid-miss') ? 0.38 : 0.9}"/>
    <path d="M${g.fluidCenterX - g.fluidWidth / 2 + 8} ${anteriorFluidBoundaryY}
             C${g.fluidCenterX - 44} ${g.fluidTop - 8}, ${g.fluidCenterX + 44} ${g.fluidTop - 8}, ${g.fluidCenterX + g.fluidWidth / 2 - 10} ${anteriorFluidBoundaryY + 4}"
          stroke="#f3f4f6" stroke-width="2.2" opacity="${hasTag(entry, 'fluid-miss') ? 0.18 : 0.45}" fill="none"/>
    <path d="M${g.fluidCenterX - g.fluidWidth / 2 + 24} ${posteriorFluidBoundaryY - 2}
             C${g.fluidCenterX - 40} ${posteriorFluidBoundaryY + 10}, ${g.fluidCenterX + 44} ${posteriorFluidBoundaryY + 12}, ${g.fluidCenterX + g.fluidWidth / 2 - 18} ${posteriorFluidBoundaryY - 2}"
          stroke="#f9fafb" stroke-width="3" opacity="${hasTag(entry, 'fluid-miss') ? 0.1 : 0.58}" fill="none"/>
    ${septations}
    ${debris}
    <path d="M92 ${g.diaphragmY} C174 ${g.diaphragmY - 32}, 328 ${g.diaphragmY - 28}, 430 ${g.diaphragmY + 4}" stroke="#f3f4f6" stroke-width="5" opacity="${diaphragmOpacity}" fill="none"/>
    <path d="M96 ${g.organY} C176 ${g.organY - 18}, 330 ${g.organY - 8}, 436 ${g.organY + 24} L474 620 L56 620 Z" fill="#64748b" opacity="${solidOrganOpacity}"/>
    <g opacity="${solidOrganOpacity * 1.15}">${organSpeckle}</g>
    <path d="M204 ${g.fluidTop - 18} C238 ${g.fluidTop - 34}, 304 ${g.fluidTop - 32}, 340 ${g.fluidTop - 12}" stroke="#e5e7eb" stroke-width="3" opacity="0.38" fill="none"/>
    <g>${reverberationLines}</g>
    <path d="M${g.ribLeft - 18} 190 C${g.ribLeft - 44} 322, ${g.ribLeft - 58} 462, ${g.ribLeft - 64} 620 L${g.ribLeft + 52} 620 C${g.ribLeft + 42} 458, ${g.ribLeft + 34} 320, ${g.ribLeft + 18} 190 Z" fill="url(#shadowFade)"/>
    <path d="M${g.ribRight - 18} 190 C${g.ribRight - 36} 320, ${g.ribRight - 48} 458, ${g.ribRight - 58} 620 L${g.ribRight + 62} 620 C${g.ribRight + 54} 454, ${g.ribRight + 46} 322, ${g.ribRight + 18} 190 Z" fill="url(#shadowFade)"/>
    <rect width="520" height="620" filter="url(#fineSpeckle)" opacity="0.52"/>
    <path d="M${g.ribLeft - 28} 179 C${g.ribLeft - 12} 168, ${g.ribLeft + 14} 168, ${g.ribLeft + 30} 181" stroke="#ffffff" stroke-width="6" opacity="0.82" fill="none"/>
    <path d="M${g.ribRight - 30} 181 C${g.ribRight - 14} 168, ${g.ribRight + 12} 168, ${g.ribRight + 28} 179" stroke="#ffffff" stroke-width="6" opacity="0.82" fill="none"/>
    <path d="M${g.ribLeft - 22} 187 C${g.ribLeft - 8} 181, ${g.ribLeft + 8} 181, ${g.ribLeft + 22} 188" stroke="#111827" stroke-width="2" opacity="0.34" fill="none"/>
    <path d="M${g.ribRight - 22} 188 C${g.ribRight - 8} 181, ${g.ribRight + 8} 181, ${g.ribRight + 22} 187" stroke="#111827" stroke-width="2" opacity="0.34" fill="none"/>
  </g>
  <path d="M260 22 C130 118, 58 330, 36 604 L484 604 C462 330, 390 118, 260 22 Z" fill="none" stroke="#334155" stroke-width="2"/>
</svg>
`
}

async function main() {
  const caseData = JSON.parse(await readFile(casePath, 'utf8'))
  const entries = caseData.frameAtlas?.entries ?? []
  if (!entries.length) {
    throw new Error('case.json does not contain frameAtlas.entries')
  }

  await mkdir(outputDir, { recursive: true })

  for (const entry of entries) {
    const fileName = path.basename(entry.imageUrl)
    if (!fileName.endsWith('.svg')) {
      continue
    }

    await writeFile(path.join(outputDir, fileName), ultrasoundSvg(entry))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
