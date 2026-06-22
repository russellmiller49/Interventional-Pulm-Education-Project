import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const outputDir = __dirname
const frameDir = path.join(outputDir, 'frames')
const videoPath = path.join(outputDir, 'interventionalpulm-linkedin-podcast-library.mp4')
const posterPath = path.join(outputDir, 'interventionalpulm-linkedin-podcast-library-poster.png')
const publicVideoPath = path.join(rootDir, 'public/videos/interventionalpulm-podcast-library-promo.mp4')
const publicPosterPath = path.join(
  rootDir,
  'public/videos/interventionalpulm-podcast-library-promo-poster.png',
)

const width = 1080
const height = 1080
const fps = 30
const totalDuration = 52.2
const totalFrames = Math.round(totalDuration * fps)

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, Helvetica, Arial, sans-serif"

const colors = {
  paper: '#f6f9fc',
  paper2: '#eaf1f8',
  ink: '#102033',
  muted: '#627286',
  soft: '#d8e3ee',
  dark: '#0b1b2b',
  dark2: '#132a42',
  teal: '#0f9f95',
  cyan: '#1f89d0',
  coral: '#e85d4f',
  gold: '#d89b25',
  violet: '#6862d9',
  green: '#28a66a',
  white: '#ffffff',
}

const scenes = [
  {
    id: 'hook',
    start: 0,
    duration: 7.2,
    eyebrow: 'IP JOURNAL REVIEW',
    title: 'The literature keeps moving.',
    body: "Your time to read it doesn't.",
  },
  {
    id: 'offer',
    start: 7.2,
    duration: 7.4,
    eyebrow: 'A DIFFERENT WAY TO STAY CURRENT',
    title: 'Free podcast library built around IP journal review.',
    body: 'Listen while you commute, prep, chart, or reset between cases.',
  },
  {
    id: 'scale',
    start: 14.6,
    duration: 7.8,
    eyebrow: 'AVAILABLE NOW',
    title: '50+ episodes. Five languages.',
    body: 'English, Spanish, Arabic, Korean, and Mandarin. New episodes every month.',
  },
  {
    id: 'depth',
    start: 22.4,
    duration: 9.2,
    eyebrow: 'MORE THAN QUICK SUMMARIES',
    title: 'Each episode works through the evidence.',
    body: 'Study design, results, procedural implications, and limitations.',
  },
  {
    id: 'practice',
    start: 31.6,
    duration: 9.2,
    eyebrow: 'THE QUESTION THAT MATTERS',
    title: 'How should this change practice?',
    body: 'Move from paper to procedure with context you can actually use.',
  },
  {
    id: 'audience',
    start: 40.8,
    duration: 6,
    eyebrow: 'MADE FOR PROCEDURAL TEAMS',
    title: 'Pulmonologists, fellows, and everyone at the table.',
    body: 'A shared listening library for the people doing the work.',
  },
  {
    id: 'cta',
    start: 46.8,
    duration: 5.4,
    eyebrow: 'COMPLETELY FREE',
    title: 'Sign up and start listening.',
    body: 'interventionalpulm.com',
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

function easeInOutCubic(value) {
  const t = clamp(value)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function textLines(text, maxChars) {
  const words = String(text).split(/\s+/)
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
    fontSize = 42,
    lineHeight = 1.12,
    weight = 780,
    fill = colors.ink,
    anchor = 'start',
    opacity = 1,
  } = options
  const lines = textLines(text, maxChars)

  return `
    <text x="${x}" y="${y}" fill="${fill}" opacity="${opacity}" font-family="${fontStack}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="0">
      ${lines
        .map(
          (line, index) =>
            `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${escapeXml(line)}</tspan>`,
        )
        .join('')}
    </text>
  `
}

function limitedMultilineText(text, x, y, options = {}) {
  const {
    maxChars = 28,
    maxLines = 4,
    fontSize = 22,
    lineHeight = 1.12,
    weight = 760,
    fill = colors.ink,
    anchor = 'start',
    opacity = 1,
  } = options
  const lines = textLines(text, maxChars)
  const visibleLines = lines.slice(0, maxLines)

  if (lines.length > maxLines && visibleLines.length) {
    visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1].replace(/[.,:;]+$/, '')}...`
  }

  return `
    <text x="${x}" y="${y}" fill="${fill}" opacity="${opacity}" font-family="${fontStack}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="0">
      ${visibleLines
        .map(
          (line, index) =>
            `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${escapeXml(line)}</tspan>`,
        )
        .join('')}
    </text>
  `
}

function chip(label, x, y, options = {}) {
  const {
    fill = colors.white,
    stroke = colors.soft,
    text = colors.ink,
    accent = colors.teal,
    fontSize = 21,
    height: chipHeight = 48,
    width: explicitWidth,
    opacity = 1,
  } = options
  const estimatedWidth = explicitWidth ?? Math.max(112, label.length * fontSize * 0.56 + 52)

  return `
    <g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${estimatedWidth.toFixed(1)}" height="${chipHeight}" rx="${chipHeight / 2}" fill="${fill}" stroke="${stroke}" />
      <circle cx="${x + 24}" cy="${y + chipHeight / 2}" r="7" fill="${accent}" />
      <text x="${x + 42}" y="${y + chipHeight / 2 + fontSize * 0.34}" fill="${text}" font-family="${fontStack}" font-size="${fontSize}" font-weight="760" letter-spacing="0">${escapeXml(label)}</text>
    </g>
  `
}

function panel(x, y, w, h, options = {}) {
  const {
    fill = colors.white,
    stroke = colors.soft,
    rx = 24,
    opacity = 1,
    filter = 'url(#softShadow)',
  } = options

  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" opacity="${opacity}" filter="${filter}" />`
}

function pillButton(label, x, y, w, options = {}) {
  const { fill = colors.dark, text = colors.white, height: buttonHeight = 58, fontSize = 23 } = options
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${buttonHeight}" rx="${buttonHeight / 2}" fill="${fill}" />
    <text x="${x + w / 2}" y="${y + buttonHeight / 2 + fontSize * 0.34}" fill="${text}" font-family="${fontStack}" font-size="${fontSize}" font-weight="850" text-anchor="middle" letter-spacing="0">${escapeXml(label)}</text>
  `
}

function progressHeader(progress) {
  return `
    <text x="64" y="72" fill="${colors.ink}" font-family="${fontStack}" font-size="28" font-weight="850" letter-spacing="0">interventionalpulm.com</text>
    <text x="820" y="72" fill="${colors.muted}" font-family="${fontStack}" font-size="20" font-weight="700" letter-spacing="0">IP Journal Review</text>
    <rect x="64" y="1000" width="952" height="8" rx="4" fill="${colors.soft}" />
    <rect x="64" y="1000" width="${(952 * progress).toFixed(1)}" height="8" rx="4" fill="${colors.teal}" />
    <text x="64" y="1040" fill="${colors.muted}" font-family="${fontStack}" font-size="18" font-weight="620" letter-spacing="0">Educational content only. Verify source studies and current guidelines.</text>
  `
}

function baseSvg(progress) {
  return `
    <defs>
      <linearGradient id="pageBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.paper}" />
        <stop offset="54%" stop-color="#edf6f8" />
        <stop offset="100%" stop-color="#f8f5ef" />
      </linearGradient>
      <linearGradient id="darkCard" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.dark}" />
        <stop offset="100%" stop-color="${colors.dark2}" />
      </linearGradient>
      <linearGradient id="tealCard" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.teal}" />
        <stop offset="100%" stop-color="${colors.cyan}" />
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#24364d" flood-opacity="0.18"/>
      </filter>
      <filter id="darkShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#00121f" flood-opacity="0.28"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#pageBg)" />
    <path d="M0 160 C180 112 296 120 446 166 C636 226 842 188 1080 98 L1080 0 L0 0 Z" fill="#dcecf6" opacity="0.74" />
    <path d="M0 870 C230 804 422 846 604 902 C760 950 892 940 1080 870 L1080 1080 L0 1080 Z" fill="#eaf3ee" opacity="0.85" />
    ${progressHeader(progress)}
  `
}

function sceneHeader(scene, localT) {
  const intro = easeOutCubic(localT / 0.22)
  const yShift = (1 - intro) * 22
  const titleMaxChars = scene.id === 'hook' ? 15 : 28
  return `
    <g opacity="${intro}">
      <text x="72" y="${158 + yShift}" fill="${colors.teal}" font-family="${fontStack}" font-size="21" font-weight="860" letter-spacing="0">${escapeXml(scene.eyebrow)}</text>
      ${multilineText(scene.title, 72, 236 + yShift, {
        maxChars: titleMaxChars,
        fontSize: scene.title.length > 50 ? 52 : 58,
        lineHeight: 1.04,
        weight: 860,
      })}
      ${multilineText(scene.body, 72, 390 + yShift, {
        maxChars: 54,
        fontSize: 26,
        lineHeight: 1.22,
        weight: 560,
        fill: colors.muted,
      })}
    </g>
  `
}

function articleCard(title, journal, x, y, w, h, options = {}) {
  const { accent = colors.cyan, rotate = 0, opacity = 1, scale = 1 } = options
  const titleFont = title.length > 80 ? 19 : 22
  return `
    <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" opacity="${opacity}">
      ${panel(0, 0, w, h, { rx: 22, filter: 'url(#softShadow)' })}
      <rect x="0" y="0" width="${w}" height="12" rx="6" fill="${accent}" />
      ${limitedMultilineText(title, 24, 54, {
        maxChars: 26,
        maxLines: 5,
        fontSize: titleFont,
        lineHeight: 1.12,
        weight: 800,
        fill: colors.ink,
      })}
      <text x="24" y="${h - 54}" fill="${colors.muted}" font-family="${fontStack}" font-size="17" font-weight="650" letter-spacing="0">${escapeXml(journal)}</text>
      <rect x="24" y="${h - 34}" width="${w - 48}" height="6" rx="3" fill="${colors.paper2}" />
      <rect x="24" y="${h - 34}" width="${(w - 48) * 0.58}" height="6" rx="3" fill="${accent}" opacity="0.75" />
    </g>
  `
}

function waveform(x, y, bars, options = {}) {
  const { color = colors.teal, width: barWidth = 8, gap = 7, maxHeight = 74, seed = 1, progress = 0 } = options
  const items = []
  for (let i = 0; i < bars; i += 1) {
    const wave = 0.36 + 0.64 * Math.abs(Math.sin((i + 1) * 1.31 + seed))
    const h = Math.max(12, wave * maxHeight)
    const active = i / bars <= progress
    items.push(
      `<rect x="${x + i * (barWidth + gap)}" y="${y - h / 2}" width="${barWidth}" height="${h}" rx="${barWidth / 2}" fill="${active ? color : colors.soft}" opacity="${active ? 0.95 : 0.84}" />`,
    )
  }
  return items.join('')
}

function playButton(cx, cy, r, options = {}) {
  const { fill = colors.teal, triangle = colors.white } = options
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />
    <path d="M${cx - r * 0.24} ${cy - r * 0.36} L${cx - r * 0.24} ${cy + r * 0.36} L${cx + r * 0.42} ${cy} Z" fill="${triangle}" />
  `
}

