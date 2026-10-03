/**
 * MCS-PRE-REVIEW-04 — the content contracts behind the self-paced teaching, source and flow slice.
 *
 * These hold mechanisms, not sentences: that the hub's objectives name sections that exist, that a
 * hint is not the instruction again, that every action id has a name a learner can read, that a
 * synthesis is never the opened support for a claim, that case reasoning agrees with the case it
 * describes, and that nothing here stores an answer.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  MCS_NAMED_ACTION_IDS,
  mcsActionDisplayList,
  mcsActionDisplayName,
  mcsHasActionDisplayName,
} from '../content/actionDisplayNames'
import {
  MCS_CASE_PREDICTION_REASONING,
  mcsCasePredictionReasoning,
} from '../content/casePredictionReasoning'
import {
  MCS_CLAIM_SOURCE_MAP,
  MCS_CLAIM_SOURCE_MAP_LIMIT,
  MCS_CLAIM_SOURCE_STATUS,
} from '../content/claimSourceMap'
import { mcsCausalLadder, mcsFirstUseTerms } from '../content/commonModel'
import {
  MCS_DEVICE_NAMING,
  mcsActiveDeviceNames,
  mcsDeviceNaming,
  mcsDeviceStatusLabel,
} from '../content/deviceNaming'
import { MCS_EXPLAIN_REFLECTIONS, mcsExplainReflection } from '../content/explainReflections'
import { MCS_GLOSSARY_ABBREVIATIONS } from '../content/glossaryAbbreviations'
import { MCS_HUB_OBJECTIVES, MCS_HUB_REFRESHER } from '../content/hubObjectives'
import { mcsIntroductions } from '../content/introductorySteps'
import { mcsLearnControls } from '../content/learnControls'
import { mcsLessons } from '../content/lessons'
import { MCS_MODEL_LIMITS } from '../content/modelLimits'
import { defaultMcsPatient, mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import {
  MCS_AUTHORING_PROVENANCE_SOURCE_IDS,
  mcsSourceClass,
  mcsSourceIdsByClass,
  mcsSourceVerification,
} from '../content/sourceClasses'
import { mcsSourceById, mcsSources } from '../content/sources'
import {
  MCS_EXPLAIN_READING_INSTRUCTION,
  MCS_EXPLAIN_SORT_INSTRUCTION,
  mcsStageLessons,
} from '../content/stageLessons'
import { mcsStageSources } from '../content/stageSources'
import { MCS_STEP_HINTS, mcsStepHint } from '../content/stepHints'
import { createInitialMcsState, mcsReducer } from '../engine'
import { emptyMcsLearningProgress, MCS_LOCAL_PROGRESS_KEY } from '../engine/learningProgress'
import { advanceMcsSimulation } from '../engine/model'
import { isMcsActionIdPermitted } from '../engine/reducer'
import type { McsScenarioDefinition, McsSimulationState } from '../engine/types'

const FEATURE = join(process.cwd(), 'src/features/mechanical-circulatory-support')
const allScenarios = [...mcsPracticeScenarios, ...mcsCapstoneScenarios]

function sourceFiles(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' || entry === 'test-support' ? [] : sourceFiles(path)
    }
    return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [path] : []
  })
}

function opened(scenario: McsScenarioDefinition, seconds = 8): McsSimulationState {
  const state = mcsReducer(
    createInitialMcsState(scenario.kind === 'capstone' ? 'assess' : 'practice', scenario.device),
    { type: 'LOAD_SCENARIO', scenario },
  )
  return advanceMcsSimulation(state, seconds)
}

describe('F02 — the hub states objectives the module actually teaches', () => {
  it('has three to five objectives, each naming existing sections, and covers every section once', () => {
    expect(MCS_HUB_OBJECTIVES.length).toBeGreaterThanOrEqual(3)
    expect(MCS_HUB_OBJECTIVES.length).toBeLessThanOrEqual(5)
    const known = mcsLessons.map((lesson) => lesson.id)
    const claimed = MCS_HUB_OBJECTIVES.flatMap((objective) => objective.sectionIds)
    for (const id of claimed) expect(known).toContain(id)
    expect([...claimed].sort()).toEqual([...known].sort())
  })

  it('offers the hemodynamics refresher as optional, in so many words', () => {
    expect(MCS_HUB_REFRESHER.label).toMatch(/optional/i)
    expect(MCS_HUB_REFRESHER.sentence).toMatch(/not required/i)
    expect(MCS_HUB_REFRESHER.href).toBe('/icu-hemodynamics')
  })
})

describe('F08 — one ladder orientation', () => {
  it('numbers pressure first and organ response fourth, and calls the fourth the top', () => {
    expect(mcsCausalLadder.map((level) => level.label)).toEqual([
      'Pressure',
      'Flow',
      'Oxygen delivery',
      'Organ response',
    ])
    expect(mcsCausalLadder[3].whatItCannotEstablish).toMatch(/top of the ladder/)
  })

  it('never calls a rung the bottom of the ladder anywhere a learner reads', () => {
    for (const file of sourceFiles(FEATURE)) {
      const text = readFileSync(file, 'utf8')
        // comments describing the history of the defect are not learner copy
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      expect({ file, hit: /bottom (rung|of the ladder)/i.test(text) }).toEqual({
        file,
        hit: false,
      })
    }
  })
})

describe('F11 — a hint is this item’s nudge, and the Explain question has a worked response', () => {
  const lessons = mcsStageLessons()

  it('gives every question, action and comparison step a hint that is not its instruction', () => {
    for (const lesson of lessons) {
      for (const step of lesson.steps) {
        const kind = step.interaction.kind
        if (kind === 'teaching' || kind === 'walk') continue
        const hint =
          kind === 'explain'
            ? step.interaction.sort
              ? mcsStepHint(lesson.sectionId, 'sort')
              : undefined
            : mcsStepHint(lesson.sectionId, kind)
        if (kind === 'explain' && !step.interaction.sort) {
          expect(hint).toBeUndefined()
          continue
        }
        expect(hint).toBeTruthy()
        expect(hint).not.toBe(step.instruction)
        expect(step.instruction).not.toContain(hint!)
        expect(hint!).not.toContain(step.instruction)
      }
    }
  })

  it('uses no hint twice', () => {
    const all = Object.values(MCS_STEP_HINTS).flatMap((hints) => Object.values(hints))
    expect(new Set(all).size).toBe(all.length)
  })

  it('names the step’s real work in the Explain instruction and keeps the question as a reflection', () => {
    for (const lesson of lessons) {
      const explain = lesson.steps.find((step) => step.interaction.kind === 'explain')!
      if (explain.interaction.kind !== 'explain') throw new Error('unreachable')
      expect(explain.instruction).toBe(
        explain.interaction.sort ? MCS_EXPLAIN_SORT_INSTRUCTION : MCS_EXPLAIN_READING_INSTRUCTION,
      )
      // The question is unchanged; it is no longer the instruction.
      expect(explain.interaction.prompt).toBe(lesson.contract.reassessmentPrompt)
      expect(explain.instruction).not.toBe(explain.interaction.prompt)
      expect(mcsExplainReflection(lesson.sectionId).workedResponse.length).toBeGreaterThan(0)
    }
    expect(MCS_EXPLAIN_REFLECTIONS).toHaveLength(mcsLessons.length)
  })

  it('F15 — the sort section’s instruction is about the sort, not the flow question', () => {
    const section = lessons.find((lesson) => lesson.sectionId === 'mcs-foundations-mechanisms')!
    const explain = section.steps.find((step) => step.interaction.kind === 'explain')!
    expect(explain.instruction).toMatch(/^Sort each item/)
    expect(explain.title).toMatch(/set/)
    expect(explain.instruction).not.toMatch(/native contribution fell/)
  })
})

describe('F16 — the naming crosswalk keeps products apart and renames nothing stored', () => {
  it('distinguishes CP from 5.5, RP from RP Flex, and the generic durable pump from HeartMate 3', () => {
    expect(mcsDeviceNaming('impella-cp').shortLabel).not.toBe(
      mcsDeviceNaming('impella-55').shortLabel,
    )
    expect(mcsDeviceNaming('impella-cp').notTheSameAs).toMatch(/Impella 5\.5/)
    expect(mcsDeviceNaming('impella-rp').notTheSameAs).toMatch(/RP Flex/)
    expect(mcsDeviceNaming('impella-rp').openItem).toMatch(/NOT REVIEWED/)
    expect(mcsDeviceNaming('lvad').modelIdentity).toMatch(/not a HeartMate 3 simulator/)
    expect(mcsDeviceNaming('lvad').modelIdentity).toMatch(/no controller flow estimator/)
    expect(mcsDeviceNaming('lvad').shortLabel).not.toMatch(/HeartMate/)
  })

  it('names the pump actually configured, never a CP for a 5.5', () => {
    const cp = createInitialMcsState('learn', 'impella')
    expect(mcsActiveDeviceNames(cp).map((row) => row.id)).toEqual(['impella-cp'])
    const five = mcsReducer(cp, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'leftVariant',
      value: '55',
    })
    expect(mcsActiveDeviceNames(five).map((row) => row.id)).toEqual(['impella-55'])
    expect(mcsDeviceStatusLabel(five)).toMatch(/^Impella 5\.5/)
    expect(mcsDeviceStatusLabel(createInitialMcsState('learn', 'lvad'))).toMatch(/generic/)
  })

  it('leaves every stored id exactly as it was', () => {
    expect(MCS_DEVICE_NAMING.map((row) => row.kind)).toEqual([
      'iabp',
      'impella',
      'impella',
      'impella',
      'lvad',
    ])
    expect(mcsLearnControls['control:select-iabp'].actionId).toBe('device:select:iabp')
    expect(mcsLearnControls['control:select-impella'].actionId).toBe('device:select:impella')
    expect(mcsLearnControls['control:select-lvad'].actionId).toBe('device:select:lvad')
    expect(MCS_LOCAL_PROGRESS_KEY).toBe('interventionalpulm:mcs-progress:v1')
  })
})

describe('F33 — every action id has a name a learner can read', () => {
  it('names every action a case requires or permits, and never shows the id itself', () => {
    for (const scenario of allScenarios) {
      for (const id of [...scenario.requiredActionIds, ...scenario.permittedActionIds]) {
        expect({ scenario: scenario.id, id, named: mcsHasActionDisplayName(id) }).toEqual({
          scenario: scenario.id,
          id,
          named: true,
        })
        const name = mcsActionDisplayName(id)
        expect(name).not.toBe(id)
        expect(name).not.toMatch(/[a-z]:[a-z]/)
      }
    }
  })

  it('covers the reducer’s whole vocabulary for each device', () => {
    for (const device of ['iabp', 'impella', 'lvad'] as const) {
      let state = createInitialMcsState('practice', device)
      if (device === 'impella') {
        state = mcsReducer(state, {
          type: 'SET_IMPELLA_CONFIGURATION',
          control: 'rightEnabled',
          value: true,
        })
      }
      const permitted = MCS_NAMED_ACTION_IDS.filter((id) => isMcsActionIdPermitted(state, id))
      expect(permitted.length).toBeGreaterThan(10)
    }
    // An id the registry does not know is still not shown raw.
    expect(mcsActionDisplayName('future:unknown-control')).toBe('Used a simulator control')
  })

  it('lists a patient change once, not as the change and its umbrella id', () => {
    const list = mcsActionDisplayList(['inspect:preload', 'patient:adjust', 'patient:set-svr'])
    expect(list.map((entry) => entry.id)).toEqual(['inspect:preload', 'patient:set-svr'])
    expect(mcsActionDisplayList(['patient:adjust']).map((entry) => entry.id)).toEqual([
      'patient:adjust',
    ])
  })

  it('changes no stored id: the reducer still records the original strings', () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-01')!
    let state = opened(scenario, 0)
    state = mcsReducer(state, { type: 'INSPECT', id: 'arterial' })
    state = mcsReducer(state, { type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: 0 })
    expect(state.actionIds).toEqual(['inspect:arterial', 'iabp:set-deflation'])
  })
})

describe('F32 — case option reasoning agrees with the case it describes', () => {
  it('has reasoning for every option of every case, and for nothing else', () => {
    for (const scenario of allScenarios) {
      expect(Object.keys(MCS_CASE_PREDICTION_REASONING[scenario.id]).sort()).toEqual(
        scenario.predictionOptions.map((option) => option.id).sort(),
      )
    }
    expect(Object.keys(MCS_CASE_PREDICTION_REASONING).sort()).toEqual(
      allScenarios.map((scenario) => scenario.id).sort(),
    )
  })

  it('changes no key and no option id', () => {
    expect(allScenarios.map((scenario) => [scenario.id, scenario.correctPredictionId])).toEqual([
      ['IABP-01', 'late-deflation'],
      ['IABP-02', 'trigger'],
      ['IABP-03', 'support-ceiling'],
      ['IMP-01', 'rv-preload'],
      ['IMP-02', 'malposition'],
      ['IMP-03', 'afterload-purge'],
      ['LVAD-01', 'hypertension'],
      ['LVAD-02', 'rv-failure'],
      ['LVAD-03', 'restore-power'],
      ['CAP-IABP-01', 'trigger-plus-timing'],
      ['CAP-IMP-01', 'position-afterload-recirculation'],
      ['CAP-LVAD-01', 'constrained-filling'],
    ])
  })

  it('says “at the reference value” only where the case leaves that value at the reference', () => {
    const referenceClaims: readonly [string, string, keyof typeof defaultMcsPatient, RegExp][] = [
      ['IABP-01', 'underfilled', 'preloadPercent', /preload is the reference patient’s/],
      ['IABP-01', 'low-svr', 'systemicVascularResistanceDynSecCm5', /at the reference value/],
      ['IABP-02', 'more-volume', 'preloadPercent', /Preload is the reference patient’s/],
      ['IMP-01', 'vasoplegia', 'systemicVascularResistanceDynSecCm5', /at the reference value/],
      ['LVAD-02', 'afterload', 'systemicVascularResistanceDynSecCm5', /at the reference value/],
      ['CAP-IABP-01', 'volume-only', 'preloadPercent', /at the reference value/],
      [
        'CAP-LVAD-01',
        'hypertension',
        'systemicVascularResistanceDynSecCm5',
        /at the reference value/,
      ],
    ]
    for (const [caseId, optionId, field, wording] of referenceClaims) {
      const scenario = allScenarios.find((candidate) => candidate.id === caseId)!
      expect(mcsCasePredictionReasoning(caseId, optionId)).toMatch(wording)
      expect(scenario.initialPatient[field]).toBe(defaultMcsPatient[field])
    }
  })

  it('names only alarms and settings the opened case actually has', () => {
    const active = (caseId: string) =>
      opened(allScenarios.find((candidate) => candidate.id === caseId)!)
        .alarms.filter((alarm) => alarm.active)
        .map((alarm) => alarm.label)
    expect(active('IABP-01')).toContain('Late deflation')
    expect(active('IABP-03')).toContain('Limited native output for counterpulsation')
    expect(active('IMP-01')).toContain('Left Impella suction detected')
    expect(active('IMP-02')).toContain('Left Impella position signal abnormal')
    expect(active('IMP-03')).toContain('Left Impella purge pressure high')
    expect(active('IMP-03')).not.toContain('Left Impella suction detected')
    expect(active('CAP-IMP-01')).not.toContain('Left Impella suction detected')
    expect(active('LVAD-03')).toContain('External power disconnected')

    const imp01 = opened(allScenarios.find((candidate) => candidate.id === 'IMP-01')!)
    expect(imp01.metrics.rapMmHg).toBeGreaterThan(imp01.metrics.pcwpMmHg)
    const lvad02 = opened(allScenarios.find((candidate) => candidate.id === 'LVAD-02')!)
    expect(lvad02.device.kind === 'lvad' && lvad02.device.suspectedPumpThrombosis).toBe(false)
    const capLvad = opened(allScenarios.find((candidate) => candidate.id === 'CAP-LVAD-01')!)
    expect(capLvad.patient.tamponade).toBe(true)
    expect(Math.abs(capLvad.metrics.rapMmHg - capLvad.metrics.pcwpMmHg)).toBeLessThan(8)
  })

  it('“raising the level into suction gains little and leaves the alarm” is what the model does', () => {
    const scenario = allScenarios.find((candidate) => candidate.id === 'IMP-01')!
    const before = opened(scenario)
    const raised = advanceMcsSimulation(
      mcsReducer(
        mcsReducer(createInitialMcsState('practice', 'impella'), {
          type: 'LOAD_SCENARIO',
          scenario,
        }),
        {
          type: 'SET_IMPELLA_CONTROL',
          side: 'left',
          control: 'performanceLevel',
          value: 9,
        },
      ),
      8,
    )
    expect(
      raised.alarms.some(
        (alarm) => alarm.active && alarm.label === 'Left Impella suction detected',
      ),
    ).toBe(true)
    expect(raised.metrics.leftDeviceFlowLMin - before.metrics.leftDeviceFlowLMin).toBeLessThan(0.5)
  })
})

describe('F42 — one glossary, with the module’s own sentences', () => {
  it('keeps the eight first-use terms as the glossary', () => {
    expect(mcsFirstUseTerms).toHaveLength(8)
  })

  it('takes the abbreviation notes from the guided introductions, word for word', () => {
    const introductions = Object.values(mcsIntroductions)
      .flat()
      .flatMap((introduction) => introduction.paragraphs)
      .join(' ')
    for (const abbreviation of ['RAP', 'PAWP (PCWP, wedge)', 'SvO2', 'PAPi']) {
      const entry = MCS_GLOSSARY_ABBREVIATIONS.find(
        (candidate) => candidate.abbreviation === abbreviation,
      )!
      for (const sentence of entry.note.split(/(?<=\.)\s+/)) {
        const core = sentence.replace(/\.$/, '').toLowerCase()
        expect({ abbreviation, found: introductions.toLowerCase().includes(core) }).toEqual({
          abbreviation,
          found: true,
        })
      }
    }
  })
})

describe('F10 — sources by class, and claims checked against a document that was opened', () => {
  it('classes exactly the two supplied syntheses as authoring provenance and says so in the citation', () => {
    expect([...MCS_AUTHORING_PROVENANCE_SOURCE_IDS].sort()).toEqual([
      'master-hemodynamics-reference',
      'mcs-bedside-reference-supplied',
    ])
    for (const id of MCS_AUTHORING_PROVENANCE_SOURCE_IDS) {
      const source = mcsSourceById.get(id)!
      expect(source.citation).toMatch(/^Authoring provenance, not independent clinical evidence/)
      // The identity the record has always stated is still stated.
      expect(source.citation).toMatch(/names no author, publisher, date or reference list/)
      expect(source.citation).toMatch(/OpenAI/)
      expect(source.limitation).toMatch(/no clinical statement should rest on it alone/)
    }
  })

  it('does not record an unopened guideline or labeling record as read', () => {
    for (const id of [
      'ishlt-hfsa-acute-mcs-2023',
      'ishlt-durable-mcs-2023',
      'fda-heartmate3-ifu',
      'fda-impella-cp-labeling',
    ]) {
      expect(mcsSourceVerification(id)).toBe('registered-not-opened')
    }
    for (const source of mcsSources) expect(() => mcsSourceClass(source.id)).not.toThrow()
  })

  it('lists authoring provenance last on every section', () => {
    for (const lesson of mcsLessons) {
      const ordered = mcsSourceIdsByClass(mcsStageSources(lesson.id).sourceIds)
      const firstProvenance = ordered.findIndex(
        (id) => mcsSourceClass(id) === 'authoring-provenance',
      )
      if (firstProvenance < 0) continue
      expect(
        ordered.slice(firstProvenance).every((id) => mcsSourceClass(id) === 'authoring-provenance'),
      ).toBe(true)
    }
  })

  it('maps at most ten claims, each to an opened source that is not a synthesis', () => {
    expect(MCS_CLAIM_SOURCE_MAP.length).toBeLessThanOrEqual(MCS_CLAIM_SOURCE_MAP_LIMIT)
    expect(MCS_CLAIM_SOURCE_MAP_LIMIT).toBe(10)
    for (const claim of MCS_CLAIM_SOURCE_MAP) {
      for (const evidence of claim.opened) {
        expect(mcsSourceClass(evidence.sourceId)).not.toBe('authoring-provenance')
        expect(mcsSourceVerification(evidence.sourceId)).toBe('read-first-hand')
        expect(evidence.locator).toMatch(/[Pp]rinted page/)
      }
      for (const id of claim.notOpened) {
        expect(mcsSourceVerification(id)).toBe('registered-not-opened')
      }
      expect(claim.doesNotSupport.length).toBeGreaterThan(20)
    }
    expect(MCS_CLAIM_SOURCE_STATUS.reviewStatus).toBe('NOT REVIEWED')
    expect(MCS_CLAIM_SOURCE_STATUS.remainingHoldId).toBe('MCS-03-10')
  })

  it('quotes learner wording that is actually in the module', () => {
    const corpus = [
      ...Object.values(mcsIntroductions)
        .flat()
        .flatMap((introduction) => introduction.paragraphs),
      ...allScenarios.flatMap((scenario) => scenario.debrief),
      ...mcsStageLessons().flatMap((lesson) =>
        lesson.contract.recognizeOptions.map((option) => option.label),
      ),
    ].join('\n')
    for (const claim of MCS_CLAIM_SOURCE_MAP) {
      for (const wording of claim.currentWording) {
        expect({ claim: claim.id, found: corpus.includes(wording) }).toEqual({
          claim: claim.id,
          found: true,
        })
      }
    }
  })

  it('puts the opened document on every section and case whose claim was checked against it', () => {
    for (const claim of MCS_CLAIM_SOURCE_MAP) {
      const openedIds = claim.opened.map((evidence) => evidence.sourceId)
      for (const sectionId of claim.sectionIds) {
        const listed = mcsStageSources(sectionId).sourceIds
        for (const id of openedIds) expect(listed).toContain(id)
      }
      for (const caseId of claim.caseIds) {
        const scenario = allScenarios.find((candidate) => candidate.id === caseId)!
        for (const id of openedIds) expect(scenario.sourceIds).toContain(id)
      }
    }
  })
})

describe('F39 — the general limits are stated once and none is dropped', () => {
  it('carries the simulated-values, bedside, generic-display, authored-magnitude and review limits', () => {
    const text = MCS_MODEL_LIMITS.map((limit) => limit.statement).join(' ')
    expect(text).toMatch(/Every value is simulated/)
    expect(text).toMatch(/bedside assessment; they are not simulated/)
    expect(text).toMatch(/No product display or manufacturer alarm limit is reproduced/)
    expect(text).toMatch(/authored simulation behavior/)
    expect(text).toMatch(/draft for faculty review/)
  })
})

describe('no new storage, analytics or counting', () => {
  const added = [
    'content/actionDisplayNames.ts',
    'content/casePredictionReasoning.ts',
    'content/claimSourceMap.ts',
    'content/deviceNaming.ts',
    'content/explainReflections.ts',
    'content/glossaryAbbreviations.ts',
    'content/hubObjectives.ts',
    'content/modelLimits.ts',
    'content/sourceClasses.ts',
    'content/stepHints.ts',
    'components/McsClaimSourceChecks.tsx',
    'components/McsGlossary.tsx',
    'components/stage/McsSectionRecap.tsx',
  ]

  it('adds no file that touches storage, the network or analytics', () => {
    for (const file of added) {
      const text = readFileSync(join(FEATURE, file), 'utf8')
      expect({
        file,
        hit: /localStorage|sessionStorage|indexedDB|fetch\(|sendBeacon|supabase|analytics|document\.cookie/i.test(
          text,
        ),
      }).toEqual({ file, hit: false })
    }
  })

  it('keeps the stored envelope to location and visits', () => {
    expect(Object.keys(emptyMcsLearningProgress()).sort()).toEqual([
      'lastActivityId',
      'lastDevice',
      'lastPhase',
      'lastSection',
      'locationUpdatedAt',
      'visitedCaseIds',
      'visitedLessonIds',
    ])
  })

  it('writes to storage from the same single place as before', () => {
    const writers = sourceFiles(FEATURE).filter((file) =>
      /localStorage\.setItem|sessionStorage\.setItem/.test(readFileSync(file, 'utf8')),
    )
    // Unchanged from the baseline: the location envelope and the read-only legacy record.
    expect(writers.map((file) => file.replace(`${FEATURE}/`, '')).sort()).toEqual([
      'engine/learningProgress.ts',
      'engine/progress.ts',
    ])
  })
})
