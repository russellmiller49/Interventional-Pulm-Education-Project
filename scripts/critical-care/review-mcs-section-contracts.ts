/**
 * Every MCS Learn section contract, side by side, with the live consequence of its authored action.
 *
 * A reviewer's real question is not "does each field exist" — the content module already refuses to
 * load if one is missing. It is whether nine sections read as nine different lessons, whether each
 * one points at something that exists, and whether the observation a section promises is the one the
 * model actually produces. The first two are a table; the third needs the reducer.
 *
 * Run it directly. There is deliberately no package.json script, because package.json is a shared
 * file during this parallel round:
 *
 *     npx tsx scripts/critical-care/review-mcs-section-contracts.ts
 *     MCS_SECTION=impella-suction-purge-rv npx tsx scripts/critical-care/review-mcs-section-contracts.ts
 *
 * The `.ts` extension is load-bearing: tsx resolves a `.ts` entrypoint against this project's
 * ESM/CJS mix, and an `.mts` one does not. This harness renders no React, so it never has to load a
 * CSS module and needs no esbuild bundle.
 *
 * Exit contract: any flag exits 1. A review that reports problems and exits 0 cannot gate anything.
 */

import {
  mcsLearnControls,
  type McsLearnControlId,
} from '../../src/features/mechanical-circulatory-support/content/learnControls'
import { mcsLessons } from '../../src/features/mechanical-circulatory-support/content/lessons'
import { mcsLessonTransferByLessonId } from '../../src/features/mechanical-circulatory-support/content/lessonTransfers'
import {
  mcsAnatomyTargets,
  mcsMonitorTargets,
  mcsSurfaceTarget,
} from '../../src/features/mechanical-circulatory-support/content/primarySurfaces'
import {
  mcsSectionLearningContracts,
  type McsSectionLearningContract,
} from '../../src/features/mechanical-circulatory-support/content/sectionLearningContracts'
import {
  mcsCapstoneScenarios,
  mcsPracticeScenarios,
} from '../../src/features/mechanical-circulatory-support/content/scenarios'
import { createInitialMcsState } from '../../src/features/mechanical-circulatory-support/engine/model'
import { mcsReducer } from '../../src/features/mechanical-circulatory-support/engine/reducer'
import type {
  McsAction,
  McsSimulationState,
} from '../../src/features/mechanical-circulatory-support/engine/types'

const ONLY_SECTION = process.env.MCS_SECTION

const flags: { readonly where: string; readonly reason: string }[] = []
const notes: { readonly where: string; readonly note: string }[] = []

function flag(where: string, reason: string): void {
  flags.push({ where, reason })
}

function note(where: string, text: string): void {
  notes.push({ where, note: text })
}

function settle(state: McsSimulationState, seconds = 8): McsSimulationState {
  let next = state
  for (let index = 0; index < seconds * 5; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  }
  return next
}

function openSection(contract: McsSectionLearningContract): McsSimulationState {
  let state = createInitialMcsState('learn', contract.startingDevice)
  for (const action of contract.startingActions) state = mcsReducer(state, action)
  return settle(state)
}

/**
 * One representative move per control, so a section's action predicate can be exercised.
 *
 * Keyed on the control registry rather than on the section, so a new section that reuses a control
 * is covered automatically and a control nobody can move shows up as a gap.
 */