function hookScene(scene, localT, metadata) {
  const t = easeInOutCubic(localT)
  const drift = Math.sin(localT * Math.PI * 2.4) * 6
  const titles = metadata.titles
  const counter = Math.floor(8 + t * 42)

  return `
    ${sceneHeader(scene, localT)}
    <g transform="translate(0 ${(1 - easeOutCubic(localT / 0.36)) * 26})">
      ${articleCard(titles[0] ?? 'Bronchoscopic diagnosis and staging of lung cancer', 'J Bronchology Interv Pulmonol', 596 + drift, 188, 330, 250, {
        accent: colors.cyan,
        rotate: -5,
        opacity: 0.96,
      })}
      ${articleCard(titles[4] ?? 'Navigational bronchoscopy or transthoracic biopsy', 'AnnalsATS', 668 - drift, 406, 322, 232, {
        accent: colors.coral,
        rotate: 4,
        opacity: 0.94,
      })}
      ${articleCard(titles[7] ?? 'Indocyanine green fiducial markers', 'Chest', 558 + drift * 0.4, 642, 362, 232, {
        accent: colors.gold,
        rotate: -2,
        opacity: 0.96,
      })}
      <g filter="url(#softShadow)">
        <rect x="72" y="542" width="420" height="196" rx="28" fill="url(#darkCard)" />
        <text x="112" y="604" fill="${colors.white}" font-family="${fontStack}" font-size="24" font-weight="740" letter-spacing="0">Studies keep coming</text>
        <text x="112" y="674" fill="${colors.white}" font-family="${fontStack}" font-size="76" font-weight="900" letter-spacing="0">${counter}</text>
        <text x="234" y="674" fill="#b8cadb" font-family="${fontStack}" font-size="27" font-weight="760" letter-spacing="0">new signals</text>
      </g>
      <path d="M126 810 H430" stroke="${colors.coral}" stroke-width="10" stroke-linecap="round" opacity="${0.25 + t * 0.45}" />
      <text x="72" y="872" fill="${colors.coral}" font-family="${fontStack}" font-size="32" font-weight="850" letter-spacing="0">Reading time is the bottleneck.</text>
    </g>
  `
}

