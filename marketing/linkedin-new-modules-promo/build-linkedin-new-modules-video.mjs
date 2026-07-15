import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const captureDir = path.join(__dirname, 'captures')
const sourceDir = path.join(__dirname, 'sources')
const tempDir = path.join(__dirname, '.tmp')
const preparedDir = path.join(tempDir, 'prepared')
const segmentDir = path.join(tempDir, 'segments')
const sceneDir = path.join(tempDir, 'scenes')
const reviewDir = path.join(__dirname, 'review')

const outputBase = 'interventionalpulm-linkedin-new-modules'
const videoPath = path.join(__dirname, `${outputBase}.mp4`)
const posterPath = path.join(__dirname, `${outputBase}-poster.png`)
const probePath = path.join(__dirname, `${outputBase}.ffprobe.json`)
const contactSheetPath = path.join(__dirname, `${outputBase}-contact-sheet.png`)
const manifestPath = path.join(__dirname, `${outputBase}-manifest.json`)
const silentVideoPath = path.join(tempDir, `${outputBase}-silent.mp4`)
const concatListPath = path.join(tempDir, 'scenes.concat.txt')
const defaultAudioPath = '/Users/russellmiller/Movies/promption_audio.mp3'
const audioPath = process.env.LINKEDIN_PROMO_AUDIO || defaultAudioPath

const width = 1080
const height = 1350
const fps = 30
const totalDuration = 48.8

const captureCard = {
  x: 60,
  y: 462,
  width: 960,
  height: 602,
  contentWidth: 952,
  contentHeight: 594,
}

const colors = {
  bg: '#050e18',
  bg2: '#0a1a2b',
  ink: '#f7fbff',
  muted: '#aabbd0',
  dim: '#71859b',
  cyan: '#58e8f6',
  cyan2: '#12a8e8',
  mint: '#79ffc4',
  teal: '#2dd4bf',
  amber: '#f2b84b',
  violet: '#a78bfa',
  stroke: '#2a4963',
}

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, Helvetica, Arial, sans-serif"

const scenes = [
  {
    id: 'hero',
    start: 0,
    duration: 3,
  },
  {
    id: 'rigid',
    start: 3,
    duration: 6.8,
    eyebrow: 'RIGID BRONCHOSCOPY • 3D LAB',
    title: ['Assemble. Orient. Navigate.'],
    body: [
      'Connect the components, then translate scope orientation',
      'into deliberate airway positioning at the carina.',
    ],
    tag: 'EXPLODED VIEW • AIRWAY PLACEMENT',
    note: 'Conceptual educational model • device setups vary',
    clipSegments: [
      {
        id: 'rigid-assembly',
        inputStart: 4.6,
        inputDuration: 6.2,
        duration: 3.4,
      },
      {
        id: 'rigid-airway',
        inputStart: 12.73,
        inputDuration: 6.42,
        duration: 3.4,
      },
    ],
  },
  {
    id: 'stent',
    start: 9.8,
    duration: 6.8,
    eyebrow: 'AIRWAY STENTS • 3D EXPLORER',
    title: ['Compare architectures.', 'Reveal mechanics.'],
    body: [
      'Inspect deformation, wall contact, and design landmarks',
      'across silicone and self-expanding stent types.',
    ],
    tag: 'SILICONE • SELF-EXPANDING • PLACEMENT CUES',
    note: 'Qualitative educational models • not patient-specific',
    clipSegments: [
      {
        id: 'stent-comparison',
        inputStart: 0.2,
        inputDuration: 8,
        duration: 6.8,
      },
    ],
  },
  {
    id: 'laser',
    start: 16.6,
    duration: 4.2,
    eyebrow: 'LASER ABLATION • PHYSICS LAB',
    title: ['Aim the fiber.', 'Watch tissue respond.'],
    body: [
      'Change wavelength, power density, and distance, then',
      'sweep across simulated tissue to compare effects.',
    ],
    tag: 'KTP • POWER DENSITY • LIVE TISSUE RESPONSE',
    note: 'Schematic educational model • not procedural guidance',
    captureSegments: [{ id: 'laser-tissue-sweep', duration: 4.2 }],
  },
  {
    id: 'vio3',
    start: 20.8,
    duration: 6,
    eyebrow: 'THERMAL ABLATION • ELECTROSURGERY',
    title: ['Drive a simulated', 'VIO 3 console.'],
    body: [
      'Switch modes, compare live waveforms, and visualize',
      'argon plasma coagulation at the tissue surface.',
    ],
    tag: 'APC • LIVE TISSUE EFFECT',
    note: 'Schematic teaching replica • not an Erbe product',
    captureSegments: [
      { id: 'vio3-apc', duration: 1.9 },
      { id: 'vio3-tissue', duration: 4.1 },
    ],
  },
  {
    id: 'peripheral',
    start: 26.8,
    duration: 4.6,
    eyebrow: 'PERIPHERAL ABLATION • ZONE SIMULATOR',
    title: ['Build the zone.', 'Protect the margin.'],
    body: [
      'Compare RFA and PEF, reveal heat-sink, and test',
      'whether the model clears a 5 mm target margin.',
    ],
    tag: 'RFA • PEF • HEAT-SINK • 5 MM MARGIN',
    note: 'Schematic model • PEF and transbronchial delivery remain investigational',
    captureSegments: [
      { id: 'peripheral-rfa-vessel', duration: 1.4 },
      { id: 'peripheral-pef-zone', duration: 3.2 },
    ],
  },
  {
    id: 'ebus',
    start: 31.4,
    duration: 6,
    eyebrow: 'UPDATED EBUS SIMULATOR',
    title: ['Navigate anatomy, scope view,', 'and a live EBUS sector.'],
    body: [
      'Advance through the airway, snap to a nodal station,',
      'then roll the ultrasound plane—all in sync.',
    ],
    tag: 'SYNCHRONIZED TRI-VIEW',
    note: 'Orientation-training simulation • not diagnostic imaging',
    captureSegments: [
      { id: 'ebus-advance', duration: 2.2 },
      { id: 'ebus-station7', duration: 1.6 },
      { id: 'ebus-roll', duration: 2.2 },
    ],
  },
  {
    id: 'tracheostomy',
    start: 37.4,
    duration: 6,
    eyebrow: 'TRACHEOSTOMY KNOWLEDGE LAB',
    title: ['Rotate the tube.', 'Explode every component.'],
    body: [
      'Connect cuff, cannula, obturator, flange, and pilot system',
      'to the shared airway mental model.',
    ],
    tag: 'SEGMENTED 3D MODEL',
    note: 'Adult professional education and simulation',
    captureSegments: [
      { id: 'tracheostomy-rotate', duration: 2.6 },
      { id: 'tracheostomy-explode', duration: 3.4 },
    ],
  },
  {
    id: 'cta',
    start: 43.4,
    duration: 5.4,
  },
]

