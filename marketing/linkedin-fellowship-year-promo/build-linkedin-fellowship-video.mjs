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
const outputBase = 'interventionalpulm-linkedin-fellowship-year-2026-2027'
const videoPath = path.join(outputDir, `${outputBase}.mp4`)
const posterPath = path.join(outputDir, `${outputBase}-poster.png`)
const probePath = path.join(outputDir, `${outputBase}.ffprobe.json`)
const modulesPromoDir = path.join(rootDir, 'marketing/linkedin-modules-promo')
const navClipPath = '/Users/russellmiller/Movies/NAVBRONCH.mp4'
const fluoroClipPath = '/Users/russellmiller/Movies/FLUORONAV.mp4'
const backgroundAudioPath = '/Users/russellmiller/Movies/promption_audio.mp3'

const width = 1080
const height = 1350
const fps = 30
const totalDuration = 52
const totalFrames = Math.round(totalDuration * fps)

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, Helvetica, Arial, sans-serif"

const colors = {
  paper: '#f7fbff',
  paper2: '#e8f0f7',
  ink: '#102033',
  muted: '#5d6d80',
  soft: '#cfdae6',
  dark: '#102033',
  dark2: '#193653',
  teal: '#0f9f95',
  cyan: '#1f89d0',
  coral: '#e15c4f',
  gold: '#d89b25',
  green: '#28a66a',
  white: '#ffffff',
}

const scenes = [
  {
    id: 'hook',
    start: 0,
    duration: 4,
    eyebrow: 'JULY 1, 2026',
    title: 'Today is July 1.\nFellowship starts now.',
    body: 'A new academic year for interventional pulmonary fellows.',
  },
  {
    id: 'audience',
    start: 4,
    duration: 6,
    eyebrow: 'FOR INCOMING IP FELLOWS',
    title: 'Start with the evidence, not scattered bookmarks.',
    body: 'A practical learning hub for the first year of fellowship.',
  },
  {
    id: 'landmarks',
    start: 10,
    duration: 9,
    eyebrow: 'NEW LANDMARK STUDY PODCASTS',
    title: 'Listen to the papers that shaped the field.',
    body: 'EBUS staging, navigation, pleural infection, IPC trials, BLVR, and airway stents.',
  },
  {
    id: 'scale',
    start: 19,
    duration: 8,
    eyebrow: 'JOURNAL CLUB AUDIO',
    title: 'Landmark studies plus a growing podcast library.',
    body: 'Five listening languages for learning that fits real clinical schedules.',
  },
  {
    id: 'board',
    start: 27,
    duration: 10,
    eyebrow: 'PAIR WITH IP BOARD PREP',
    title: 'High-yield chapters for the year ahead.',
    body: 'Searchable chapters, saved progress, and audio companions.',
  },
  {
    id: 'modules',
    start: 37,
    duration: 8,
    eyebrow: 'READY FOR THE YEAR AHEAD',
    title: 'Build procedural intuition between cases.',
    body: 'TNM-9 staging, EBUS training, Nav Bronch, and FluoroView.',
  },
  {
    id: 'cta',
    start: 45,
    duration: 7,
    eyebrow: 'FREE ACCOUNT ACCESS',
    title: 'Create a free account.',
    body: 'Start fellowship with tools you will actually use.',
  },
]

const moduleScene = scenes.find((scene) => scene.id === 'modules')
const moduleSceneStart = moduleScene?.start ?? 37
const moduleSceneDuration = moduleScene?.duration ?? 8

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
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
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

    if (current) {
      lines.push(current)
    }
  }

  return lines
}