function offerScene(scene, localT, metadata) {
  const t = easeOutCubic(localT / 0.42)
  const playerProgress = clamp((localT - 0.08) / 0.72)
  const pulse = 1 + Math.sin(localT * Math.PI * 6) * 0.015
  const title = metadata.titles[1] ?? 'Ground-glass nodule nomogram and pathology prediction'

  return `
    ${sceneHeader(scene, localT)}
    <g transform="translate(0 ${(1 - t) * 28})" opacity="${t}">
      ${panel(76, 514, 928, 350, { fill: colors.white, stroke: '#cfdae6', rx: 34 })}
      <rect x="116" y="554" width="344" height="258" rx="28" fill="url(#tealCard)" filter="url(#darkShadow)" />
      <text x="152" y="618" fill="${colors.white}" font-family="${fontStack}" font-size="22" font-weight="830" letter-spacing="0">IP JOURNAL REVIEW</text>
      <text x="152" y="684" fill="${colors.white}" font-family="${fontStack}" font-size="44" font-weight="900" letter-spacing="0">Podcast</text>
      <text x="152" y="730" fill="#e8ffff" font-family="${fontStack}" font-size="24" font-weight="680" letter-spacing="0">Article-focused audio</text>
      <g transform="translate(346 722) scale(${pulse})">
        ${playButton(0, 0, 42, { fill: colors.white, triangle: colors.teal })}
      </g>
      <text x="512" y="586" fill="${colors.muted}" font-family="${fontStack}" font-size="19" font-weight="760" letter-spacing="0">NOW PLAYING</text>
      ${multilineText(title, 512, 634, {
        maxChars: 31,
        fontSize: 28,
        lineHeight: 1.12,
        weight: 850,
        fill: colors.ink,
      })}
      <rect x="512" y="748" width="392" height="8" rx="4" fill="${colors.paper2}" />
      <rect x="512" y="748" width="${392 * playerProgress}" height="8" rx="4" fill="${colors.teal}" />
      <g transform="translate(512 808)">
        ${waveform(0, 0, 28, { progress: playerProgress, seed: 2, maxHeight: 48, barWidth: 6, gap: 6 })}
      </g>
      ${chip('Free', 798, 558, { accent: colors.green, width: 112, height: 42, fontSize: 18 })}
    </g>
  `
}

