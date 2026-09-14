import { writeFile } from 'node:fs/promises'
import {
  CHAPTERS,
  LESSONS,
  HISTORICAL_IMAGE_QUESTIONS,
  HISTORICAL_MODEL_QUESTIONS,
} from '../../src/features/ebus-guided/content/curriculum'
import { activitiesForLesson } from '../../src/features/ebus-guided/content/stage'

const bounded = new Set([
  'left-paratracheal',
  'hilar-interlobar',
  'node-characterization',
  'systematic-staging',
  'eus-b',
  'adequacy-rose',
  'specimen-triage',
  'results-reporting',
])
const lines = [
  '# Guided EBUS flow and coverage',
  '',
  'Generated from the canonical curriculum and activity registry with `npx tsx scripts/ebus-guided/flow-coverage.ts`.',
  '',
  `${LESSONS.length} stable lessons, ${CHAPTERS.length} chapters, ${LESSONS.reduce((n, lesson) => n + activitiesForLesson(lesson).length, 0)} explicit activities. Measurement phantoms precede capture. Topic identifiers remain historical analytics categories.`,
  '',
  '## Migration convention',
  '',
  'The old Orientation → Worked example → prediction → activity → observation → explanation → transfer positions no longer control rendering, acquisition, disclosure or completion. Each row below names its actual replacement activities. Foundation includes the original objective, recall, concept, paragraphs and checklist. Worked teaching includes its original context and reasoning. Each original lesson still has its knowledge, observation and transfer decision, required lab/matching/sequence, takeaways, references and limitation. Explanations appear with the committed response; matching/sequence explanations remain available after their decisions. None of the source paragraphs were deleted.',
  '',
  'The full browser journey checks rendered teaching and every task, completes actual controls and records, then completes the three optional coached cases and eight final cases. Unit checks supplement it; source arrays alone are not treated as proof of visible teaching.',
  '',
  'The four companion knowledge decisions now follow guided model work and have `-application-v2` identities. Five revised image interpretations have new `-v2` identities. Their original objects and persisted keys remain historical. Historic completion does not certify a newly introduced interpretation or case-record task.',
  '',
  '## Course overview',
  '',
  '| Chapter | Stable lessons |',
  '| --- | --- |',
  ...CHAPTERS.map(
    (chapter) =>
      `| ${chapter.title} | ${chapter.lessons.map((lesson) => '`' + lesson.id + '`').join(', ')} |`,
  ),
  '',
  '## Lesson coverage',
  '',
]
for (const lesson of LESSONS) {
  const activities = activitiesForLesson(lesson)
  lines.push(
    `### ${lesson.id} — ${lesson.title}`,
    '',
    '**Status:** ' +
      (bounded.has(lesson.id)
        ? 'Redesigned with an explicitly bounded reference/cognitive task.'
        : 'Redesigned using supported content.'),
    '',
    '**Objective:** ' + lesson.objective,
    '',
    '**Teaching preserved:** ' +
      lesson.paragraphs.length +
      ' paragraphs, ' +
      lesson.checklist.length +
      ' checklist entries, recall, worked context/reasoning, ' +
      lesson.takeaways.length +
      ' takeaways. Sources: ' +
      lesson.sources.map((source) => '`' + source + '`').join(', ') +
      '.',
    '',
    '| Activity identity | Presentation / evidence | Required action and decisions | Teaching |',
    '| --- | --- | --- | --- |',
    ...activities.map(
      (activity) =>
        `| \`${activity.id}\` — ${activity.title} | ${activity.presentation} / ${activity.image} | ${activity.interaction}${activity.task ? ' (' + activity.task + ')' : ''}${activity.recordTask ? ' (' + activity.caseData!.id + ', ' + activity.recordTask + ':v1)' : ''}${activity.questions.length ? '; ' + activity.questions.map((slot) => '`' + lesson[slot].id + '` [' + lesson[slot].imagePolicy + ']').join(', ') : ''} | ${activity.teaching.join(', ') || 'Current task instruction; response reasoning after commitment'} |`,
    ),
    '',
    '**Completion evidence:** ' +
      (lesson.lab
        ? `${lesson.lab.kind}, ${lesson.lab.goal}${lesson.lab.modelPackage ? ', package ' + lesson.lab.modelPackage : ''}${lesson.lab.linkedLesson ? ', validated ' + lesson.lab.linkedLesson + ' landmark/acquisition contract' : ''}. Action, readiness and actual-frame gates remain required.`
        : `${lesson.matching ? 'The original matching distinctions' : 'The original action sequence'} plus all three safe-to-continue decisions.`) +
      (activities.some((activity) => activity.recordTask)
        ? ' The new case task must also be checked in this run; its versioned artifact is separate from historic lesson completion.'
        : ''),
    '',
    '**Representation limit:** ' + lesson.boundary,
    '',
    ...activities
      .filter((activity) => activity.caseData)
      .flatMap((activity) => ['**Case boundary:** ' + activity.caseData!.limitation, '']),
  )
}
lines.push(
  '## Historical item identities',
  '',
  'Retained source objects for changed image/application items:',
  '',
  ...[...HISTORICAL_IMAGE_QUESTIONS, ...HISTORICAL_MODEL_QUESTIONS].map(
    (question) => '- `' + question.id + '`: ' + question.prompt,
  ),
  '',
  'The unchanged first-response store preserves these keys, including wrong first choices. Coached case keys use `<case>-coached-v1:<question>`; independent practice and assessment retain their existing keys. Case-record first submissions are immutable under case/content/task versions. Source-window/session guards still govern live work.',
  '',
  '## Remaining review dependencies',
  '',
  'No new clinical-image bank, expert border/axis truth, pathology gallery, 4R/10R contrast, additional anatomy, device-specific mechanics or faculty approval is claimed. See [the implementation review](flow-redesign-review.md) for exact validation, visual evidence, provenance and remaining owner/faculty work.',
  '',
)
void writeFile('docs/ebus-guided/flow-redesign-coverage.md', lines.join('\n')).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
