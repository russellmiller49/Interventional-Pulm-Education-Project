import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const outputDir = __dirname
const frameDir = path.join(outputDir, 'frames')
const clipFrameDir = path.join(outputDir, 'clip-frames')
const videoPath = path.join(outputDir, 'interventionalpulm-linkedin-modules.mp4')
const posterPath = path.join(outputDir, 'interventionalpulm-linkedin-modules-poster.png')
const navClipPath = '/Users/russellmiller/Movies/NAVBRONCH.mp4'
const fluoroClipPath = '/Users/russellmiller/Movies/FLUORONAV.mp4'

const width = 1080
const height = 1080
const fps = 30

function probeVideoDuration(inputPath) {
  if (!existsSync(inputPath)) {
    throw new Error(`Missing clip: ${inputPath}`)
  }

  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ],
    { encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error(`ffprobe exited with status ${result.status} for ${inputPath}`)
  }

  const duration = Number.parseFloat(result.stdout.trim())
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Unable to read duration for ${inputPath}`)
  }

  return duration
}

const navClipDuration = probeVideoDuration(navClipPath)
const fluoroClipDuration = probeVideoDuration(fluoroClipPath)

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, Helvetica, Arial, sans-serif"

const colors = {
  ink: '#f8fbff',
  muted: '#aebad0',
  dim: '#71809a',
  navy: '#071120',
  panel: '#101c32',
  panel2: '#0d182b',
  stroke: '#2a3b59',
  cyan: '#12a8e8',
  teal: '#2dd4bf',
  emerald: '#34d399',
  amber: '#f2b84b',
  rose: '#ef6b8a',
}

const scenes = [
  {
    id: 'hero',
    duration: 3,
    eyebrow: 'INTERVENTIONAL PULMONOLOGY EDUCATION',
    title: 'Free interactive modules for IP learners',
    body: 'Practice navigation, imaging, EBUS, and board review in one browser-based learning lab.',
    cta: 'Create a free account',
  },
  {
    id: 'navigation',
    duration: navClipDuration,
    eyebrow: 'BRONCH NAVIGATION TRAINER',
    title: 'Drive the airway, branch by branch',
    body: 'Follow a target from CT planning into the airway and choose the route that keeps the scope moving toward the lesion.',
    cta: 'Start navigation practice',
  },
  {
    id: 'fluoroview',
    duration: fluoroClipDuration,
    eyebrow: 'FLUOROVIEW',
    title: 'Build CT-to-fluoro intuition',
    body: 'Rehearse C-arm angles, projection behavior, CT correlation, and image-control tradeoffs in an educational simulator.',
    cta: 'Launch FluoroView',
  },
  {
    id: 'ebus',
    duration: 5,
    eyebrow: 'EBUS TRAINING',
    title: 'Knobology, stations, and simulator practice',
    body: 'Move from ultrasound controls to mediastinal station recognition with CT, bronchoscopy, and EBUS image correlation.',
    cta: 'Open EBUS training',
  },
  {
    id: 'board',
    duration: 4,
    eyebrow: 'IP BOARD REVIEW',
    title: 'High-yield prep with progress tracking',
    body: 'Review case-based chapters, exam domains, high-yield pearls, and audio companions for focused board preparation.',
    cta: 'Start board review',
  },
  {
    id: 'catalog',
    duration: 5,
    eyebrow: 'LIVE NOW',
    title: 'A growing library for IP education',
    body: 'Explore the live modules today, with new bronch, pleural, and rigid bronchoscopy features already being built.',
    cta: 'More modules are on the way',
  },
  {
    id: 'signup',
    duration: 4,
    eyebrow: 'FREE ACCOUNT ACCESS',
    title: 'Create a free account to access the modules',
    body: 'Account access will be required for navigation, FluoroView, EBUS, and board review practice.',
    cta: 'interventionalpulm.com',
  },
]

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max)
}

function easeOutCubic(value) {
  const t = clamp(value)
  return 1 - Math.pow(1 - t, 3)
}

function easeInOut(value) {
  const t = clamp(value)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function textLines(text, maxChars) {
  const words = text.split(/\s+/)
  const lines = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines
}

function multilineText(text, x, y, options = {}) {
  const {
    maxChars = 34,
    fontSize = 32,
    lineHeight = 1.18,
    weight = 700,
    fill = colors.ink,
    anchor = 'start',
  } = options
  const lines = textLines(text, maxChars)

  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="${fontStack}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="0">
      ${lines
        .map(
          (line, index) =>
            `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${escapeXml(line)}</tspan>`,
        )
        .join('')}
    </text>
  `
}