function scaleScene(scene, localT, metadata) {
  const t = easeOutCubic(localT / 0.48)
  const count = Math.max(metadata.episodeCount, 50)
  const countNow = Math.round(12 + (count - 12) * easeOutCubic(clamp((localT - 0.05) / 0.54)))
  const languages = [
    ['English', colors.cyan],
    ['Spanish', colors.coral],
    ['Arabic', colors.gold],
    ['Korean', colors.violet],
    ['Mandarin', colors.green],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      <g filter="url(#softShadow)">
        <rect x="84" y="518" width="382" height="314" rx="34" fill="url(#darkCard)" />
        <text x="126" y="592" fill="#b9d8ef" font-family="${fontStack}" font-size="24" font-weight="760" letter-spacing="0">Episodes available</text>
        <text x="126" y="704" fill="${colors.white}" font-family="${fontStack}" font-size="116" font-weight="930" letter-spacing="0">${countNow}</text>
        <text x="306" y="704" fill="${colors.teal}" font-family="${fontStack}" font-size="86" font-weight="930" letter-spacing="0">+</text>
        <text x="126" y="766" fill="#d7e4ef" font-family="${fontStack}" font-size="24" font-weight="690" letter-spacing="0">New episodes monthly</text>
      </g>
      <g transform="translate(${(1 - t) * 22} 0)">
        ${languages
          .map((item, index) => {
            const [label, accent] = item
            const x = 532 + (index % 2) * 218
            const y = 524 + Math.floor(index / 2) * 82
            return chip(label, x, y, {
              accent,
              width: index === 4 ? 280 : 190,
              height: 58,
              fontSize: 22,
              opacity: clamp((localT - 0.08 * index) / 0.32),
            })
          })
          .join('')}
      </g>
      <g>
        <text x="534" y="804" fill="${colors.ink}" font-family="${fontStack}" font-size="27" font-weight="840" letter-spacing="0">Seven topic hubs</text>
        <rect x="534" y="834" width="404" height="8" rx="4" fill="${colors.paper2}" />
        <rect x="534" y="834" width="${404 * clamp((localT - 0.24) / 0.62)}" height="8" rx="4" fill="${colors.gold}" />
        <text x="534" y="888" fill="${colors.muted}" font-family="${fontStack}" font-size="22" font-weight="610" letter-spacing="0">Nodules, staging, airway, pleura, BLVR, safety.</text>
      </g>
    </g>
  `
}

function depthScene(scene, localT) {
  const t = easeOutCubic(localT / 0.44)
  const steps = [
    ['Study design', 'What was tested?', colors.cyan],
    ['Key results', 'What changed?', colors.green],
    ['Procedural implications', 'What matters in the room?', colors.coral],
    ['Limitations', 'What should stay uncertain?', colors.gold],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      <g transform="translate(76 518)">
        ${steps
          .map(([label, detail, accent], index) => {
            const x = (index % 2) * 466
            const y = Math.floor(index / 2) * 166
            const reveal = clamp((localT - index * 0.12) / 0.34)
            return `
              <g transform="translate(${x} ${y + (1 - reveal) * 18})" opacity="${reveal}">
                ${panel(0, 0, 430, 134, { fill: colors.white, rx: 26 })}
                <rect x="28" y="26" width="54" height="54" rx="16" fill="${accent}" />
                <text x="55" y="63" fill="${colors.white}" font-family="${fontStack}" font-size="25" font-weight="900" text-anchor="middle" letter-spacing="0">${index + 1}</text>
                <text x="106" y="60" fill="${colors.ink}" font-family="${fontStack}" font-size="27" font-weight="850" letter-spacing="0">${escapeXml(label)}</text>
                <text x="106" y="96" fill="${colors.muted}" font-family="${fontStack}" font-size="20" font-weight="610" letter-spacing="0">${escapeXml(detail)}</text>
              </g>
            `
          })
          .join('')}
      </g>
      <g filter="url(#softShadow)">
        <rect x="142" y="874" width="796" height="78" rx="39" fill="${colors.dark}" />
        <text x="540" y="924" fill="${colors.white}" font-family="${fontStack}" font-size="28" font-weight="860" text-anchor="middle" letter-spacing="0">Not just what the paper says. What it means.</text>
      </g>
    </g>
  `
}

function practiceScene(scene, localT) {
  const t = easeOutCubic(localT / 0.42)
  const lineProgress = clamp((localT - 0.16) / 0.68)
  const checkpoints = [
    ['Evidence', 170, colors.cyan],
    ['Procedure', 420, colors.teal],
    ['Limitations', 670, colors.gold],
    ['Practice', 920, colors.coral],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      ${panel(86, 510, 908, 238, { fill: colors.white, rx: 34 })}
      <text x="540" y="602" fill="${colors.ink}" font-family="${fontStack}" font-size="43" font-weight="900" text-anchor="middle" letter-spacing="0">How should this change</text>
      <text x="540" y="656" fill="${colors.teal}" font-family="${fontStack}" font-size="48" font-weight="920" text-anchor="middle" letter-spacing="0">the way we practice?</text>
      <g transform="translate(0 826)">
        <path d="M170 0 H920" stroke="${colors.soft}" stroke-width="12" stroke-linecap="round" />
        <path d="M170 0 H${170 + 750 * lineProgress}" stroke="${colors.teal}" stroke-width="12" stroke-linecap="round" />
        ${checkpoints
          .map(([label, x, accent], index) => {
            const reveal = clamp((lineProgress - index * 0.23) / 0.14)
            return `
              <g opacity="${0.38 + reveal * 0.62}">
                <circle cx="${x}" cy="0" r="28" fill="${reveal > 0.1 ? accent : colors.paper2}" stroke="${colors.white}" stroke-width="8" filter="url(#softShadow)" />
                <text x="${x}" y="70" fill="${colors.ink}" font-family="${fontStack}" font-size="22" font-weight="820" text-anchor="middle" letter-spacing="0">${escapeXml(label)}</text>
              </g>
            `
          })
          .join('')}
      </g>
    </g>
  `
}

function personIcon(x, y, label, accent, reveal) {
  return `
    <g transform="translate(${x} ${y + (1 - reveal) * 18})" opacity="${reveal}">
      ${panel(0, 0, 278, 270, { fill: colors.white, rx: 32 })}
      <circle cx="139" cy="82" r="44" fill="${accent}" />
      <path d="M84 210 C94 154 118 134 139 134 C160 134 184 154 194 210 Z" fill="${accent}" opacity="0.84" />
      <text x="139" y="236" fill="${colors.ink}" font-family="${fontStack}" font-size="25" font-weight="860" text-anchor="middle" letter-spacing="0">${escapeXml(label)}</text>
    </g>
  `
}

function audienceScene(scene, localT) {
  const t = easeOutCubic(localT / 0.36)
  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      ${personIcon(90, 538, 'Pulmonologists', colors.cyan, clamp((localT - 0.02) / 0.3))}
      ${personIcon(402, 538, 'Fellows', colors.teal, clamp((localT - 0.14) / 0.3))}
      ${personIcon(714, 538, 'Procedural teams', colors.coral, clamp((localT - 0.26) / 0.3))}
      <g filter="url(#softShadow)">
        <rect x="178" y="878" width="724" height="70" rx="35" fill="${colors.dark}" />
        <text x="540" y="923" fill="${colors.white}" font-family="${fontStack}" font-size="25" font-weight="830" text-anchor="middle" letter-spacing="0">Shared language for journal review and procedural judgment.</text>
      </g>
    </g>
  `
}

function ctaScene(scene, localT) {
  const t = easeOutCubic(localT / 0.34)
  const progress = clamp(localT / 0.88)

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}" transform="translate(0 ${(1 - t) * 24})">
      ${panel(94, 486, 892, 386, { fill: colors.white, stroke: '#ccd9e4', rx: 36 })}
      <text x="144" y="554" fill="${colors.muted}" font-family="${fontStack}" font-size="21" font-weight="760" letter-spacing="0">PODCAST LIBRARY</text>
      <text x="144" y="616" fill="${colors.ink}" font-family="${fontStack}" font-size="48" font-weight="920" letter-spacing="0">Journal Club Podcasts</text>
      <text x="144" y="662" fill="${colors.muted}" font-family="${fontStack}" font-size="23" font-weight="610" letter-spacing="0">Free signup. Start listening today.</text>
      ${pillButton('Sign up free', 144, 720, 220, { fill: colors.teal })}
      ${pillButton('Start listening', 384, 720, 246, { fill: colors.dark })}
      <g transform="translate(690 552)">
        ${playButton(70, 70, 58, { fill: colors.coral, triangle: colors.white })}
        <text x="70" y="166" fill="${colors.ink}" font-family="${fontStack}" font-size="22" font-weight="850" text-anchor="middle" letter-spacing="0">50+ episodes</text>
      </g>
      <g transform="translate(144 826)">
        ${waveform(0, 0, 56, { progress, seed: 5, maxHeight: 46, barWidth: 5, gap: 5 })}
      </g>
    </g>
    <text x="540" y="958" fill="${colors.ink}" font-family="${fontStack}" font-size="38" font-weight="920" text-anchor="middle" letter-spacing="0">${escapeXml(scene.body)}</text>
  `
}

function sceneSvg(scene, localT, globalProgress, metadata) {
  let body = ''
  if (scene.id === 'hook') body = hookScene(scene, localT, metadata)
  if (scene.id === 'offer') body = offerScene(scene, localT, metadata)
  if (scene.id === 'scale') body = scaleScene(scene, localT, metadata)
  if (scene.id === 'depth') body = depthScene(scene, localT)
  if (scene.id === 'practice') body = practiceScene(scene, localT)
  if (scene.id === 'audience') body = audienceScene(scene, localT)
  if (scene.id === 'cta') body = ctaScene(scene, localT)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${baseSvg(globalProgress)}
      ${body}
    </svg>
  `
}

function sceneForTime(seconds) {
  return (
    scenes.find((scene) => seconds >= scene.start && seconds < scene.start + scene.duration) ??
    scenes[scenes.length - 1]
  )
}

async function readPodcastMetadata() {
  const sourcePath = path.join(rootDir, 'src/data/journal-club-podcasts.ts')
  const source = await fs.readFile(sourcePath, 'utf8')
  const episodeCount = (source.match(/\n\s+\{\n\s+id:\s*'/g) ?? []).length
  const titles = [...source.matchAll(/title:\s*'([\s\S]*?)',\n\s*citation:/g)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  return {
    episodeCount,
    titles,
  }
}

async function cleanFrameDir() {
  await fs.rm(frameDir, { recursive: true, force: true })
  await fs.mkdir(frameDir, { recursive: true })
}

async function renderFrames(metadata) {
  await cleanFrameDir()
  for (let index = 0; index < totalFrames; index += 1) {
    const seconds = index / fps
    const scene = sceneForTime(seconds)
    const localT = clamp((seconds - scene.start) / scene.duration)
    const svg = sceneSvg(scene, localT, index / Math.max(1, totalFrames - 1), metadata)
    const outputPath = path.join(frameDir, `frame_${String(index + 1).padStart(4, '0')}.png`)

    await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toFile(outputPath)

    if ((index + 1) % 180 === 0 || index + 1 === totalFrames) {
      console.log(`Rendered ${index + 1}/${totalFrames} frames`)
    }
  }
}

function encodeVideo() {
  const result = spawnSync(
    'ffmpeg',
    [
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
      '-profile:v',
      'high',
      '-level',
      '4.0',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(fps),
      '-movflags',
      '+faststart',
      '-crf',
      '18',
      videoPath,
    ],
    { stdio: 'inherit' },
  )

  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with status ${result.status}`)
  }
}

async function writePosterAndPublicCopies() {
  const posterFrame = path.join(frameDir, 'frame_0201.png')
  await sharp(posterFrame).png({ compressionLevel: 9 }).toFile(posterPath)
  await fs.copyFile(videoPath, publicVideoPath)
  await fs.copyFile(posterPath, publicPosterPath)
}

async function writeProbe() {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,pix_fmt',
      '-of',
      'json',
      videoPath,
    ],
    { encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error(`ffprobe exited with status ${result.status}`)
  }

  await fs.writeFile(path.join(outputDir, 'interventionalpulm-linkedin-podcast-library.ffprobe.json'), result.stdout)
}

async function main() {
  const metadata = await readPodcastMetadata()
  console.log(`Podcast manifest episodes detected: ${metadata.episodeCount}`)
  await renderFrames(metadata)
  encodeVideo()
  await writePosterAndPublicCopies()
  await writeProbe()
  console.log(`Wrote ${videoPath}`)
  console.log(`Wrote ${posterPath}`)
  console.log(`Copied ${publicVideoPath}`)
  console.log(`Copied ${publicPosterPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
