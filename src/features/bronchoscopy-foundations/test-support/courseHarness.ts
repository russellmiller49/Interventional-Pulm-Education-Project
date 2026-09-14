import { fireEvent, screen } from '@testing-library/react'
import { readBronchRecord } from '../engine/learnProgress'
import { inspectionReport } from '../engine/inspectionReport'
import type { BronchStageLesson, BronchStageStep } from '../content/stageLessons'
import { SCOPE_RECIPES } from './scopeRecipes'
import { performPilotStep } from './fiveControlsLearnHarness'
import {
  answerLedger,
  clickPrimary,
  commitById,
  currentStepId,
  decideAllFrames,
  fillLedgerEntries,
  fillReport,
  keyedChoiceId,
  nameIdentifyRows,
  orderSequence,
  placeSortRows,
  scopePilot,
  settle,
} from './stageHarness'

/** Uses rendered responses and actual scope command handlers, never completion injection. */
export async function completeCourseStep(lesson: BronchStageLesson, authored: BronchStageStep) {
  if (authored.learn) {
    await performPilotStep(authored)
    return
  }
  const step = authored.course?.learnerRecord
    ? {
        ...authored,
        interaction: { kind: 'report' as const, report: inspectionReport(readBronchRecord()) },
      }
    : authored
  if (step.course?.demonstration)
    fireEvent.click(screen.getByRole('button', { name: 'Try with guidance' }))
  switch (step.interaction.kind) {
    case 'prediction':
      commitById(keyedChoiceId(step))
      break
    case 'sort':
      placeSortRows(step)
      clickPrimary()
      break
    case 'identify':
      nameIdentifyRows(step)
      clickPrimary()
      break
    case 'sequence':
      orderSequence(step)
      clickPrimary()
      break
    case 'ledger':
      fillLedgerEntries(step)
      answerLedger(step, 'best')
      break
    case 'report':
      fillReport(step)
      break
    case 'scenario':
      decideAllFrames(step)
      break
    case 'scope-task':
      SCOPE_RECIPES[lesson.sectionId]!.act(scopePilot())
      break
    case 'observe':
      SCOPE_RECIPES[lesson.sectionId]!.observe!(scopePilot())
      break
  }
  clickPrimary()
  await settle()
}
export async function reachCourseStep(lesson: BronchStageLesson, target: BronchStageStep) {
  for (
    let attempts = 0;
    currentStepId() !== target.id && attempts < lesson.steps.length;
    attempts++
  ) {
    const current = lesson.steps.find((step) => step.id === currentStepId())!
    await completeCourseStep(lesson, current)
  }
  if (currentStepId() !== target.id) throw new Error(`Did not reach ${target.id}`)
}