function pill(label, x, y, options = {}) {
  const {
    fill = '#0b3550',
    stroke = '#245676',
    text = '#c6efff',
    fontSize = 22,
    padX = 22,
    height: pillHeight = 44,
  } = options
  const estimatedWidth = label.length * fontSize * 0.54 + padX * 2

  return `
    <g>
      <rect x="${x}" y="${y}" width="${estimatedWidth.toFixed(1)}" height="${pillHeight}" rx="${pillHeight / 2}" fill="${fill}" stroke="${stroke}" />
      <text x="${x + padX}" y="${y + pillHeight / 2 + fontSize * 0.34}" fill="${text}" font-family="${fontStack}" font-size="${fontSize}" font-weight="700" letter-spacing="0">${escapeXml(label)}</text>
    </g>
  `
}

function fixedChip(label, x, y, w, options = {}) {
  const {
    fill = '#0b3550',
    stroke = '#245676',
    text = '#c6efff',
    fontSize = 22,
    height: chipHeight = 58,
  } = options

  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${chipHeight}" rx="${chipHeight / 2}" fill="${fill}" stroke="${stroke}" />
      <text x="${x + w / 2}" y="${y + chipHeight / 2 + fontSize * 0.34}" fill="${text}" font-family="${fontStack}" font-size="${fontSize}" font-weight="820" text-anchor="middle" letter-spacing="0">${escapeXml(label)}</text>
    </g>
  `
}

function panelRect(x, y, w, h, options = {}) {
  const { fill = colors.panel, stroke = colors.stroke, rx = 28, opacity = 1 } = options
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" opacity="${opacity}" />`
}

function imageTag(id, x, y, w, h, href, options = {}) {
  const { rx = 24, fit = 'slice', opacity = 1 } = options
  const preserve = fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
  return `
    <clipPath id="${id}Clip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" /></clipPath>
    <image x="${x}" y="${y}" width="${w}" height="${h}" href="${href}" preserveAspectRatio="${preserve}" clip-path="url(#${id}Clip)" opacity="${opacity}" />
  `
}