const captureRoutes = {
  'laser-tissue-sweep': '/thermal-ablation/index.html#power',
  'vio3-apc': '/thermal-ablation/index.html#sim',
  'vio3-tissue': '/thermal-ablation/index.html#sim',
  'peripheral-rfa-vessel': '/peripheral-ablation/index.html#simulator',
  'peripheral-pef-zone': '/peripheral-ablation/index.html#simulator',
  'ebus-advance':
    '/socal-ebus-course/app/index.html?locale=en&publicTraining=1&publicScope=ebus#/simulator',
  'ebus-station7':
    '/socal-ebus-course/app/index.html?locale=en&publicTraining=1&publicScope=ebus#/simulator',
  'ebus-roll':
    '/socal-ebus-course/app/index.html?locale=en&publicTraining=1&publicScope=ebus#/simulator',
  'tracheostomy-rotate': '/en/tracheostomy/learn',
  'tracheostomy-explode': '/en/tracheostomy/learn',
}

const sourceClips = {
  'rigid-assembly': {
    sourcePath: path.join(sourceDir, 'rigid-demo.mp4'),
  },
  'rigid-airway': {
    sourcePath: path.join(sourceDir, 'rigid-demo.mp4'),
  },
  'stent-comparison': {
    sourcePath: path.join(sourceDir, 'stent.mp4'),
  },
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function textLines(lines, x, y, options = {}) {
  const {
    fontSize = 56,
    lineHeight = 1.08,
    weight = 850,
    fill = colors.ink,
    anchor = 'start',
  } = options

  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="${fontStack}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${anchor}">
      ${lines
        .map(
          (line, index) =>
            `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${escapeXml(line)}</tspan>`,
        )
        .join('')}
    </text>
  `
}

function baseSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colors.bg}" />
          <stop offset="58%" stop-color="#071524" />
          <stop offset="100%" stop-color="${colors.bg2}" />
        </linearGradient>
        <radialGradient id="glowA" cx="0.05" cy="0.1" r="0.8">
          <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="0.95" cy="0.75" r="0.7">
          <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#14b8a6" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect width="${width}" height="${height}" fill="url(#glowA)" />
      <rect width="${width}" height="${height}" fill="url(#glowB)" />
      <path d="M-80 1180 C220 1030 420 1140 650 1010 C860 890 1000 980 1180 840" fill="none" stroke="#2dd4bf" stroke-opacity="0.09" stroke-width="110" />
      <path d="M-80 1140 C220 990 420 1100 650 970 C860 850 1000 940 1180 800" fill="none" stroke="#58e8f6" stroke-opacity="0.12" stroke-width="3" />
    </svg>
  `
}

function brandHeader() {
  return `
    <g>
      <rect x="60" y="54" width="112" height="44" rx="22" fill="#0b2a3e" stroke="#2a617d" />
      <text x="116" y="83" fill="${colors.cyan}" font-family="${fontStack}" font-size="18" font-weight="850" text-anchor="middle" letter-spacing="1.8">IP LAB</text>
      <text x="1020" y="84" fill="${colors.muted}" font-family="${fontStack}" font-size="21" font-weight="700" text-anchor="end">interventionalpulm.com</text>
    </g>
  `
}

function footer(globalProgress) {
  const progressWidth = Math.max(10, 960 * globalProgress)
  return `
    <g>
      <text x="60" y="1252" fill="${colors.dim}" font-family="${fontStack}" font-size="18" font-weight="650">Educational simulation only</text>
      <text x="1020" y="1252" fill="${colors.dim}" font-family="${fontStack}" font-size="18" font-weight="650" text-anchor="end">Free interactive IP education</text>
      <rect x="60" y="1282" width="960" height="8" rx="4" fill="#1b3044" />
      <rect x="60" y="1282" width="${progressWidth.toFixed(1)}" height="8" rx="4" fill="${colors.teal}" />
    </g>
  `
}

function capturedSceneOverlay(scene, globalProgress) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#00060c" flood-opacity="0.5" />
        </filter>
      </defs>
      ${brandHeader()}
      <text x="60" y="155" fill="${scene.id === 'vio3' ? '#c4b5fd' : colors.cyan}" font-family="${fontStack}" font-size="21" font-weight="850" letter-spacing="2.1">${escapeXml(scene.eyebrow)}</text>
      ${textLines(scene.title, 60, 224, { fontSize: scene.id === 'ebus' ? 49 : 55 })}
      ${textLines(scene.body, 60, 362, { fontSize: 24, lineHeight: 1.32, weight: 540, fill: colors.muted })}
      <rect x="${captureCard.x - 4}" y="${captureCard.y - 4}" width="${captureCard.width + 8}" height="${captureCard.height + 8}" rx="32" fill="none" stroke="${scene.id === 'vio3' ? colors.violet : colors.stroke}" stroke-width="2" filter="url(#shadow)" />
      <g>
        <rect x="82" y="486" width="${Math.max(190, scene.tag.length * 13.2 + 44)}" height="40" rx="20" fill="#06131f" fill-opacity="0.9" stroke="${scene.id === 'vio3' ? '#7358b6' : '#2b667c'}" />
        <circle cx="105" cy="506" r="6" fill="${scene.id === 'vio3' ? colors.violet : colors.mint}" />
        <text x="122" y="513" fill="${colors.ink}" font-family="${fontStack}" font-size="17" font-weight="820" letter-spacing="0.8">${escapeXml(scene.tag)}</text>
      </g>
      <text x="60" y="1120" fill="${scene.id === 'vio3' ? '#d6c9ff' : colors.muted}" font-family="${fontStack}" font-size="20" font-weight="700">${escapeXml(scene.note)}</text>
      ${footer(globalProgress)}
    </svg>
  `
}

function immersiveClipOverlay(scene, globalProgress) {
  const tagWidth = Math.min(900, Math.max(260, scene.tag.length * 12.4 + 48))
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="clipTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#020910" stop-opacity="0.98" />
          <stop offset="72%" stop-color="#020910" stop-opacity="0.72" />
          <stop offset="100%" stop-color="#020910" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="clipBottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#020910" stop-opacity="0" />
          <stop offset="30%" stop-color="#020910" stop-opacity="0.78" />
          <stop offset="100%" stop-color="#020910" stop-opacity="0.99" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="390" fill="url(#clipTop)" />
      <rect y="960" width="${width}" height="390" fill="url(#clipBottom)" />
      ${brandHeader()}
      <text x="60" y="154" fill="${scene.id === 'rigid' ? colors.cyan : colors.mint}" font-family="${fontStack}" font-size="21" font-weight="850" letter-spacing="2.1">${escapeXml(scene.eyebrow)}</text>
      ${textLines(scene.title, 60, 222, { fontSize: scene.id === 'rigid' ? 58 : 52, lineHeight: 1.02 })}
      <rect x="60" y="1022" width="${tagWidth}" height="42" rx="21" fill="#06131f" fill-opacity="0.92" stroke="#34766f" />
      <circle cx="84" cy="1043" r="6" fill="${scene.id === 'rigid' ? colors.cyan : colors.mint}" />
      <text x="102" y="1050" fill="${colors.ink}" font-family="${fontStack}" font-size="17" font-weight="820" letter-spacing="0.7">${escapeXml(scene.tag)}</text>
      ${textLines(scene.body, 60, 1112, { fontSize: 22, lineHeight: 1.28, weight: 560, fill: colors.muted })}
      <text x="60" y="1204" fill="${colors.muted}" font-family="${fontStack}" font-size="19" font-weight="700">${escapeXml(scene.note)}</text>
      ${footer(globalProgress)}
    </svg>
  `
}

