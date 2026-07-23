import {
  BAXTER_CRRT_CONTENT_VERSION,
  BAXTER_CRRT_ENGINE_VERSION,
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  createDefaultProgress as createDefaultCrrtProgress,
  progressAttemptKey,
} from '@/features/baxter-crrt/engine/progress'
import { CARDIOHELP_PROGRESS_STORAGE_KEY } from '@/features/cardiohelp-ecmo/engine/progress'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
} from '@/features/icu-hemodynamics/engine/progress'
import { publicIcuScenarioManifestById } from '@/features/icu-simulation/content/publicScenarioManifest'
import {
  ICU_SIMULATION_PROGRESS_STORAGE_KEY,
  ICU_SIMULATION_SESSION_STORAGE_KEY,
} from '@/features/icu-simulation/engine/persistence'
import { ICU_CONTENT_VERSION, ICU_ENGINE_VERSION } from '@/features/icu-simulation/engine/types'
import {
  LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
} from '@/features/mechanical-ventilation/engine/progress'

import { MCS_PROGRESS_STORAGE_KEY } from '../adapters/mcs'

const crrtPracticeKey = progressAttemptKey(
  'prismax-aw8035-2xx',
  'integrated',
  'practice',
  'CRRT-01',
)
const crrtMasteryKey = progressAttemptKey(
  'prismax-aw8035-2xx',
  'integrated',
  'mastery',
  'MASTERY-PRISMAX-01',
)
const icuScenarioVersion = publicIcuScenarioManifestById.get('septic-ards-aki')?.version
if (!icuScenarioVersion) throw new Error('Missing ICU fixture scenario version.')

export const everyLegacyProgressStorageKey = [
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
  LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
  MCS_PROGRESS_STORAGE_KEY,
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  ICU_SIMULATION_PROGRESS_STORAGE_KEY,
  ICU_SIMULATION_SESSION_STORAGE_KEY,
] as const

export const emptyLegacyProgressFixtures: Readonly<Record<string, string>> = Object.freeze({})

export const partialLegacyProgressFixtures: Readonly<Record<string, string>> = {
  [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 2,
    lastStation: 'HD-02',
    lastWorkspace: 'cases',
    attempts: { 'HD-02': 2 },
    completedCaseIds: [],
    bestScores: { 'HD-02': 55 },
    masteredCaseIds: [],
  }),
  [MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 2,
    lastStation: 'lung-protection-demand',
    lastDeviceId: 'drager-evita-v800-v600',
    completedCases: [],
    attemptsByDeviceCase: { 'drager-evita-v800-v600:MV-02': 2 },
    bestScores: { 'MV-02': 60 },
    criticalErrorStatus: { 'MV-02': true },
  }),
  [MCS_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 1,
    completedLessonIds: ['mcs-foundations-signals'],
    completedCaseIds: [],
    masteredCaseIds: [],
    completedCapstoneIds: [],
    bestScores: { 'IMP-01': 55 },
    criticalErrorStatus: { 'IMP-01': true },
    lastDevice: 'impella',
    lastSection: 'practice',
    lastActivityId: 'IMP-01',
  }),
  [CARDIOHELP_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 2,
    lastStation: 'troubleshooting',
    completedLabs: [],
    scenarioAttempts: { 'clinical-vv-initiation-ards': 1 },
    bestScores: { 'clinical-vv-initiation-ards': 65 },
    criticalErrorStatus: { 'clinical-vv-initiation-ards': true },
    mastery: false,
    completedLearnLessonIds: ['startup-sensor-orientation'],
    lastLessonScenarioIdByMode: { vv: 'startup-sensor-orientation' },
    lastCaseScenarioIdByMode: { vv: 'clinical-vv-initiation-ards' },
    lastVisited: {
      section: 'practice',
      scenarioId: 'clinical-vv-initiation-ards',
      supportMode: 'vv',
    },
  }),
}

const completedCrrt = createDefaultCrrtProgress()

export const completedLegacyProgressFixtures: Readonly<Record<string, string>> = {
  [ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 1,
    lastCaseId: 'HD-01',
    attempts: { 'HD-01': 1 },
    bestScores: { 'HD-01': 75 },
  }),
  [LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 1,
    lastStation: 'lung-protection-demand',
    completedCases: ['MV-01'],
    attempts: { 'MV-01': 1 },
    bestScores: { 'MV-01': 75 },
    criticalErrorStatus: { 'MV-01': false },
  }),
  [BAXTER_CRRT_PROGRESS_STORAGE_KEY]: JSON.stringify({
    ...completedCrrt,
    completedLessonIds: ['crrt-indications-modality'],
    completedPracticeCaseIds: ['CRRT-01'],
    attempts: { [crrtPracticeKey]: 2 },
    bestSafeScores: { [crrtPracticeKey]: 76 },
    criticalErrorAttempts: { [crrtPracticeKey]: 0 },
    hintUse: { [crrtPracticeKey]: 1 },
  }),
}

