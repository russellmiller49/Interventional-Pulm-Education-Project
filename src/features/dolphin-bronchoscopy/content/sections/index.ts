import type { DolphinSectionId } from '../sectionIds'
import type { DolphinSectionDefinition } from '../types'
import { anAirwayApartFromTheMouth } from './an-airway-apart-from-the-mouth'
import { beforeTheDay } from './before-the-day'
import { beyondTheSurvey } from './beyond-the-survey'
import { belowTheLarynx } from './below-the-larynx'
import { brushAndBiopsy } from './brush-and-biopsy'
import { choosingTheInstrument } from './choosing-the-instrument'
import { enteringTheBlowhole } from './entering-the-blowhole'
import { findingANamedBranch } from './finding-a-named-branch'
import { fromBlowholeToSpout } from './from-blowhole-to-spout'
import { lavage } from './lavage'
import { readingThePicture } from './reading-the-picture'
import { recoveryAndReturn } from './recovery-and-return'
import { sameInEveryDolphin } from './same-in-every-dolphin'
import { sedationAndNumbing } from './sedation-and-numbing'
import { theNumberedMap } from './the-numbered-map'
import { theRoomAndTheTeam } from './the-room-and-the-team'
import { theSurveyAndTheRecord } from './the-survey-and-the-record'
import { toolsThroughTheChannel } from './tools-through-the-channel'
import { troubleDuringTheProcedure } from './trouble-during-the-procedure'
import { whatThisModuleCanSay } from './what-this-module-can-say'
import { whyScopeADolphin } from './why-scope-a-dolphin'

/**
 * Every authored section, in canonical order. A section id with no definition here is listed on
 * the pathway but opens the Learn landing instead of a stage.
 */
export const DOLPHIN_SECTIONS: readonly DolphinSectionDefinition[] = [
  whyScopeADolphin,
  anAirwayApartFromTheMouth,
  fromBlowholeToSpout,
  belowTheLarynx,
  theNumberedMap,
  sameInEveryDolphin,
  readingThePicture,
  findingANamedBranch,
  choosingTheInstrument,
  beforeTheDay,
  theRoomAndTheTeam,
  sedationAndNumbing,
  enteringTheBlowhole,
  theSurveyAndTheRecord,
  lavage,
  toolsThroughTheChannel,
  brushAndBiopsy,
  troubleDuringTheProcedure,
  recoveryAndReturn,
  beyondTheSurvey,
  whatThisModuleCanSay,
]

const byId = new Map<string, DolphinSectionDefinition>(DOLPHIN_SECTIONS.map((s) => [s.id, s]))

export function dolphinSectionDefinition(id: DolphinSectionId): DolphinSectionDefinition | null {
  return byId.get(id) ?? null
}

export function isAuthoredDolphinSection(id: string): boolean {
  return byId.has(id)
}