function heroOverlay(globalProgress) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${colors.cyan2}" />
          <stop offset="55%" stop-color="${colors.teal}" />
          <stop offset="100%" stop-color="${colors.amber}" />
        </linearGradient>
        <filter id="heroShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#00060c" flood-opacity="0.55" />
        </filter>
      </defs>
      ${brandHeader()}
      <text x="60" y="205" fill="${colors.cyan}" font-family="${fontStack}" font-size="23" font-weight="850" letter-spacing="2.3">NEW INTERACTIVE MODULES</text>
      ${textLines(['Therapeutic bronchoscopy.'], 60, 318, { fontSize: 69, lineHeight: 1.02, weight: 900 })}
      ${textLines(['Ablation. EBUS. Tracheostomy.'], 60, 402, { fontSize: 57, lineHeight: 1.02, weight: 900, fill: colors.mint })}
      ${textLines(['Hands-on learning built for visual, practice-first', 'interventional pulmonology education.'], 60, 520, { fontSize: 28, lineHeight: 1.38, weight: 540, fill: colors.muted })}
      <g filter="url(#heroShadow)">
        <rect x="60" y="650" width="960" height="328" rx="40" fill="#081a2a" stroke="#27455f" />
        <path d="M116 880 C218 760 330 840 430 724 C544 590 676 760 790 654 C876 574 928 652 972 612" fill="none" stroke="url(#heroLine)" stroke-width="10" stroke-linecap="round" />
        <circle cx="430" cy="724" r="16" fill="${colors.amber}" stroke="#fff1c2" stroke-width="5" />
        <circle cx="790" cy="654" r="16" fill="${colors.violet}" stroke="#ede9fe" stroke-width="5" />
        <rect x="116" y="694" width="190" height="48" rx="24" fill="#0a3247" stroke="#2a6881" />
        <text x="211" y="725" fill="#d9f8ff" font-family="${fontStack}" font-size="20" font-weight="800" text-anchor="middle">3D anatomy</text>
        <rect x="116" y="766" width="210" height="48" rx="24" fill="#14372f" stroke="#347968" />
        <text x="221" y="797" fill="#dcfff4" font-family="${fontStack}" font-size="20" font-weight="800" text-anchor="middle">Live simulators</text>
        <rect x="116" y="838" width="216" height="48" rx="24" fill="#33274d" stroke="#765f9f" />
        <text x="224" y="869" fill="#f0e9ff" font-family="${fontStack}" font-size="20" font-weight="800" text-anchor="middle">Decision practice</text>
      </g>
      <rect x="60" y="1056" width="370" height="66" rx="33" fill="${colors.teal}" />
      <text x="245" y="1097" fill="#03151d" font-family="${fontStack}" font-size="24" font-weight="900" text-anchor="middle">See what’s new →</text>
      ${footer(globalProgress)}
    </svg>
  `
}

function ctaOverlay(globalProgress) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="ctaCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0a2940" />
          <stop offset="60%" stop-color="#0a2334" />
          <stop offset="100%" stop-color="#123b36" />
        </linearGradient>
        <filter id="ctaShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#00060c" flood-opacity="0.55" />
        </filter>
      </defs>
      ${brandHeader()}
      <text x="540" y="235" fill="${colors.cyan}" font-family="${fontStack}" font-size="23" font-weight="850" text-anchor="middle" letter-spacing="2.2">FREE INTERACTIVE IP EDUCATION</text>
      ${textLines(['Practice between cases.'], 540, 352, { fontSize: 72, anchor: 'middle', weight: 920 })}
      ${textLines(['Explore the new modules and create a free account', 'to save and track your progress.'], 540, 444, { fontSize: 28, lineHeight: 1.4, anchor: 'middle', weight: 540, fill: colors.muted })}
      <g filter="url(#ctaShadow)">
        <rect x="96" y="600" width="888" height="404" rx="44" fill="url(#ctaCard)" stroke="#2b6076" />
        <text x="540" y="724" fill="#bceff5" font-family="${fontStack}" font-size="25" font-weight="800" text-anchor="middle" letter-spacing="1.2">INTERVENTIONALPULM.COM</text>
        <text x="540" y="838" fill="${colors.ink}" font-family="${fontStack}" font-size="58" font-weight="920" text-anchor="middle">Build procedural intuition.</text>
        <rect x="306" y="890" width="468" height="72" rx="36" fill="${colors.teal}" />
        <text x="540" y="935" fill="#03151d" font-family="${fontStack}" font-size="27" font-weight="920" text-anchor="middle">Create a free account</text>
      </g>
      <text x="540" y="1112" fill="${colors.muted}" font-family="${fontStack}" font-size="21" font-weight="700" text-anchor="middle">Therapeutic • Peripheral ablation • EBUS • Tracheostomy</text>
      ${footer(globalProgress)}
    </svg>
  `
}

