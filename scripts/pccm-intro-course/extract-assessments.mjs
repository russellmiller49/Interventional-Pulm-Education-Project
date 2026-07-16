import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'intro to bronch and pleural disease course ')
const outputPath = path.join(
  root,
  'src/features/pccm-intro-course/content/assessmentItems.ts',
)

const sources = {
  bronchoscopy: path.join(sourceRoot, 'pre and post tests/Basic_Bronchoscopy_MCQs_2026.docx'),
  pleural: path.join(sourceRoot, 'pre and post tests/Pleural_MCQs_2026_FINAL.docx'),
}

const bronchoscopyImages = new Map([
  [2, '/pccm-intro-course/assessments/bronchoscopy/image1.png'],
  [5, '/pccm-intro-course/assessments/bronchoscopy/image2.png'],
  [10, '/pccm-intro-course/assessments/bronchoscopy/image3.png'],
  [13, '/pccm-intro-course/assessments/bronchoscopy/image4.png'],
])

function toText(docxPath) {
  return execFileSync('textutil', ['-convert', 'txt', '-stdout', docxPath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/\r\n?/g, '\n')
}

function parseOptions(lines) {
  const options = []
  let optionStartIndex = -1
  let current = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    const match = line.match(/^([A-D])\.\s*(.+)$/)
    if (match) {
      if (current) {
        options.push(current)
      }
      if (optionStartIndex === -1) {
        optionStartIndex = index
      }
      current = {
        id: match[1].toLowerCase(),
        text: match[2].trim(),
      }
      continue
    }

    if (current && line && !/^Correct answer:/i.test(line)) {
      current.text = `${current.text} ${line}`.trim()
    }
  }

  if (current) {
    options.push(current)
  }

  return { optionStartIndex, options }
}

function cleanupExplanation(value) {
  return value
    .replace(/^Answer explanation\s*/i, '')
    .replace(/^Discussion\s*/i, '')
    .replace(/\nReferences[\s\S]*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseBronchoscopy(text) {
  const matches = [...text.matchAll(/^Question\s+(\d+)\s*$/gm)]
  return matches.map((match, index) => {
    const number = Number(match[1])
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    const block = text.slice(start, end).trim()
    const lines = block.split('\n')
    const correctMatch = block.match(/^Correct answer:\s*([A-D])\./im)
    const explanationIndex = block.search(/^Answer explanation\s*$/im)
    const correctIndex = lines.findIndex((line) => /^Correct answer:/i.test(line.trim()))
    const { optionStartIndex, options } = parseOptions(lines.slice(0, correctIndex))
    const stem = lines.slice(0, optionStartIndex).join('\n').trim()
    const explanation =
      explanationIndex >= 0 ? cleanupExplanation(block.slice(explanationIndex)) : ''

    return {
      id: `bronchoscopy-q${String(number).padStart(2, '0')}`,
      category: 'bronchoscopy',
      stem,
      imageUrl: bronchoscopyImages.get(number),
      options,
      correctId: correctMatch?.[1]?.toLowerCase(),
      explanation,
    }
  })
}

function parsePleural(text) {
  const matches = [...text.matchAll(/(?:^|\n)\s*(\d+)-\s+/g)]

  return matches.map((match, index) => {
    const number = Number(match[1])
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    const block = text.slice(start, end).trim()
    const lines = block.split('\n')
    const correctLineIndex = lines.findIndex((line) => /^Correct answer:/i.test(line.trim()))
    const correctMatch = lines[correctLineIndex]?.match(/^Correct answer:\s*([A-D])/i)
    const { optionStartIndex, options } = parseOptions(lines.slice(0, correctLineIndex))
    const stem = lines.slice(0, optionStartIndex).join('\n').trim()
    const discussionStart = Math.max(correctLineIndex + 1, 0)
    const discussionLines =
      /^Discussion\s*$/i.test(lines[discussionStart]?.trim() ?? '')
        ? lines.slice(discussionStart + 1)
        : lines.slice(discussionStart)

    return {
      id: `pleural-q${String(number).padStart(2, '0')}`,
      category: 'pleural',
      stem,
      options,
      correctId: correctMatch?.[1]?.toLowerCase(),
      explanation: cleanupExplanation(discussionLines.join('\n')),
    }
  })
}

function validate(items, category) {
  if (items.length !== 15) {
    throw new Error(`${category} parser expected 15 questions, received ${items.length}`)
  }

  for (const item of items) {
    if (!item.stem || !item.correctId || item.options.length !== 4 || !item.explanation) {
      throw new Error(`Incomplete ${category} question: ${item.id}`)
    }
    if (!item.options.some((option) => option.id === item.correctId)) {
      throw new Error(`Correct option missing from ${item.id}`)
    }
  }
}

function renderString(value) {
  return JSON.stringify(value)
}

function renderItem(item) {
  const imageLine = item.imageUrl ? `\n    imageUrl: ${renderString(item.imageUrl)},` : ''
  return `  {
    id: ${renderString(item.id)},
    category: ${renderString(item.category)},${imageLine}
    stem: ${renderString(item.stem)},
    options: ${JSON.stringify(item.options, null, 6).replace(/\n/g, '\n    ')},
    correctId: ${renderString(item.correctId)},
    explanation: ${renderString(item.explanation)},
  }`
}

const bronchoscopyItems = parseBronchoscopy(toText(sources.bronchoscopy))
const pleuralItems = parsePleural(toText(sources.pleural))

validate(bronchoscopyItems, 'bronchoscopy')
validate(pleuralItems, 'pleural')

const rendered = `export type PccmQuestionCategory = 'bronchoscopy' | 'pleural'

export interface PccmAssessmentOption {
  id: string
  text: string
}

export interface PccmAssessmentQuestion {
  id: string
  category: PccmQuestionCategory
  stem: string
  options: PccmAssessmentOption[]
  correctId: string
  explanation: string
  imageUrl?: string
}

export const pccmAssessmentQuestions = [
${[...bronchoscopyItems, ...pleuralItems].map(renderItem).join(',\n')}
] as const satisfies readonly PccmAssessmentQuestion[]

export const pccmBronchoscopyQuestions = pccmAssessmentQuestions.filter(
  (question) => question.category === 'bronchoscopy',
)

export const pccmPleuralQuestions = pccmAssessmentQuestions.filter(
  (question) => question.category === 'pleural',
)
`

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, rendered)
console.log(
  `Wrote ${bronchoscopyItems.length} bronchoscopy and ${pleuralItems.length} pleural questions to ${path.relative(
    root,
    outputPath,
  )}`,
)