function backgroundSvg(sceneIndex, totalScenes) {
  const progress = ((sceneIndex + 1) / totalScenes) * 832
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#071120" />
        <stop offset="55%" stop-color="#0b1628" />
        <stop offset="100%" stop-color="#112033" />
      </linearGradient>
      <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.28" />
        <stop offset="55%" stop-color="#14b8a6" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#f2b84b" stop-opacity="0.18" />
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000814" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    <path d="M-80 880 C180 790 270 650 530 690 C760 725 880 590 1160 520 L1160 1160 L-80 1160 Z" fill="url(#band)" />
    <path d="M0 120 H1080" stroke="#26364f" stroke-width="1" />
    <text x="72" y="74" fill="${colors.ink}" font-family="${fontStack}" font-size="28" font-weight="850" letter-spacing="0">interventionalpulm.com</text>
    <rect x="72" y="994" width="832" height="8" rx="4" fill="#1e2b43" />
    <rect x="72" y="994" width="${progress.toFixed(1)}" height="8" rx="4" fill="${colors.teal}" />
    <text x="72" y="1038" fill="${colors.dim}" font-family="${fontStack}" font-size="20" font-weight="600" letter-spacing="0">Educational content only</text>
    <text x="672" y="1038" fill="${colors.dim}" font-family="${fontStack}" font-size="20" font-weight="600" letter-spacing="0">Free modules for IP learners</text>
  `
}

function sceneHeader(scene, shift = 0) {
  return `
    <text x="72" y="${166 + shift}" fill="#8ae7ff" font-family="${fontStack}" font-size="22" font-weight="850" letter-spacing="0">${escapeXml(scene.eyebrow)}</text>
    ${multilineText(scene.title, 72, 240 + shift, {
      maxChars: 28,
      fontSize: 56,
      lineHeight: 1.04,
      weight: 820,
    })}
    ${multilineText(scene.body, 72, 380 + shift, {
      maxChars: 50,
      fontSize: 25,
      lineHeight: 1.28,
      weight: 500,
      fill: colors.muted,
    })}
  `
}

function heroScene(scene, t) {
  const lift = (1 - easeOutCubic(t)) * 28
  const sweep = 320 + Math.sin(t * Math.PI) * 18
  return `
    ${sceneHeader(scene, -lift)}
    <g filter="url(#softShadow)" transform="translate(0 ${lift * 0.35})">
      ${panelRect(72, 548, 936, 328, { fill: '#0e2038', stroke: '#2c476b', rx: 30 })}
      <path d="M112 810 C190 700 265 724 332 632 C420 510 515 616 610 566 C762 486 810 612 948 584" fill="none" stroke="${colors.cyan}" stroke-width="10" stroke-linecap="round" opacity="0.7" />
      <path d="M112 810 C190 700 265 724 332 632 C420 510 515 616 610 566 C762 486 810 612 948 584" pathLength="1" fill="none" stroke="${colors.teal}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${clamp(t * 1.16).toFixed(3)} 1" />
      <circle cx="${sweep}" cy="672" r="18" fill="${colors.amber}" stroke="#fff7c7" stroke-width="5" />
      ${pill('Navigation Trainer', 118, 594, { fill: '#0d334d', stroke: '#236785', fontSize: 19, height: 36 })}
      ${pill('FluoroView', 118, 654, { fill: '#123c37', stroke: '#2c756c', text: '#c3fbef', fontSize: 19, height: 36 })}
      ${pill('EBUS Training', 118, 714, { fill: '#342342', stroke: '#6d4a86', text: '#efd9ff', fontSize: 19, height: 36 })}
      ${pill('Board Review', 118, 774, { fill: '#46381c', stroke: '#927642', text: '#ffe8ae', fontSize: 19, height: 36 })}
      <text x="548" y="664" fill="${colors.ink}" font-family="${fontStack}" font-size="34" font-weight="800" letter-spacing="0">Interactive practice modules</text>
      <text x="548" y="706" fill="${colors.muted}" font-family="${fontStack}" font-size="24" font-weight="500" letter-spacing="0">Built for visual, case-based IP learning.</text>
      <rect x="548" y="748" width="322" height="56" rx="28" fill="${colors.teal}" />
      <text x="584" y="784" fill="#04111d" font-family="${fontStack}" font-size="24" font-weight="850" letter-spacing="0">${escapeXml(scene.cta)}</text>
    </g>
  `
}

function navigationScene(scene, t, assets, sceneFrame) {
  const clipFrame = assets.navClipFrames[Math.min(sceneFrame, assets.navClipFrames.length - 1)]
  const lift = (1 - easeOutCubic(t)) * 18
  return `
    ${sceneHeader(scene, -10)}
    <g filter="url(#softShadow)" transform="translate(0 ${lift.toFixed(2)})">
      ${panelRect(82, 500, 916, 450, { fill: '#07101d', stroke: '#30435f', rx: 30 })}
      ${imageTag('navClip', 106, 524, 868, 402, clipFrame, { rx: 24, fit: 'contain' })}
      <rect x="106" y="524" width="868" height="402" rx="24" fill="none" stroke="#3d5678" opacity="0.65" />
    </g>
    <text x="82" y="980" fill="${colors.teal}" font-family="${fontStack}" font-size="25" font-weight="800" letter-spacing="0">${escapeXml(scene.cta)}</text>
  `
}

function fluoroScene(scene, t, assets, sceneFrame) {
  const clipFrame = assets.fluoroClipFrames[Math.min(sceneFrame, assets.fluoroClipFrames.length - 1)]
  const lift = (1 - easeOutCubic(t)) * 18
  return `
    ${sceneHeader(scene, -16)}
    <g filter="url(#softShadow)" transform="translate(0 ${lift.toFixed(2)})">
      ${panelRect(96, 502, 888, 448, { fill: '#07101d', stroke: '#34445d', rx: 30 })}
      ${imageTag('fluoroClip', 122, 528, 836, 396, clipFrame, { rx: 24 })}
      <rect x="122" y="528" width="836" height="396" rx="24" fill="none" stroke="#3d5678" opacity="0.65" />
    </g>
    <text x="96" y="980" fill="${colors.teal}" font-family="${fontStack}" font-size="25" font-weight="800" letter-spacing="0">${escapeXml(scene.cta)}</text>
  `
}

function ebusScene(scene, t, assets) {
  const zoom = 1 + Math.sin(t * Math.PI) * 0.012
  return `
    ${sceneHeader(scene, -18)}
    <g filter="url(#softShadow)" transform="translate(0 ${(1 - easeOutCubic(t)) * 18})">
      ${panelRect(72, 494, 936, 438, { fill: '#101c32', stroke: '#34445d', rx: 30 })}
      <g transform="translate(112 534) scale(${zoom})">
        ${imageTag('ebusMap', 0, 0, 220, 352, assets.ebusMap, { rx: 20, fit: 'contain' })}
      </g>
      ${imageTag('ebusCt', 364, 534, 254, 166, assets.ebusCt, { rx: 20 })}
      ${imageTag('ebusUs', 652, 534, 276, 166, assets.ebusUltrasound, { rx: 20 })}
      ${imageTag('ebusBronch', 364, 728, 254, 156, assets.ebusBronch, { rx: 20 })}
      ${imageTag('ebusKnob', 652, 728, 276, 156, assets.ebusKnobology, { rx: 20 })}
      ${pill('Station map', 132, 854, { fill: '#0b3550', stroke: '#245676', fontSize: 18, height: 34 })}
      ${pill('CT correlation', 384, 652, { fill: '#0b3550', stroke: '#245676', fontSize: 18, height: 34 })}
      ${pill('EBUS view', 672, 652, { fill: '#163a31', stroke: '#2a7868', text: '#c2fff1', fontSize: 18, height: 34 })}
      ${pill('Bronchoscopy', 384, 836, { fill: '#342342', stroke: '#6d4a86', text: '#efd9ff', fontSize: 18, height: 34 })}
      ${pill('Knobology', 672, 836, { fill: '#3d2e18', stroke: '#80623a', text: '#ffe7ae', fontSize: 18, height: 34 })}
    </g>
    <text x="80" y="970" fill="${colors.teal}" font-family="${fontStack}" font-size="25" font-weight="800" letter-spacing="0">${escapeXml(scene.cta)}</text>
  `
}

function boardScene(scene, t, assets) {
  const y = 502 + (1 - easeOutCubic(t)) * 24
  return `
    ${sceneHeader(scene, -16)}
    <g filter="url(#softShadow)">
      ${panelRect(72, y, 936, 406, { fill: '#101c32', stroke: '#34445d', rx: 30 })}
      ${imageTag('boardShot', 100, y + 28, 578, 350, assets.boardPrep, { rx: 22 })}
      <rect x="710" y="${y + 82}" width="244" height="92" rx="24" fill="#14233b" stroke="#354a68" />
      <text x="736" y="${y + 120}" fill="${colors.muted}" font-family="${fontStack}" font-size="20" font-weight="700" letter-spacing="0">Chapters ready</text>
      <text x="736" y="${y + 158}" fill="${colors.ink}" font-family="${fontStack}" font-size="42" font-weight="850" letter-spacing="0">24</text>
      <rect x="710" y="${y + 206}" width="244" height="92" rx="24" fill="#14233b" stroke="#354a68" />
      <text x="736" y="${y + 244}" fill="${colors.muted}" font-family="${fontStack}" font-size="20" font-weight="700" letter-spacing="0">Exam domains</text>
      <text x="736" y="${y + 282}" fill="${colors.ink}" font-family="${fontStack}" font-size="42" font-weight="850" letter-spacing="0">72</text>
      ${fixedChip('Case based', 692, y + 334, 124, {
        fill: '#0b3550',
        stroke: '#245676',
        text: '#dff8ff',
        fontSize: 16,
        height: 40,
      })}
      ${fixedChip('Audio companion', 828, y + 334, 176, {
        fill: '#163a31',
        stroke: '#2a7868',
        text: '#d9fff5',
        fontSize: 16,
        height: 40,
      })}
    </g>
    <text x="80" y="952" fill="${colors.teal}" font-family="${fontStack}" font-size="25" font-weight="800" letter-spacing="0">${escapeXml(scene.cta)}</text>
  `
}

function catalogScene(scene, t) {
  const liveModules = [
    ['Navigation Trainer', colors.teal],
    ['FluoroView', colors.cyan],
    ['EBUS Training', colors.emerald],
    ['Board Review', colors.amber],
    ['TNM-9 Staging', '#93c5fd'],
    ['3D Anatomy', '#c4b5fd'],
    ['Creative Commons Image Repository', '#f0abfc'],
  ]
  const upcomingModules = [
    'Intro to Bronchoscopy',
    'Pleural Disease',
    'Rigid Bronchoscopy Foundations',
  ]
  const cardLift = (1 - easeOutCubic(t)) * 18

  return `
    ${sceneHeader(scene, -16)}
    <g filter="url(#softShadow)" transform="translate(0 ${cardLift.toFixed(2)})">
      ${panelRect(72, 500, 936, 440, { fill: '#101c32', stroke: '#34445d', rx: 30 })}
      <text x="112" y="560" fill="${colors.ink}" font-family="${fontStack}" font-size="28" font-weight="850" letter-spacing="0">Live modules</text>
      <text x="112" y="608" fill="${colors.muted}" font-family="${fontStack}" font-size="21" font-weight="600" letter-spacing="0">Learner-facing tools, review modules, and teaching resources.</text>
      ${liveModules
        .map(([label, accent], index) => {
          const col = index % 2
          const row = Math.floor(index / 2)
          const x = 112 + col * 410
          const y = 646 + row * 58
          const cardWidth = label.length > 24 ? 432 : 360
          return `
            <g>
              <rect x="${x}" y="${y}" width="${cardWidth}" height="42" rx="21" fill="#0d182b" stroke="#2d4263" />
              <circle cx="${x + 24}" cy="${y + 21}" r="7" fill="${accent}" />
              <text x="${x + 44}" y="${y + 28}" fill="${colors.ink}" font-family="${fontStack}" font-size="${label.length > 24 ? 18 : 21}" font-weight="780" letter-spacing="0">${escapeXml(label)}</text>
            </g>
          `
        })
        .join('')}
      <rect x="112" y="878" width="816" height="1" fill="#2b3d5a" />
      <text x="112" y="916" fill="#8ae7ff" font-family="${fontStack}" font-size="22" font-weight="850" letter-spacing="0">Being built</text>
      ${upcomingModules
        .map((label, index) =>
          fixedChip(label, 266 + index * 220, 888, index === 2 ? 250 : 198, {
            fill: index === 0 ? '#0b3550' : index === 1 ? '#163a31' : '#3d2e18',
            stroke: index === 0 ? '#245676' : index === 1 ? '#2a7868' : '#80623a',
            text: '#eefbff',
            fontSize: index === 2 ? 14 : 16,
            height: 44,
          }),
        )
        .join('')}
    </g>
    <text x="80" y="978" fill="${colors.teal}" font-family="${fontStack}" font-size="25" font-weight="800" letter-spacing="0">${escapeXml(scene.cta)}</text>
  `
}

function signupScene(scene, t) {
  const cardY = 474 + (1 - easeOutCubic(t)) * 22
  return `
    ${sceneHeader(scene, -14)}
    <g filter="url(#softShadow)">
      ${panelRect(118, cardY, 844, 426, { fill: '#f8fbff', stroke: '#b9ccdc', rx: 34 })}
      <text x="172" y="${cardY + 74}" fill="#071120" font-family="${fontStack}" font-size="38" font-weight="850" letter-spacing="0">Create your free account</text>
      <text x="172" y="${cardY + 118}" fill="#516174" font-family="${fontStack}" font-size="23" font-weight="560" letter-spacing="0">Access modules and track your progress.</text>
      <rect x="172" y="${cardY + 154}" width="444" height="58" rx="18" fill="#eef4f8" stroke="#ccdae6" />
      <text x="198" y="${cardY + 190}" fill="#6a7786" font-family="${fontStack}" font-size="22" font-weight="650" letter-spacing="0">you@example.com</text>
      <rect x="172" y="${cardY + 232}" width="444" height="58" rx="18" fill="#eef4f8" stroke="#ccdae6" />
      <text x="198" y="${cardY + 268}" fill="#6a7786" font-family="${fontStack}" font-size="22" font-weight="650" letter-spacing="0">Password</text>
      <rect x="172" y="${cardY + 318}" width="304" height="64" rx="32" fill="${colors.teal}" />
      <text x="214" y="${cardY + 358}" fill="#04111d" font-family="${fontStack}" font-size="24" font-weight="880" letter-spacing="0">Sign up free</text>
      ${fixedChip('Navigation', 662, cardY + 154, 236, { fill: '#071120', stroke: '#071120', text: colors.ink })}
      ${fixedChip('FluoroView', 662, cardY + 232, 236, { fill: '#0b3550', stroke: '#0b3550', text: colors.ink })}
      ${fixedChip('EBUS', 636, cardY + 310, 128, { fill: '#163a31', stroke: '#163a31', text: colors.ink })}
      ${fixedChip('Boards', 784, cardY + 310, 174, { fill: '#3d2e18', stroke: '#3d2e18', text: colors.ink })}
    </g>
    <text x="72" y="954" fill="${colors.ink}" font-family="${fontStack}" font-size="34" font-weight="850" letter-spacing="0">${escapeXml(scene.cta)}</text>
  `
}

function sceneSvg(scene, sceneIndex, localT, assets, sceneFrame) {
  let body = ''
  if (scene.id === 'hero') body = heroScene(scene, localT)
  if (scene.id === 'navigation') body = navigationScene(scene, localT, assets, sceneFrame)
  if (scene.id === 'fluoroview') body = fluoroScene(scene, localT, assets, sceneFrame)
  if (scene.id === 'ebus') body = ebusScene(scene, localT, assets)
  if (scene.id === 'board') body = boardScene(scene, localT, assets)
  if (scene.id === 'catalog') body = catalogScene(scene, localT)
  if (scene.id === 'signup') body = signupScene(scene, localT)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${backgroundSvg(sceneIndex, scenes.length)}
      ${body}
    </svg>
  `
}

async function imageDataUri(sourcePath, options = {}) {
  const absolutePath = path.isAbsolute(sourcePath) ? sourcePath : path.join(rootDir, sourcePath)
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing asset: ${absolutePath}`)
  }

  let image = sharp(absolutePath, { failOn: 'none' }).rotate()
  if (options.extract) image = image.extract(options.extract)
  if (options.resize) image = image.resize(options.resize)
  if (options.blur) image = image.blur(options.blur)

  const buffer = await image.png({ compressionLevel: 8 }).toBuffer()
  return `data:image/png;base64,${buffer.toString('base64')}`
}

async function fileDataUri(absolutePath, mimeType = 'image/jpeg') {
  const buffer = await fs.readFile(absolutePath)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function extractClipFrames({ id, inputPath, startSeconds, durationSeconds, filter }) {
  if (!existsSync(inputPath)) {
    throw new Error(`Missing clip: ${inputPath}`)
  }

  const sceneClipDir = path.join(clipFrameDir, id)
  await fs.rm(sceneClipDir, { recursive: true, force: true })
  await fs.mkdir(sceneClipDir, { recursive: true })

  const outputPattern = path.join(sceneClipDir, 'frame_%04d.jpg')
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'warning',
      '-ss',
      String(startSeconds),
      '-i',
      inputPath,
      '-t',
      String(durationSeconds),
      '-vf',
      `fps=${fps},${filter},setsar=1`,
      '-q:v',
      '5',
      outputPattern,
    ],
    { stdio: 'inherit' },
  )

  if (result.status !== 0) {
    throw new Error(`ffmpeg clip extraction for ${id} exited with status ${result.status}`)
  }

  const frameFiles = (await fs.readdir(sceneClipDir))
    .filter((file) => file.endsWith('.jpg'))
    .sort()
    .map((file) => path.join(sceneClipDir, file))

  if (!frameFiles.length) {
    throw new Error(`No frames extracted for ${id}`)
  }

  return Promise.all(frameFiles.map((file) => fileDataUri(file)))
}

async function loadAssets() {
  const [navClipFrames, fluoroClipFrames] = await Promise.all([
    extractClipFrames({
      id: 'navigation',
      inputPath: navClipPath,
      startSeconds: 0,
      durationSeconds: scenes.find((scene) => scene.id === 'navigation').duration,
      filter: 'crop=3890:2116:102:174,scale=1100:-2',
    }),
    extractClipFrames({
      id: 'fluoroview',
      inputPath: fluoroClipPath,
      startSeconds: 0,
      durationSeconds: scenes.find((scene) => scene.id === 'fluoroview').duration,
      filter: 'crop=2300:1380:900:280,scale=1000:-2',
    }),
  ])

  return {
    navClipFrames,
    fluoroClipFrames,
    ebusMap: await imageDataUri('public/socal-ebus-course/app/media/stations/clean_mediastinum.png', {
      resize: { width: 380, height: 500, fit: 'contain', background: { r: 8, g: 17, b: 30, alpha: 1 } },
    }),
    ebusCt: await imageDataUri('public/socal-ebus-course/app/media/stations/4R/ct/axial-marked.jpg', {
      resize: { width: 380, height: 250, fit: 'cover' },
    }),
    ebusUltrasound: await imageDataUri('public/socal-ebus-course/app/media/stations/7/ultrasound/view.jpg', {
      resize: { width: 420, height: 260, fit: 'cover' },
    }),
    ebusBronch: await imageDataUri('public/socal-ebus-course/app/media/stations/2L/bronchoscopy/view-marked.png', {
      resize: { width: 380, height: 250, fit: 'cover' },
    }),
    ebusKnobology: await imageDataUri('public/socal-ebus-course/app/media/knobology/ebus_depth_3.png', {
      resize: { width: 420, height: 250, fit: 'cover' },
    }),
    boardPrep: await imageDataUri('marketing/linkedin-modules-promo/screenshots/board-prep.png', {
      extract: { left: 0, top: 120, width: 1440, height: 950 },
      resize: { width: 760, height: 460, fit: 'cover' },
    }),
  }
}

async function cleanFrameDir() {
  await fs.mkdir(frameDir, { recursive: true })
  const existing = await fs.readdir(frameDir)
  await Promise.all(
    existing.filter((file) => file.endsWith('.png')).map((file) => fs.unlink(path.join(frameDir, file))),
  )
}

async function renderFrames() {
  const assets = await loadAssets()
  await cleanFrameDir()

  let frameIndex = 0
  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex]
    const frameCount = Math.round(scene.duration * fps)

    for (let sceneFrame = 0; sceneFrame < frameCount; sceneFrame += 1) {
      const localT = frameCount <= 1 ? 1 : sceneFrame / (frameCount - 1)
      const svg = sceneSvg(scene, sceneIndex, localT, assets, sceneFrame)
      const framePath = path.join(frameDir, `frame_${String(frameIndex).padStart(4, '0')}.png`)
      await sharp(Buffer.from(svg)).png({ compressionLevel: 7 }).toFile(framePath)
      frameIndex += 1
    }
  }

  await fs.copyFile(path.join(frameDir, 'frame_0000.png'), posterPath)
  return frameIndex
}

function encodeVideo() {
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-framerate',
    String(fps),
    '-i',
    path.join(frameDir, 'frame_%04d.png'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-crf',
    '18',
    '-preset',
    'medium',
    '-movflags',
    '+faststart',
    videoPath,
  ]

  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with status ${result.status}`)
  }
}

const totalFrames = await renderFrames()
encodeVideo()

console.log(
  JSON.stringify(
    {
      videoPath,
      posterPath,
      frameDir,
      clipFrameDir,
      navClipPath,
      fluoroClipPath,
      fps,
      totalFrames,
      durationSeconds: totalFrames / fps,
    },
    null,
    2,
  ),
)