function runFfmpeg(args, label) {
  const result = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'warning', ...args], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`${label} failed with ffmpeg status ${result.status}`)
  }
}

async function listCaptureFrames(captureId) {
  const directory = path.join(captureDir, captureId)
  if (!existsSync(directory)) {
    throw new Error(`Missing capture directory: ${directory}`)
  }
  return (await fs.readdir(directory))
    .filter((file) => file.endsWith('.png'))
    .sort()
    .map((file) => path.join(directory, file))
}

async function prepareCapture(captureId) {
  const sourceFrames = await listCaptureFrames(captureId)
  const destination = path.join(preparedDir, captureId)
  await fs.mkdir(destination, { recursive: true })

  const roundedMask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${captureCard.contentWidth}" height="${captureCard.contentHeight}">
      <rect width="${captureCard.contentWidth}" height="${captureCard.contentHeight}" rx="26" fill="#fff" />
    </svg>
  `)
  const border = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${captureCard.width}" height="${captureCard.height}">
      <rect x="4" y="4" width="${captureCard.contentWidth}" height="${captureCard.contentHeight}" rx="27" fill="none" stroke="#365b72" stroke-width="2" />
    </svg>
  `)

  for (let index = 0; index < sourceFrames.length; index += 1) {
    const screenshot = await sharp(sourceFrames[index], { failOn: 'none' })
      .rotate()
      .resize(captureCard.contentWidth, captureCard.contentHeight, { fit: 'cover' })
      .modulate({ brightness: 0.98, saturation: 1.04 })
      .ensureAlpha()
      .composite([{ input: roundedMask, blend: 'dest-in' }])
      .png({ compressionLevel: 7 })
      .toBuffer()

    const outputPath = path.join(destination, `frame_${String(index).padStart(3, '0')}.png`)
    await sharp({
      create: {
        width: captureCard.width,
        height: captureCard.height,
        channels: 4,
        background: { r: 3, g: 12, b: 20, alpha: 0 },
      },
    })
      .composite([
        { input: screenshot, left: 4, top: 4 },
        { input: border, left: 0, top: 0 },
      ])
      .png({ compressionLevel: 7 })
      .toFile(outputPath)
  }

  return sourceFrames.length
}