export const masteredLegacyProgressFixtures: Readonly<Record<string, string>> = {
  [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 2,
    lastStation: 'HD-01',
    lastWorkspace: 'cases',
    attempts: { 'HD-01': 3 },
    completedCaseIds: ['HD-01'],
    bestScores: { 'HD-01': 92 },
    masteredCaseIds: ['HD-01'],
  }),
  [MCS_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 1,
    completedLessonIds: ['mcs-foundations-signals'],
    completedCaseIds: ['CAP-IMP-01'],
    masteredCaseIds: ['CAP-IMP-01'],
    completedCapstoneIds: ['CAP-IMP-01'],
    bestScores: { 'CAP-IMP-01': 91 },
    criticalErrorStatus: { 'CAP-IMP-01': false },
    lastDevice: 'impella',
    lastSection: 'assess',
    lastActivityId: 'CAP-IMP-01',
  }),
  [CARDIOHELP_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 2,
    lastStation: 'assessment',
    completedLabs: ['vv-off-sweep-capstone'],
    scenarioAttempts: { 'vv-off-sweep-capstone': 2 },
    bestScores: { 'vv-off-sweep-capstone': 90 },
    criticalErrorStatus: { 'vv-off-sweep-capstone': false },
    mastery: true,
    completedLearnLessonIds: [],
    lastLessonScenarioIdByMode: {},
    lastCaseScenarioIdByMode: { vv: 'vv-off-sweep-capstone' },
    lastVisited: {
      section: 'assess',
      scenarioId: 'vv-off-sweep-capstone',
      supportMode: 'vv',
    },
  }),
  [BAXTER_CRRT_PROGRESS_STORAGE_KEY]: JSON.stringify({
    ...createDefaultCrrtProgress(),
    completedMasteryCapstoneIds: ['MASTERY-PRISMAX-01'],
    attempts: { [crrtMasteryKey]: 1 },
    bestSafeScores: { [crrtMasteryKey]: 93 },
    criticalErrorAttempts: { [crrtMasteryKey]: 0 },
    hintUse: { [crrtMasteryKey]: 0 },
  }),
  [ICU_SIMULATION_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 1,
    engineVersion: ICU_ENGINE_VERSION,
    contentVersion: ICU_CONTENT_VERSION,
    lastScenarioId: 'septic-ards-aki',
    lastMode: 'assess',
    completedScenarioIds: ['septic-ards-aki'],
    masteredScenarioIds: ['septic-ards-aki'],
    attempts: { 'septic-ards-aki': 2 },
    bestSafeScores: { 'septic-ards-aki': 88 },
    criticalErrorAttempts: { 'septic-ards-aki': 0 },
  }),
  [ICU_SIMULATION_SESSION_STORAGE_KEY]: JSON.stringify({
    version: 1,
    replay: {
      version: 1,
      engineVersion: ICU_ENGINE_VERSION,
      contentVersion: ICU_CONTENT_VERSION,
      scenarioId: 'septic-ards-aki',
      scenarioVersion: icuScenarioVersion,
      mode: 'assess',
      seed: 417,
      commands: [],
    },
  }),
}

export const corruptProgressFixture = '{not-json'

export const cardiohelpV1ProgressFixture = JSON.stringify({
  version: 1,
  lastStation: 'flow-pressure',
  completedLabs: ['clinical-vv-initiation-ards'],
  scenarioAttempts: { 'clinical-vv-initiation-ards': 1 },
  bestScores: { 'clinical-vv-initiation-ards': 84 },
  criticalErrorStatus: { 'clinical-vv-initiation-ards': false },
  mastery: false,
})

export const incompatibleLegacyProgressFixtures: Readonly<Record<string, string>> = {
  [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 99 }),
  [MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 99 }),
  [MCS_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 99 }),
  [CARDIOHELP_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 99 }),
  [BAXTER_CRRT_PROGRESS_STORAGE_KEY]: JSON.stringify({
    ...createDefaultCrrtProgress(),
    engineVersion: BAXTER_CRRT_ENGINE_VERSION,
    contentVersion: `${BAXTER_CRRT_CONTENT_VERSION}-future`,
  }),
  [ICU_SIMULATION_PROGRESS_STORAGE_KEY]: JSON.stringify({
    version: 1,
    engineVersion: `${ICU_ENGINE_VERSION}-future`,
    contentVersion: ICU_CONTENT_VERSION,
  }),
  [ICU_SIMULATION_SESSION_STORAGE_KEY]: JSON.stringify({
    version: 1,
    replay: {
      version: 1,
      engineVersion: ICU_ENGINE_VERSION,
      contentVersion: ICU_CONTENT_VERSION,
      scenarioId: 'septic-ards-aki',
      scenarioVersion: '99.0.0',
      mode: 'practice',
      seed: 417,
      commands: [],
    },
  }),
}