function multilineText(text, x, y, options = {}) {
  const {
    maxChars = 34,
    fontSize = 42,
    lineHeight = 1.14,
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

function limitedText(text, x, y, options = {}) {
  const {
    maxChars = 30,
    maxLines = 3,
    fontSize = 22,
    lineHeight = 1.16,
    weight = 760,
    fill = colors.ink,
  } = options
  const lines = textLines(text, maxChars)
  const visible = lines.slice(0, maxLines)

  if (lines.length > maxLines && visible.length) {
    visible[visible.length - 1] = `${visible[visible.length - 1].replace(/[.,:;]+$/, '')}...`
  }

  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="${fontStack}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="0">
      ${visible
        .map(
          (line, index) =>
            `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${escapeXml(line)}</tspan>`,
        )
        .join('')}
    </text>
  `
}

function panel(x, y, w, h, options = {}) {
  const {
    fill = colors.white,
    stroke = colors.soft,
    rx = 26,
    opacity = 1,
    filter = 'url(#softShadow)',
  } = options

  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" opacity="${opacity}" filter="${filter}" />`
}

function chip(label, x, y, options = {}) {
  const {
    fill = colors.white,
    stroke = colors.soft,
    text = colors.ink,
    accent = colors.teal,
    fontSize = 21,
    height: chipHeight = 50,
    width: explicitWidth,
    opacity = 1,
  } = options
  const estimatedWidth = explicitWidth ?? Math.max(128, label.length * fontSize * 0.56 + 54)

  return `
    <g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${estimatedWidth.toFixed(1)}" height="${chipHeight}" rx="${chipHeight / 2}" fill="${fill}" stroke="${stroke}" />
      <circle cx="${x + 25}" cy="${y + chipHeight / 2}" r="7" fill="${accent}" />
      <text x="${x + 44}" y="${y + chipHeight / 2 + fontSize * 0.34}" fill="${text}" font-family="${fontStack}" font-size="${fontSize}" font-weight="760" letter-spacing="0">${escapeXml(label)}</text>
    </g>
  `
}

function statCard(label, value, x, y, w, options = {}) {
  const { accent = colors.teal, sublabel = '' } = options
  return `
    <g>
      ${panel(x, y, w, 162, { rx: 28 })}
      <text x="${x + 28}" y="${y + 48}" fill="${colors.muted}" font-family="${fontStack}" font-size="20" font-weight="760" letter-spacing="0">${escapeXml(label)}</text>
      <text x="${x + 28}" y="${y + 112}" fill="${accent}" font-family="${fontStack}" font-size="58" font-weight="930" letter-spacing="0">${escapeXml(value)}</text>
      ${
        sublabel
          ? `<text x="${x + 28}" y="${y + 142}" fill="${colors.muted}" font-family="${fontStack}" font-size="18" font-weight="620" letter-spacing="0">${escapeXml(sublabel)}</text>`
          : ''
      }
    </g>
  `
}

function boardBenefitCard(label, value, x, y, w, options = {}) {
  const { accent = colors.teal, sublabel = '', valueFontSize } = options
  const fontSize = valueFontSize ?? (String(value).length > 5 ? 40 : 58)

  return `
    <g>
      ${panel(x, y, w, 162, { rx: 28 })}
      <text x="${x + 28}" y="${y + 48}" fill="${colors.muted}" font-family="${fontStack}" font-size="20" font-weight="760" letter-spacing="0">${escapeXml(label)}</text>
      <text x="${x + 28}" y="${y + 112}" fill="${accent}" font-family="${fontStack}" font-size="${fontSize}" font-weight="930" letter-spacing="0">${escapeXml(value)}</text>
      ${
        sublabel
          ? `<text x="${x + 28}" y="${y + 142}" fill="${colors.muted}" font-family="${fontStack}" font-size="18" font-weight="620" letter-spacing="0">${escapeXml(sublabel)}</text>`
          : ''
      }
    </g>
  `
}

function playButton(cx, cy, r, options = {}) {
  const { fill = colors.teal, triangle = colors.white } = options
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />
    <path d="M${cx - r * 0.24} ${cy - r * 0.36} L${cx - r * 0.24} ${cy + r * 0.36} L${cx + r * 0.42} ${cy} Z" fill="${triangle}" />
  `
}

function waveform(x, y, bars, options = {}) {
  const {
    color = colors.teal,
    width: barWidth = 7,
    gap = 7,
    maxHeight = 72,
    seed = 1,
    progress = 0,
  } = options
  const items = []

  for (let i = 0; i < bars; i += 1) {
    const wave = 0.34 + 0.66 * Math.abs(Math.sin((i + 1) * 1.31 + seed))
    const h = Math.max(12, wave * maxHeight)
    const active = i / bars <= progress
    items.push(
      `<rect x="${x + i * (barWidth + gap)}" y="${y - h / 2}" width="${barWidth}" height="${h}" rx="${barWidth / 2}" fill="${active ? color : colors.soft}" opacity="${active ? 0.95 : 0.82}" />`,
    )
  }

  return items.join('')
}

function articleCard(title, tag, x, y, w, h, options = {}) {
  const { accent = colors.cyan, rotate = 0, opacity = 1 } = options

  return `
    <g transform="translate(${x} ${y}) rotate(${rotate})" opacity="${opacity}">
      ${panel(0, 0, w, h, { rx: 24 })}
      <rect x="0" y="0" width="${w}" height="12" rx="6" fill="${accent}" />
      ${limitedText(title, 24, 54, {
        maxChars: 26,
        maxLines: 4,
        fontSize: title.length > 78 ? 19 : 22,
        fill: colors.ink,
      })}
      <rect x="24" y="${h - 62}" width="${Math.min(w - 48, tag.length * 11 + 54)}" height="38" rx="19" fill="${colors.paper2}" />
      <text x="44" y="${h - 38}" fill="${colors.muted}" font-family="${fontStack}" font-size="17" font-weight="760" letter-spacing="0">${escapeXml(tag)}</text>
    </g>
  `
}

function imageTag(id, x, y, w, h, href, options = {}) {
  const { rx = 24, fit = 'slice', opacity = 1 } = options
  const preserve = fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'

  return `
    <clipPath id="${id}Clip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" /></clipPath>
    <image x="${x}" y="${y}" width="${w}" height="${h}" href="${href}" preserveAspectRatio="${preserve}" clip-path="url(#${id}Clip)" opacity="${opacity}" />
  `
}

function pillButton(label, x, y, w, options = {}) {
  const {
    fill = colors.dark,
    text = colors.white,
    height: buttonHeight = 64,
    fontSize = 24,
  } = options

  return `
    <rect x="${x}" y="${y}" width="${w}" height="${buttonHeight}" rx="${buttonHeight / 2}" fill="${fill}" />
    <text x="${x + w / 2}" y="${y + buttonHeight / 2 + fontSize * 0.34}" fill="${text}" font-family="${fontStack}" font-size="${fontSize}" font-weight="860" text-anchor="middle" letter-spacing="0">${escapeXml(label)}</text>
  `
}

function baseSvg(progress) {
  return `
    <defs>
      <linearGradient id="pageBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.paper}" />
        <stop offset="58%" stop-color="#edf7f8" />
        <stop offset="100%" stop-color="#f9f7f1" />
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
        <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#24364d" flood-opacity="0.16"/>
      </filter>
      <filter id="darkShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#00121f" flood-opacity="0.24"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#pageBg)" />
    <path d="M0 164 C172 106 328 132 492 174 C684 224 844 184 1080 88 L1080 0 L0 0 Z" fill="#dcecf6" opacity="0.78" />
    <path d="M0 1118 C214 1056 396 1100 610 1158 C770 1202 920 1192 1080 1124 L1080 1350 L0 1350 Z" fill="#e9f4ef" opacity="0.9" />
    <text x="64" y="72" fill="${colors.ink}" font-family="${fontStack}" font-size="29" font-weight="850" letter-spacing="0">interventionalpulm.com</text>
    <text x="740" y="72" fill="${colors.muted}" font-family="${fontStack}" font-size="20" font-weight="720" letter-spacing="0">First Day of Fellowship</text>
    <rect x="64" y="1264" width="952" height="8" rx="4" fill="${colors.soft}" />
    <rect x="64" y="1264" width="${(952 * progress).toFixed(1)}" height="8" rx="4" fill="${colors.teal}" />
    <text x="64" y="1308" fill="${colors.muted}" font-family="${fontStack}" font-size="18" font-weight="620" letter-spacing="0">Educational content only. Verify source studies and current guidelines.</text>
  `
}

function sceneHeader(scene, localT) {
  const intro = easeOutCubic(localT / 0.24)
  const yShift = (1 - intro) * 24
  const titleFont =
    scene.id === 'hook' ? 63 : scene.title.length > 50 ? 52 : scene.title.length > 40 ? 56 : 60

  return `
    <g opacity="${intro}">
      <text x="72" y="${158 + yShift}" fill="${colors.teal}" font-family="${fontStack}" font-size="22" font-weight="860" letter-spacing="0">${escapeXml(scene.eyebrow)}</text>
      ${multilineText(scene.title, 72, 238 + yShift, {
        maxChars: scene.id === 'hook' ? 18 : 30,
        fontSize: titleFont,
        lineHeight: 1.04,
        weight: 880,
      })}
      ${multilineText(scene.body, 72, scene.id === 'hook' ? 410 + yShift : 394 + yShift, {
        maxChars: 54,
        fontSize: 27,
        lineHeight: 1.22,
        weight: 560,
        fill: colors.muted,
      })}
    </g>
  `
}

function hookScene(scene, localT) {
  const t = easeOutCubic(localT / 0.42)
  const sweep = easeInOutCubic(localT) * 720

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}" transform="translate(0 ${(1 - t) * 28})">
      <g filter="url(#darkShadow)">
        <rect x="88" y="548" width="904" height="352" rx="42" fill="url(#darkCard)" />
        <text x="138" y="640" fill="#b9d8ef" font-family="${fontStack}" font-size="26" font-weight="760" letter-spacing="0">ACADEMIC YEAR</text>
        <text x="138" y="742" fill="${colors.white}" font-family="${fontStack}" font-size="92" font-weight="940" letter-spacing="0">2026-2027</text>
        <text x="138" y="820" fill="#e8f4ff" font-family="${fontStack}" font-size="34" font-weight="780" letter-spacing="0">First day of fellowship</text>
        <rect x="724" y="596" width="188" height="188" rx="36" fill="${colors.white}" />
        <text x="818" y="670" fill="${colors.coral}" font-family="${fontStack}" font-size="28" font-weight="900" text-anchor="middle" letter-spacing="0">JULY</text>
        <text x="818" y="756" fill="${colors.ink}" font-family="${fontStack}" font-size="88" font-weight="940" text-anchor="middle" letter-spacing="0">1</text>
      </g>
      <path d="M132 996 H948" stroke="${colors.soft}" stroke-width="12" stroke-linecap="round" />
      <path d="M132 996 H${132 + sweep}" stroke="${colors.teal}" stroke-width="12" stroke-linecap="round" />
      <text x="540" y="1066" fill="${colors.ink}" font-family="${fontStack}" font-size="33" font-weight="860" text-anchor="middle" letter-spacing="0">Start the year with evidence, practice, and review.</text>
    </g>
  `
}

function audienceScene(scene, localT) {
  const t = easeOutCubic(localT / 0.38)
  const cards = [
    ['Landmark studies', 'Know the papers people cite.', colors.cyan],
    ['Board prep', 'Review high-yield IP chapters.', colors.teal],
    ['Simulation tools', 'Build intuition before cases.', colors.coral],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      <g transform="translate(88 532)">
        ${cards
          .map(([label, detail, accent], index) => {
            const reveal = clamp((localT - index * 0.11) / 0.34)
            return `
              <g transform="translate(0 ${index * 182 + (1 - reveal) * 22})" opacity="${reveal}">
                ${panel(0, 0, 904, 142, { rx: 30 })}
                <rect x="34" y="34" width="72" height="72" rx="22" fill="${accent}" />
                <text x="70" y="82" fill="${colors.white}" font-family="${fontStack}" font-size="30" font-weight="900" text-anchor="middle" letter-spacing="0">${index + 1}</text>
                <text x="136" y="62" fill="${colors.ink}" font-family="${fontStack}" font-size="32" font-weight="860" letter-spacing="0">${escapeXml(label)}</text>
                <text x="136" y="102" fill="${colors.muted}" font-family="${fontStack}" font-size="23" font-weight="610" letter-spacing="0">${escapeXml(detail)}</text>
                <rect x="690" y="58" width="${150 + index * 32}" height="10" rx="5" fill="${accent}" opacity="0.7" />
              </g>
            `
          })
          .join('')}
      </g>
      <g filter="url(#softShadow)">
        <rect x="158" y="1110" width="764" height="72" rx="36" fill="${colors.dark}" />
        <text x="540" y="1156" fill="${colors.white}" font-family="${fontStack}" font-size="27" font-weight="850" text-anchor="middle" letter-spacing="0">One place to start, review, and come back to.</text>
      </g>
    </g>
  `
}

function landmarksScene(scene, localT, metrics) {
  const t = easeOutCubic(localT / 0.4)
  const titles = metrics.landmarkTitles
  const topics = [
    ['EBUS staging', colors.cyan],
    ['Navigation vs TTNB', colors.coral],
    ['Pleural infection', colors.green],
    ['IPC trials', colors.gold],
    ['BLVR', colors.teal],
    ['Airway stents', colors.cyan],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      ${articleCard(titles[0] ?? 'Navigational Bronchoscopy or Transthoracic Needle Biopsy for Lung Nodules', 'Landmark Study', 82, 520, 322, 238, {
        accent: colors.cyan,
        rotate: -3,
        opacity: clamp((localT - 0.04) / 0.32),
      })}
      ${articleCard(titles[1] ?? 'Intrapleural Use of Tissue Plasminogen Activator and DNase in Pleural Infection', 'Landmark Study', 394, 578, 326, 242, {
        accent: colors.green,
        rotate: 2,
        opacity: clamp((localT - 0.14) / 0.32),
      })}
      ${articleCard(titles[4] ?? 'A Dedicated Tracheobronchial Stent', 'Landmark Study', 698, 508, 300, 228, {
        accent: colors.gold,
        rotate: 4,
        opacity: clamp((localT - 0.22) / 0.32),
      })}
      ${topics
        .map(([label, accent], index) => {
          const x = 88 + (index % 3) * 314
          const y = 884 + Math.floor(index / 3) * 76
          return chip(label, x, y, {
            accent,
            width: 282,
            height: 56,
            opacity: clamp((localT - 0.34 - index * 0.035) / 0.28),
          })
        })
        .join('')}
      ${statCard('LANDMARK EPISODES', String(metrics.landmarkEpisodes), 352, 1084, 376, {
        accent: colors.coral,
        sublabel: 'curated for IP journal review',
      })}
    </g>
  `
}

function scaleScene(scene, localT, metrics) {
  const t = easeOutCubic(localT / 0.4)
  const waveProgress = clamp((localT - 0.08) / 0.78)
  const languages = [
    ['English', colors.cyan],
    ['Spanish', colors.coral],
    ['Mandarin', colors.green],
    ['Arabic', colors.gold],
    ['Korean', colors.teal],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      ${statCard('LANDMARK', String(metrics.landmarkEpisodes), 72, 520, 282, {
        accent: colors.coral,
        sublabel: 'study podcasts',
      })}
      ${statCard('JOURNAL CLUB', String(metrics.podcastEpisodes), 399, 520, 282, {
        accent: colors.teal,
        sublabel: 'total episodes',
      })}
      ${statCard('LANGUAGES', String(metrics.languages), 726, 520, 282, {
        accent: colors.cyan,
        sublabel: 'for every episode',
      })}
      <g filter="url(#softShadow)">
        <rect x="94" y="748" width="892" height="190" rx="34" fill="${colors.white}" stroke="${colors.soft}" />
        <text x="144" y="816" fill="${colors.ink}" font-family="${fontStack}" font-size="34" font-weight="880" letter-spacing="0">Listen while you commute, prep, chart, or reset.</text>
        <g transform="translate(144 884)">
          ${waveform(0, 0, 58, { progress: waveProgress, seed: 5, maxHeight: 62, barWidth: 6, gap: 6 })}
        </g>
      </g>
      ${languages
        .map(([label, accent], index) => {
          const x = 100 + (index % 3) * 300
          const y = 1000 + Math.floor(index / 3) * 76
          return chip(label, x, y, {
            accent,
            width: index === 2 ? 264 : 242,
            height: 56,
            opacity: clamp((localT - 0.3 - index * 0.045) / 0.26),
          })
        })
        .join('')}
    </g>
  `
}

function boardScene(scene, localT, metrics, assets) {
  const t = easeOutCubic(localT / 0.42)
  const chapters = [
    ['Airway', colors.cyan],
    ['Oncology', colors.teal],
    ['Pleura', colors.green],
    ['Navigation', colors.coral],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      ${boardBenefitCard('CHAPTERS', String(metrics.boardChapters), 72, 508, 218, {
        accent: colors.teal,
        sublabel: 'exam-ready modules',
      })}
      ${boardBenefitCard('SEARCH', 'Topics', 314, 508, 218, {
        accent: colors.cyan,
        sublabel: 'find the right chapter',
        valueFontSize: 42,
      })}
      ${boardBenefitCard('PROGRESS', 'Saved', 556, 508, 218, {
        accent: colors.coral,
        sublabel: 'track review locally',
        valueFontSize: 42,
      })}
      ${boardBenefitCard('AUDIO', 'Listen', 798, 508, 218, {
        accent: colors.gold,
        sublabel: 'chapter companions',
        valueFontSize: 38,
      })}
      <g transform="translate(96 724)" filter="url(#softShadow)">
        <rect x="0" y="0" width="888" height="318" rx="34" fill="${colors.white}" stroke="${colors.soft}" />
        ${imageTag('boardPrepScreenshot', 22, 22, 844, 274, assets.boardPrep, {
          rx: 24,
          fit: 'slice',
          opacity: 0.98,
        })}
        <rect x="22" y="22" width="844" height="274" rx="24" fill="none" stroke="${colors.soft}" opacity="0.8" />
      </g>
      <g transform="translate(112 1072)">
        ${chapters
          .map(([label, accent], index) => {
            const x = index * 222
            const reveal = clamp((localT - 0.14 - index * 0.09) / 0.3)
            return `
              <g transform="translate(${x} ${(1 - reveal) * 18})" opacity="${reveal}">
                <rect x="0" y="0" width="194" height="56" rx="28" fill="${colors.white}" stroke="${colors.soft}" filter="url(#softShadow)" />
                <circle cx="31" cy="28" r="8" fill="${accent}" />
                <text x="52" y="36" fill="${colors.ink}" font-family="${fontStack}" font-size="21" font-weight="820" letter-spacing="0">${escapeXml(label)}</text>
              </g>
            `
          })
          .join('')}
      </g>
      <text x="540" y="1176" fill="${colors.ink}" font-family="${fontStack}" font-size="31" font-weight="860" text-anchor="middle" letter-spacing="0">Pair the podcast evidence with the real board-prep catalog.</text>
    </g>
  `
}

function moduleCard(label, detail, x, y, accent, reveal, imageHref, id) {
  return `
    <g transform="translate(${x} ${y + (1 - reveal) * 18})" opacity="${reveal}">
      ${panel(0, 0, 424, 246, { rx: 30 })}
      <rect x="0" y="0" width="424" height="12" rx="6" fill="${accent}" />
      ${imageTag(id, 20, 28, 384, 124, imageHref, { rx: 20, fit: 'slice' })}
      <rect x="20" y="28" width="384" height="124" rx="20" fill="none" stroke="${colors.soft}" opacity="0.8" />
      <text x="30" y="188" fill="${colors.ink}" font-family="${fontStack}" font-size="28" font-weight="880" letter-spacing="0">${escapeXml(label)}</text>
      ${multilineText(detail, 30, 218, {
        maxChars: 38,
        fontSize: 17,
        lineHeight: 1.2,
        weight: 610,
        fill: colors.muted,
      })}
    </g>
  `
}

function modulesScene(scene, localT, assets) {
  const t = easeOutCubic(localT / 0.4)
  const modules = [
    [
      'TNM-9',
      'Interactive staging descriptors and case practice.',
      colors.cyan,
      assets.home,
      'tnmScreenshot',
    ],
    [
      'EBUS Training',
      'Knobology, stations, and image correlation.',
      colors.teal,
      assets.ebusTraining,
      'ebusScreenshot',
    ],
    [
      'Nav Bronch',
      'Plan an airway route and rehearse navigation to a target.',
      colors.coral,
      assets.navigationWrapper,
      'navClipFrame',
    ],
    [
      'FluoroView',
      'Practice CT-to-fluoro orientation and lesion localization.',
      colors.gold,
      assets.fluoroView,
      'fluoroClipFrame',
    ],
  ]

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}">
      ${modules
        .map(([label, detail, accent], index) => {
          const x = 92 + (index % 2) * 470
          const y = 504 + Math.floor(index / 2) * 286
          const imageHref = modules[index][3]
          const id = modules[index][4]
          return moduleCard(
            label,
            detail,
            x,
            y,
            accent,
            clamp((localT - 0.1 - index * 0.08) / 0.3),
            imageHref,
            id,
          )
        })
        .join('')}
      <g filter="url(#softShadow)">
        <rect x="114" y="1104" width="852" height="80" rx="40" fill="${colors.dark}" />
        <text x="540" y="1155" fill="${colors.white}" font-family="${fontStack}" font-size="28" font-weight="860" text-anchor="middle" letter-spacing="0">Real site tools for procedural mental models.</text>
      </g>
    </g>
  `
}

function ctaScene(scene, localT) {
  const t = easeOutCubic(localT / 0.36)
  const waveProgress = clamp(localT / 0.88)

  return `
    ${sceneHeader(scene, localT)}
    <g opacity="${t}" transform="translate(0 ${(1 - t) * 24})">
      <g filter="url(#darkShadow)">
        <rect x="92" y="520" width="896" height="452" rx="44" fill="url(#darkCard)" />
        <text x="540" y="614" fill="#b9d8ef" font-family="${fontStack}" font-size="26" font-weight="760" text-anchor="middle" letter-spacing="0">INTERVENTIONALPULM.COM</text>
        <text x="540" y="714" fill="${colors.white}" font-family="${fontStack}" font-size="62" font-weight="930" text-anchor="middle" letter-spacing="0">Start fellowship</text>
        <text x="540" y="786" fill="${colors.teal}" font-family="${fontStack}" font-size="62" font-weight="930" text-anchor="middle" letter-spacing="0">with practical tools.</text>
        ${pillButton('Create free account', 332, 840, 416, { fill: colors.teal, text: colors.white })}
      </g>
      <g transform="translate(226 1056)">
        ${playButton(42, 0, 42, { fill: colors.coral })}
        <g transform="translate(110 0)">
          ${waveform(0, 0, 48, { progress: waveProgress, seed: 7, maxHeight: 56, barWidth: 6, gap: 6 })}
        </g>
      </g>
      <text x="540" y="1166" fill="${colors.ink}" font-family="${fontStack}" font-size="31" font-weight="870" text-anchor="middle" letter-spacing="0">New Landmark Study podcasts are ready today.</text>
    </g>
  `
}

function sceneSvg(scene, localT, globalProgress, metrics) {
  let body = ''
  if (scene.id === 'hook') body = hookScene(scene, localT, metrics)
  if (scene.id === 'audience') body = audienceScene(scene, localT, metrics)
  if (scene.id === 'landmarks') body = landmarksScene(scene, localT, metrics)
  if (scene.id === 'scale') body = scaleScene(scene, localT, metrics)
  if (scene.id === 'board') body = boardScene(scene, localT, metrics, metrics.assets)
  if (scene.id === 'modules') body = modulesScene(scene, localT, metrics.assets)
  if (scene.id === 'cta') body = ctaScene(scene, localT, metrics)

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

async function loadAssets() {
  const [home, boardPrep, ebusTraining, navigationWrapper, fluoroView] = await Promise.all([
      imageDataUri(path.join(modulesPromoDir, 'screenshots/home.png'), {
        extract: { left: 0, top: 130, width: 1440, height: 880 },
        resize: { width: 620, height: 220, fit: 'cover' },
      }),
      imageDataUri(path.join(modulesPromoDir, 'screenshots/board-prep.png'), {
        extract: { left: 0, top: 110, width: 1440, height: 980 },
        resize: { width: 920, height: 360, fit: 'cover' },
      }),
      imageDataUri(path.join(modulesPromoDir, 'screenshots/ebus-training.png'), {
        extract: { left: 0, top: 120, width: 1440, height: 920 },
        resize: { width: 620, height: 220, fit: 'cover' },
      }),
      imageDataUri(path.join(modulesPromoDir, 'screenshots/navigation-wrapper.png'), {
        extract: { left: 0, top: 120, width: 1440, height: 920 },
        resize: { width: 620, height: 220, fit: 'cover' },
      }),
      imageDataUri(path.join(modulesPromoDir, 'screenshots/fluoroview.png'), {
        extract: { left: 0, top: 120, width: 1440, height: 920 },
        resize: { width: 620, height: 220, fit: 'cover' },
      }),
    ])

  return {
    home,
    boardPrep,
    ebusTraining,
    navigationWrapper,
    fluoroView,
  }
}

function readRepoMetrics() {
  const tsxPath = path.join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
  )
  const inlineScript = `
    import { journalClubPodcastEpisodes, landmarkJournalClubPodcastHub, podcastLanguages } from './src/data/journal-club-podcasts.ts';
    import { boardReviewChapters } from './src/data/board-review.ts';

    const landmarkEpisodes = journalClubPodcastEpisodes.filter((episode) =>
      episode.secondaryHubs?.includes(landmarkJournalClubPodcastHub),
    );

    console.log(JSON.stringify({
      podcastEpisodes: journalClubPodcastEpisodes.length,
      landmarkEpisodes: landmarkEpisodes.length,
      languages: podcastLanguages.length,
      boardChapters: boardReviewChapters.length,
      landmarkTitles: landmarkEpisodes.map((episode) => episode.title).slice(0, 6),
    }));
  `

  const result = spawnSync(tsxPath, ['-e', inlineScript], {
    cwd: rootDir,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`Unable to read repo metrics: ${result.stderr || result.stdout}`)
  }

  return JSON.parse(result.stdout)
}

async function cleanFrameDir() {
  await fs.rm(frameDir, { recursive: true, force: true })
  await fs.mkdir(frameDir, { recursive: true })
}

async function renderFrames(metrics) {
  const assets = await loadAssets()
  const renderMetrics = { ...metrics, assets }
  await cleanFrameDir()

  for (let index = 0; index < totalFrames; index += 1) {
    const seconds = index / fps
    const scene = sceneForTime(seconds)
    const localT = clamp((seconds - scene.start) / scene.duration)
    const svg = sceneSvg(scene, localT, index / Math.max(1, totalFrames - 1), renderMetrics)
    const outputPath = path.join(frameDir, `frame_${String(index + 1).padStart(4, '0')}.png`)

    await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toFile(outputPath)

    if ((index + 1) % 180 === 0 || index + 1 === totalFrames) {
      console.log(`Rendered ${index + 1}/${totalFrames} frames`)
    }
  }
}

function encodeVideo() {
  for (const requiredPath of [navClipPath, fluoroClipPath, backgroundAudioPath]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Missing required media input: ${requiredPath}`)
    }
  }

  const moduleSceneEnd = moduleSceneStart + moduleSceneDuration
  const overlayDelay = 1.2
  const overlayStart = moduleSceneStart + overlayDelay
  const overlayDuration = Math.max(0.1, moduleSceneDuration - overlayDelay)
  const audioFadeOutStart = Math.max(0, totalDuration - 1.7)
  const filterComplex = [
    `[1:v]trim=duration=${overlayDuration},crop=3890:2116:102:174,scale=384:124,setsar=1,setpts=PTS-STARTPTS+${overlayStart}/TB[nav]`,
    `[2:v]trim=duration=${overlayDuration},crop=2300:1380:900:280,scale=384:124,setsar=1,setpts=PTS-STARTPTS+${overlayStart}/TB[fluoro]`,
    `[0:v][nav]overlay=112:818:enable='between(t,${overlayStart},${moduleSceneEnd})'[vnav]`,
    `[vnav][fluoro]overlay=582:818:enable='between(t,${overlayStart},${moduleSceneEnd})'[vout]`,
    `[3:a]atrim=duration=${totalDuration},asetpts=PTS-STARTPTS,volume=0.45,afade=t=in:st=0:d=1.2,afade=t=out:st=${audioFadeOutStart}:d=1.7[aout]`,
  ].join(';')

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
      '-i',
      navClipPath,
      '-i',
      fluoroClipPath,
      '-i',
      backgroundAudioPath,
      '-filter_complex',
      filterComplex,
      '-map',
      '[vout]',
      '-map',
      '[aout]',
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
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-ar',
      '48000',
      '-movflags',
      '+faststart',
      '-crf',
      '18',
      '-t',
      String(totalDuration),
      videoPath,
    ],
    { stdio: 'inherit' },
  )

  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with status ${result.status}`)
  }
}

async function writePoster() {
  const posterFrame = path.join(frameDir, 'frame_0031.png')
  await sharp(posterFrame).png({ compressionLevel: 9 }).toFile(posterPath)
}

async function writeProbe() {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,duration,nb_frames,pix_fmt,sample_rate,channels',
      '-of',
      'json',
      videoPath,
    ],
    { encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error(`ffprobe exited with status ${result.status}`)
  }

  await fs.writeFile(probePath, result.stdout)
}

async function main() {
  const metrics = readRepoMetrics()
  console.log(`Podcast episodes: ${metrics.podcastEpisodes}`)
  console.log(`Landmark episodes: ${metrics.landmarkEpisodes}`)
  console.log(`Podcast languages: ${metrics.languages}`)
  console.log(`Board chapters: ${metrics.boardChapters}`)

  await renderFrames(metrics)
  encodeVideo()
  await writePoster()
  await writeProbe()

  console.log(`Wrote ${videoPath}`)
  console.log(`Wrote ${posterPath}`)
  console.log(`Wrote ${probePath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