function encodeCaptureSegment(captureId, duration, frameCount, outputPath) {
  const inputPattern = path.join(preparedDir, captureId, 'frame_%03d.png')
  const frameRate = frameCount === 1 ? fps : frameCount / duration
  const inputArgs =
    frameCount === 1
      ? [
          '-loop',
          '1',
          '-framerate',
          String(fps),
          '-i',
          path.join(preparedDir, captureId, 'frame_000.png'),
        ]
      : ['-framerate', frameRate.toFixed(6), '-i', inputPattern]

  runFfmpeg(
    [
      ...inputArgs,
      '-t',
      String(duration),
      '-vf',
      `framerate=fps=${fps}:interp_start=0:interp_end=255:scene=100,format=yuv420p`,
      '-an',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(fps),
      '-crf',
      '16',
      '-preset',
      'fast',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    `Capture segment ${captureId}`,
  )
}

async function encodeSceneCapture(scene, captureCounts) {
  const segmentPaths = []
  for (let index = 0; index < scene.captureSegments.length; index += 1) {
    const segment = scene.captureSegments[index]
    const segmentPath = path.join(segmentDir, `${scene.id}-${String(index).padStart(2, '0')}.mp4`)
    encodeCaptureSegment(segment.id, segment.duration, captureCounts[segment.id], segmentPath)
    segmentPaths.push(segmentPath)
  }

  if (segmentPaths.length === 1) return segmentPaths[0]

  const listPath = path.join(segmentDir, `${scene.id}.concat.txt`)
  await fs.writeFile(
    listPath,
    `${segmentPaths.map((segmentPath) => `file '${segmentPath.replaceAll("'", "'\\''")}'`).join('\n')}\n`,
  )
  const outputPath = path.join(segmentDir, `${scene.id}-capture.mp4`)
  runFfmpeg(
    ['-f', 'concat', '-safe', '0', '-i', listPath, '-an', '-c:v', 'copy', outputPath],
    `Concatenate ${scene.id} capture`,
  )
  return outputPath
}

function encodeClipSegment(segment, outputPath) {
  const clip = sourceClips[segment.id]
  if (!clip) throw new Error(`Missing source clip configuration: ${segment.id}`)
  if (!existsSync(clip.sourcePath)) throw new Error(`Missing source clip: ${clip.sourcePath}`)

  const timelineScale = segment.duration / segment.inputDuration
  runFfmpeg(
    [
      '-ss',
      String(segment.inputStart),
      '-t',
      String(segment.inputDuration),
      '-i',
      clip.sourcePath,
      '-vf',
      `setpts=(PTS-STARTPTS)*${timelineScale.toFixed(8)},fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x020910,setsar=1,format=yuv420p`,
      '-t',
      String(segment.duration),
      '-an',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(fps),
      '-crf',
      '16',
      '-preset',
      'fast',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    `Source clip segment ${segment.id}`,
  )
}

async function encodeSceneClip(scene) {
  const segmentPaths = []
  for (let index = 0; index < scene.clipSegments.length; index += 1) {
    const segment = scene.clipSegments[index]
    const segmentPath = path.join(
      segmentDir,
      `${scene.id}-clip-${String(index).padStart(2, '0')}.mp4`,
    )
    encodeClipSegment(segment, segmentPath)
    segmentPaths.push(segmentPath)
  }

  if (segmentPaths.length === 1) return segmentPaths[0]

  const listPath = path.join(segmentDir, `${scene.id}-clip.concat.txt`)
  await fs.writeFile(
    listPath,
    `${segmentPaths.map((segmentPath) => `file '${segmentPath.replaceAll("'", "'\\''")}'`).join('\n')}\n`,
  )
  const outputPath = path.join(segmentDir, `${scene.id}-clip.mp4`)
  runFfmpeg(
    ['-f', 'concat', '-safe', '0', '-i', listPath, '-an', '-c:v', 'copy', outputPath],
    `Concatenate ${scene.id} source clips`,
  )
  return outputPath
}

async function writeOverlay(scene, outputPath) {
  const progress = Math.min(1, (scene.start + scene.duration) / totalDuration)
  const overlay =
    scene.id === 'hero'
      ? heroOverlay(progress)
      : scene.id === 'cta'
        ? ctaOverlay(progress)
        : scene.clipSegments
          ? immersiveClipOverlay(scene, progress)
          : capturedSceneOverlay(scene, progress)
  await sharp(Buffer.from(overlay)).png({ compressionLevel: 9 }).toFile(outputPath)
}

function composeScene(scene, basePath, overlayPath, capturePath, clipPath) {
  const outputPath = path.join(sceneDir, `${scene.id}.mp4`)
  const sharedEncoding = [
    '-t',
    String(scene.duration),
    '-an',
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-level',
    '4.1',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-g',
    String(fps),
    '-keyint_min',
    String(fps),
    '-sc_threshold',
    '0',
    '-x264-params',
    'open-gop=0',
    '-crf',
    '18',
    '-preset',
    'medium',
    '-movflags',
    '+faststart',
    outputPath,
  ]

  if (clipPath) {
    runFfmpeg(
      [
        '-i',
        clipPath,
        '-loop',
        '1',
        '-framerate',
        String(fps),
        '-i',
        overlayPath,
        '-filter_complex',
        '[0:v][1:v]overlay=0:0:shortest=1,format=yuv420p[v]',
        '-map',
        '[v]',
        ...sharedEncoding,
      ],
      `Compose ${scene.id}`,
    )
  } else if (capturePath) {
    runFfmpeg(
      [
        '-loop',
        '1',
        '-framerate',
        String(fps),
        '-i',
        basePath,
        '-i',
        capturePath,
        '-loop',
        '1',
        '-framerate',
        String(fps),
        '-i',
        overlayPath,
        '-filter_complex',
        `[0:v][1:v]overlay=${captureCard.x}:${captureCard.y}:shortest=1[withCapture];[withCapture][2:v]overlay=0:0:shortest=1,format=yuv420p[v]`,
        '-map',
        '[v]',
        ...sharedEncoding,
      ],
      `Compose ${scene.id}`,
    )
  } else {
    runFfmpeg(
      [
        '-loop',
        '1',
        '-framerate',
        String(fps),
        '-i',
        basePath,
        '-loop',
        '1',
        '-framerate',
        String(fps),
        '-i',
        overlayPath,
        '-filter_complex',
        '[0:v][1:v]overlay=0:0:shortest=1,format=yuv420p[v]',
        '-map',
        '[v]',
        ...sharedEncoding,
      ],
      `Compose ${scene.id}`,
    )
  }

  return outputPath
}

async function concatenateScenes(scenePaths) {
  await fs.writeFile(
    concatListPath,
    `${scenePaths.map((scenePath) => `file '${scenePath.replaceAll("'", "'\\''")}'`).join('\n')}\n`,
  )
  runFfmpeg(
    [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-an',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(fps),
      '-g',
      String(fps),
      '-keyint_min',
      String(fps),
      '-sc_threshold',
      '0',
      '-x264-params',
      'open-gop=0',
      '-crf',
      '16',
      '-preset',
      'medium',
      '-movflags',
      '+faststart',
      silentVideoPath,
    ],
    'Concatenate scenes',
  )
}

function addAudio() {
  if (!existsSync(audioPath)) {
    runFfmpeg(
      ['-i', silentVideoPath, '-an', '-c:v', 'copy', '-movflags', '+faststart', videoPath],
      'Finalize silent video',
    )
    return false
  }

  const fadeOutStart = totalDuration - 1.8
  runFfmpeg(
    [
      '-i',
      silentVideoPath,
      '-i',
      audioPath,
      '-filter_complex',
      `[1:a]atrim=duration=${totalDuration},asetpts=PTS-STARTPTS,loudnorm=I=-18:LRA=11:TP=-1.5,volume=0.48,afade=t=in:st=0:d=1.1,afade=t=out:st=${fadeOutStart}:d=1.8[aout]`,
      '-map',
      '0:v:0',
      '-map',
      '[aout]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-ar',
      '48000',
      '-t',
      String(totalDuration),
      '-movflags',
      '+faststart',
      videoPath,
    ],
    'Add background audio',
  )
  return true
}

function extractFrame(seconds, outputPath) {
  runFfmpeg(
    ['-i', videoPath, '-ss', String(seconds), '-frames:v', '1', '-update', '1', outputPath],
    `Extract review frame at ${seconds}s`,
  )
}

async function writeContactSheet(reviewFrames) {
  const cellWidth = 360
  const cellHeight = 450
  const columns = 4
  const rows = Math.ceil(reviewFrames.length / columns)
  const sheet = sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 3,
      background: colors.bg,
    },
  })
  const composites = []

  for (let index = 0; index < reviewFrames.length; index += 1) {
    const frame = await sharp(reviewFrames[index].path)
      .resize(cellWidth, cellHeight, { fit: 'cover' })
      .png()
      .toBuffer()
    composites.push({
      input: frame,
      left: (index % columns) * cellWidth,
      top: Math.floor(index / columns) * cellHeight,
    })
  }

  await sheet.composite(composites).png({ compressionLevel: 9 }).toFile(contactSheetPath)
}