const probeActions: Readonly<Record<McsLearnControlId, readonly McsAction[]>> = {
  'control:inspect-arterial': [{ type: 'INSPECT', id: 'arterial' }],
  'control:inspect-preload': [{ type: 'INSPECT', id: 'preload' }],
  'control:inspect-device': [{ type: 'INSPECT', id: 'device' }],
  'control:select-iabp': [{ type: 'SELECT_DEVICE', device: 'iabp' }],
  'control:select-impella': [{ type: 'SELECT_DEVICE', device: 'impella' }],
  'control:select-lvad': [{ type: 'SELECT_DEVICE', device: 'lvad' }],
  'control:iabp-inflation': [{ type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: 0 }],
  'control:iabp-trigger': [
    { type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'pressure' },
  ],
  'control:impella-left-level': [
    { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
  ],
  'control:impella-left-position': [
    { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'position', value: 'too-deep' },
  ],
  'control:impella-right-enable': [
    { type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true },
  ],
  'control:lvad-thrombosis': [
    { type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true },
  ],
  'control:patient-rv-contractility': [
    { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.34 },
  ],
  'control:patient-svr': [
    { type: 'SET_PATIENT_CONTROL', control: 'systemicVascularResistanceDynSecCm5', value: 1_950 },
  ],
  'control:team-escalate': [{ type: 'ESCALATE' }],
}

function workSection(contract: McsSectionLearningContract): {
  readonly before: McsSimulationState
  readonly after: McsSimulationState
} {
  const before = openSection(contract)
  let after = before
  for (const controlId of contract.allowedActions) {
    for (const action of probeActions[controlId]) after = mcsReducer(after, action)
  }
  return { before, after: settle(after) }
}

// ── Checks ────────────────────────────────────────────────────────────────────

function checkTargetsExist(contract: McsSectionLearningContract): void {
  const target = mcsSurfaceTarget(contract.primarySurface, contract.primaryTarget)
  if (!target) {
    flag(contract.sectionId, `primary target ${contract.primaryTarget} is not in either registry`)
    return
  }
  const registry = contract.primarySurface === 'anatomy' ? mcsAnatomyTargets : mcsMonitorTargets
  if (!(contract.primaryTarget in registry)) {
    flag(
      contract.sectionId,
      `primary target ${contract.primaryTarget} is not on the ${contract.primarySurface} surface`,
    )
  }
  if (
    target.renderedForDevices.length > 0 &&
    !target.renderedForDevices.includes(contract.startingDevice)
  ) {
    flag(
      contract.sectionId,
      `primary target ${contract.primaryTarget} does not render on the ${contract.startingDevice} pathway the section opens`,
    )
  }
}

function checkControlsSupported(contract: McsSectionLearningContract): void {
  for (const controlId of contract.allowedActions) {
    const control = mcsLearnControls[controlId]
    if (!control) {
      flag(contract.sectionId, `allowed action ${controlId} is not a known control`)
      continue
    }
    if (control.deviceKind !== null && control.deviceKind !== contract.startingDevice) {
      flag(
        contract.sectionId,
        `control ${controlId} renders only on the ${control.deviceKind} pathway, but the section opens on ${contract.startingDevice}`,
      )
    }
    if (!probeActions[controlId]) {
      flag(contract.sectionId, `control ${controlId} has no way to be moved`)
    }
  }
  if (contract.actionMode !== 'inspect-only' && !contract.targetControl) {
    flag(contract.sectionId, `a ${contract.actionMode} section names no control`)
  }
}

function checkActionIsReachable(contract: McsSectionLearningContract): void {
  const { before, after } = workSection(contract)
  if (contract.isActionSatisfied(before)) {
    flag(contract.sectionId, 'the section opens with its own action already satisfied')
  }
  if (!contract.isActionSatisfied(after)) {
    flag(
      contract.sectionId,
      'working every allowed control does not satisfy the authored action, so the section cannot be finished',
    )
  }
}

function checkObservationIsLive(contract: McsSectionLearningContract): void {
  const { before, after } = workSection(contract)
  const moved: string[] = []
  for (const signal of contract.observedSignals) {
    const a = before.metrics[signal.key]
    const b = after.metrics[signal.key]
    for (const [label, value] of [
      ['before', a],
      ['after', b],
    ] as const) {
      if (value === null) continue
      if (typeof value === 'boolean') continue
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        flag(contract.sectionId, `${String(signal.key)} is not finite ${label} the action`)
      }
    }
    if (typeof a === 'number' && typeof b === 'number' && Math.abs(b - a) > 0.05) {
      moved.push(`${signal.label} ${a.toFixed(signal.digits)} → ${b.toFixed(signal.digits)}`)
    }
  }
  if (moved.length === 0 && contract.actionMode !== 'inspect-only') {
    flag(
      contract.sectionId,
      'no observed reading moves when the authored action is worked, so the before-and-after comparison shows nothing',
    )
  }
  note(contract.sectionId, moved.length > 0 ? moved.join(' · ') : 'no reading moves (inspect-only)')
}