function probeVideo() {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,bit_rate:stream=codec_type,codec_name,profile,width,height,avg_frame_rate,r_frame_rate,duration,nb_frames,pix_fmt,sample_rate,channels',
      '-of',
      'json',
      videoPath,
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(`ffprobe failed: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

async function sha256(filePath) {
  const buffer = await fs.readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

async function main() {
  await fs.rm(tempDir, { recursive: true, force: true })
  await fs.rm(reviewDir, { recursive: true, force: true })
  await Promise.all([
    fs.mkdir(preparedDir, { recursive: true }),
    fs.mkdir(segmentDir, { recursive: true }),
    fs.mkdir(sceneDir, { recursive: true }),
    fs.mkdir(reviewDir, { recursive: true }),
  ])

  const basePath = path.join(tempDir, 'background.png')
  await sharp(Buffer.from(baseSvg())).png({ compressionLevel: 9 }).toFile(basePath)

  const captureIds = [
    ...new Set(
      scenes.flatMap((scene) => scene.captureSegments?.map((segment) => segment.id) ?? []),
    ),
  ]
  const clipSegments = scenes.flatMap((scene) => scene.clipSegments ?? [])
  const clipIds = [...new Set(clipSegments.map((segment) => segment.id))]
  const captureCounts = {}
  for (const captureId of captureIds) {
    captureCounts[captureId] = await prepareCapture(captureId)
    console.log(`Prepared ${captureId}: ${captureCounts[captureId]} frames`)
  }

  const scenePaths = []
  for (const scene of scenes) {
    const overlayPath = path.join(tempDir, `${scene.id}-overlay.png`)
    await writeOverlay(scene, overlayPath)
    const capturePath = scene.captureSegments
      ? await encodeSceneCapture(scene, captureCounts)
      : undefined
    const clipPath = scene.clipSegments ? await encodeSceneClip(scene) : undefined
    const scenePath = composeScene(scene, basePath, overlayPath, capturePath, clipPath)
    scenePaths.push(scenePath)
    console.log(`Composed scene: ${scene.id}`)
  }

  await concatenateScenes(scenePaths)
  const hasAudio = addAudio()

  extractFrame(1.1, posterPath)
  const reviewFrames = [
    { id: 'hero', time: 1.1 },
    { id: 'rigid-assembly', time: 5.2 },
    { id: 'rigid-airway', time: 8.3 },
    { id: 'stent', time: 13.3 },
    { id: 'laser', time: 18.7 },
    { id: 'vio3', time: 23.8 },
    { id: 'peripheral-rfa', time: 27.5 },
    { id: 'peripheral-pef', time: 29.8 },
    { id: 'ebus', time: 34.4 },
    { id: 'tracheostomy', time: 40.4 },
    { id: 'cta', time: 46.1 },
  ].map((entry, index) => ({
    ...entry,
    path: path.join(reviewDir, `${String(index + 1).padStart(2, '0')}-${entry.id}.png`),
  }))
  for (const frame of reviewFrames) extractFrame(frame.time, frame.path)
  await writeContactSheet(reviewFrames)

  const probe = probeVideo()
  await fs.writeFile(probePath, `${JSON.stringify(probe, null, 2)}\n`)

  const manifest = {
    generatedAt: new Date().toISOString(),
    output: path.relative(rootDir, videoPath),
    poster: path.relative(rootDir, posterPath),
    contactSheet: path.relative(rootDir, contactSheetPath),
    spec: {
      width,
      height,
      fps,
      durationSeconds: totalDuration,
      videoCodec: 'H.264 High',
      pixelFormat: 'yuv420p',
      audio: hasAudio ? 'AAC 48 kHz, 160 kbps' : 'none',
    },
    audio: hasAudio
      ? {
          source: audioPath,
          sha256: await sha256(audioPath),
        }
      : null,
    scenes: scenes.map(({ captureSegments, clipSegments: sceneClipSegments, ...scene }) => ({
      ...scene,
      captures: captureSegments ?? [],
      clips: sceneClipSegments ?? [],
    })),
    captures: Object.fromEntries(
      captureIds.map((captureId) => [
        captureId,
        {
          directory: path.relative(rootDir, path.join(captureDir, captureId)),
          frameCount: captureCounts[captureId],
          route: captureRoutes[captureId],
        },
      ]),
    ),
    sourceClips: Object.fromEntries(
      await Promise.all(
        clipIds.map(async (clipId) => {
          const clip = sourceClips[clipId]
          const segment = clipSegments.find((entry) => entry.id === clipId)
          return [
            clipId,
            {
              file: path.relative(rootDir, clip.sourcePath),
              sha256: await sha256(clip.sourcePath),
              inputStart: segment.inputStart,
              inputDuration: segment.inputDuration,
              outputDuration: segment.duration,
            },
          ]
        }),
      ),
    ),
    notes: [
      'All on-screen copy is burned in for muted autoplay.',
      'The supplied rigid-bronchoscopy and airway-stent clips are used full-frame with source audio removed.',
      'The laser scene uses the live KTP power-density lab and is labeled as a schematic educational model.',
      'The VIO 3 scene is explicitly labeled as a schematic teaching replica and not an Erbe product.',
      'The peripheral-ablation scene contrasts an RFA heat-sink result with a PEF margin animation; PEF and transbronchial delivery are labeled investigational.',
      'The EBUS embed is a generated sync output captured from the current sibling EBUS-course build.',
      'Clinical visuals are educational simulations and not patient-specific or diagnostic tools.',
    ],
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  if (process.env.KEEP_PROMO_TMP !== '1') {
    await fs.rm(tempDir, { recursive: true, force: true })
  }

  console.log(
    JSON.stringify(
      {
        videoPath,
        posterPath,
        contactSheetPath,
        probePath,
        manifestPath,
        hasAudio,
        durationSeconds: totalDuration,
      },
      null,
      2,
    ),
  )
}

await main()