function checkDistinctFromNeighbours(): void {
  const fields = [
    ['clinical question', (c: McsSectionLearningContract) => c.clinicalQuestion],
    ['action instruction', (c: McsSectionLearningContract) => c.actionInstruction],
    ['explanation', (c: McsSectionLearningContract) => c.explanation],
    ['observation focus', (c: McsSectionLearningContract) => c.observationFocus],
    ['patient problem', (c: McsSectionLearningContract) => c.patientProblem],
  ] as const

  for (const [label, read] of fields) {
    const seen = new Map<string, string>()
    for (const contract of mcsSectionLearningContracts) {
      const value = read(contract).trim()
      const owner = seen.get(value)
      if (owner) flag(contract.sectionId, `duplicate ${label}, shared with ${owner}`)
      seen.set(value, contract.sectionId)
    }
  }

  for (let index = 1; index < mcsSectionLearningContracts.length; index += 1) {
    const previous = mcsSectionLearningContracts[index - 1]
    const current = mcsSectionLearningContracts[index]
    if (
      previous.primaryTarget === current.primaryTarget &&
      previous.actionMode === current.actionMode
    ) {
      flag(
        current.sectionId,
        `renders the same target and the same kind of task as the section before it (${previous.sectionId})`,
      )
    }
  }
}

function checkCounts(): void {
  if (mcsSectionLearningContracts.length !== mcsLessons.length) {
    flag('counts', 'the contract list and the section list disagree')
  }
  for (const contract of mcsSectionLearningContracts) {
    if (!mcsLessonTransferByLessonId.has(contract.sectionId)) {
      flag(contract.sectionId, 'no transfer to close the section')
    }
  }
  note(
    'counts',
    `${mcsLessons.length} guided sections · ${mcsPracticeScenarios.length} practice cases · ${mcsCapstoneScenarios.length} harder cases`,
  )
}

// ── Output ────────────────────────────────────────────────────────────────────

function wrap(value: string, width: number, indent: string): string {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width) {
      lines.push(line.trim())
      line = word
    } else {
      line = `${line} ${word}`
    }
  }
  if (line.trim()) lines.push(line.trim())
  return lines.join(`\n${indent}`)
}

function printContract(contract: McsSectionLearningContract, index: number): void {
  const pad = '      '
  console.log(`\n${'─'.repeat(96)}`)
  console.log(`${String(index + 1).padStart(2, '0')}  ${contract.sectionId}`)
  console.log(`    ${contract.lessonTitle}  [${contract.lessonSequenceLabel}]`)
  const rows: readonly (readonly [string, string])[] = [
    ['primary surface', `${contract.primarySurface} · ${contract.primaryTarget}`],
    ['why this view', contract.whyThisView],
    ['clinical question', contract.clinicalQuestion],
    ['starting state', `${contract.startingDevice} · ${contract.startingContext}`],
    ['action mode', contract.actionMode],
    ['action', contract.actionInstruction],
    ['control', contract.targetControl ?? 'none — inspect only'],
    ['observation', contract.observationFocus],
    ['explanation', contract.explanation],
    ['does not establish', contract.whatThisDoesNotEstablish],
    ['transfer', contract.transferPrompt],
    ['completion', contract.completionCondition],
  ]
  for (const [label, value] of rows) {
    console.log(`    ${label.padEnd(19)} ${wrap(value, 70, pad + ' '.repeat(14))}`)
  }
}

function main(): void {
  const contracts = ONLY_SECTION
    ? mcsSectionLearningContracts.filter((contract) => contract.sectionId === ONLY_SECTION)
    : mcsSectionLearningContracts

  if (contracts.length === 0) {
    console.error(`No MCS section matches MCS_SECTION=${ONLY_SECTION}`)
    process.exit(1)
  }

  console.log('MCS Learn section contracts')
  contracts.forEach(printContract)

  for (const contract of contracts) {
    checkTargetsExist(contract)
    checkControlsSupported(contract)
    checkActionIsReachable(contract)
    checkObservationIsLive(contract)
  }
  if (!ONLY_SECTION) {
    checkDistinctFromNeighbours()
    checkCounts()
  }

  console.log(`\n${'─'.repeat(96)}`)
  console.log(`\nWhat moves when each section's action is worked (${notes.length} note(s))`)
  for (const item of notes) console.log(`  ${item.where.padEnd(34)} ${item.note}`)

  console.log(`\n${flags.length} flag(s)`)
  for (const item of flags) console.log(`  ${item.where.padEnd(34)} ${item.reason}`)

  if (flags.length > 0) process.exit(1)
}

main()
