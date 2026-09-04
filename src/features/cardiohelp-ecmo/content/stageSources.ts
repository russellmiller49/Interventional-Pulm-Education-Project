import { ecmoDeliveryAttribution } from './deliveryAttribution'
import { ECMO_CONTROL_PANEL } from './controlPanel'
import { ecmoCircuitWalkStopsForSection } from './circuitWalk'
import { ecmoDrillSpecs } from './drillSpecs'
import { ecmoFoundationLearningItemsFor } from './foundationLearningItems'
import { ecmoFoundationSectionById } from './foundationLessons'
import {
  ecmoFoundationLessonRuntime,
  isEcmoInteractiveFoundationSectionId,
  type EcmoInteractiveFoundationSectionId,
} from './foundationLessonRuntime'
import { ecmoLearnPredictionFor } from './learnPredictionItems'
import { ecmoLocalizationRow, ecmoLocalizationRows } from './localizationCards'
import { OXYGEN_DELIVERY_ARITHMETIC_CLAIMS } from './oxygenDeliveryArithmetic'
import { cardiohelpScenarioById } from './scenarios'
import { ecmoStoryProblemsFor } from './storyProblems'

/**
 * Everything one lesson cites, in one set, so the stage can cite it in one place.
 *
 * Sources used to be printed beside whatever named them: under the walk card, under the narrative,
 * under the explorer, under the attribution's selects — where an owner review found them "below the
 * module and less prominent" is where they belong instead. Nine bordered cards with class badges and
 * copy buttons were competing with the controls, and one set sat between the learner's answers and
 * the button that commits them.
 *
 * So the stage collects a lesson's whole source set here and renders it once, in the footer, folded
 * away. This is a derivation over the content registries rather than something the surfaces report
 * at render: a registry cannot forget to register, and `stage-sources.test.ts` mounts every panel
 * standalone and fails if a source a panel cites is missing from the set collected for its section.
 *
 * Claims are kept per id and per surface. A record the walk cites for where a reading is taken can
 * be the same record a pressure row cites for what the pattern means, and the footer states both
 * rather than collapsing them into whichever surface happened to be asked first.
 */

export interface EcmoStageSources {
  /** Registry ids, in the order the lesson introduces them, deduplicated. */
  readonly evidenceIds: readonly string[]
  /** Evidence id → every claim this lesson's surfaces take from that source. */
  readonly claims: Readonly<Record<string, readonly string[]>>
}

interface Collector {
  readonly ids: string[]
  readonly claims: Record<string, string[]>
}

function collect(
  into: Collector,
  ids: readonly string[],
  claims?: Readonly<Record<string, string>>,
) {
  for (const id of ids) {
    if (!into.ids.includes(id)) into.ids.push(id)
    const claim = claims && Object.hasOwn(claims, id) ? claims[id] : undefined
    if (!claim) continue
    const existing = (into.claims[id] ??= [])
    if (!existing.includes(claim)) existing.push(claim)
  }
}

function sealed(into: Collector): EcmoStageSources {
  return Object.freeze({
    evidenceIds: Object.freeze([...into.ids]),
    claims: Object.freeze(
      Object.fromEntries(
        Object.entries(into.claims).map(([id, claims]) => [id, Object.freeze([...claims])]),
      ),
    ),
  })
}

/**
 * The source sets a panel owns rather than the section record, by section.
 *
 * Each entry names content the panel reads — the control panel's own record, the arithmetic the
 * explorer computes with, the pressure rows the pump section teaches — so the set stays a
 * derivation. A panel that starts citing something new fails the rendered check until it is added
 * here, which is the point: the list is short, and the test says exactly what is missing.
 */
function collectPanelSources(into: Collector, sectionId: EcmoInteractiveFoundationSectionId) {
  if (sectionId === 'why-extracorporeal-support') {
    collect(into, Object.keys(OXYGEN_DELIVERY_ARITHMETIC_CLAIMS), OXYGEN_DELIVERY_ARITHMETIC_CLAIMS)
    const attribution = ecmoDeliveryAttribution(sectionId)
    if (attribution) collect(into, attribution.sourceIds, attribution.claims)
  }
  if (sectionId === 'blood-flow-versus-sweep') {
    collect(into, ECMO_CONTROL_PANEL.sourceIds)
    for (const story of ecmoStoryProblemsFor(sectionId)) {
      collect(into, story.item.evidenceIds)
    }
  }
  if (sectionId === 'pump-and-pressure-zones' || sectionId.endsWith('integration-capstone')) {
    // The four pressure patterns, each with the claim its own row takes from its sources.
    for (const row of ecmoLocalizationRows) {
      for (const support of row.sourceSupport) {
        collect(into, [support.evidenceId], { [support.evidenceId]: support.claim })
      }
    }
  }
}

/** Everything a foundation section's surfaces cite, task pane and teaching pane together. */
export function ecmoFoundationStageSources(
  sectionId: EcmoInteractiveFoundationSectionId,
): EcmoStageSources {
  const into: Collector = { ids: [], claims: {} }
  const section = ecmoFoundationSectionById.get(sectionId)
  if (section) collect(into, section.sourceIds)
  collect(into, ecmoFoundationLessonRuntime(sectionId).evidenceIds)
  for (const stop of ecmoCircuitWalkStopsForSection(sectionId)) collect(into, stop.sourceIds)
  const items = ecmoFoundationLearningItemsFor(sectionId)
  collect(into, items.prediction.evidenceIds)
  collect(into, items.transfer.evidenceIds)
  collectPanelSources(into, sectionId)
  return sealed(into)
}

/** Everything a drill's surfaces cite: the scenario, its prediction item, and its pressure row. */
export function ecmoDrillStageSources(scenarioId: string): EcmoStageSources {
  const into: Collector = { ids: [], claims: {} }
  const scenario = cardiohelpScenarioById.get(scenarioId)
  if (scenario) collect(into, scenario.evidenceIds)
  const prediction = ecmoLearnPredictionFor(scenarioId)
  if (prediction) collect(into, prediction.item.evidenceIds)
  const rowId = ecmoDrillSpecs[scenarioId]?.localizationRowId
  if (rowId) {
    for (const support of ecmoLocalizationRow(rowId).sourceSupport) {
      collect(into, [support.evidenceId], { [support.evidenceId]: support.claim })
    }
  }
  return sealed(into)
}

/** The set for whichever kind of lesson the stage is showing. */
export function ecmoStageSources(sectionId: string): EcmoStageSources {
  return isEcmoInteractiveFoundationSectionId(sectionId)
    ? ecmoFoundationStageSources(sectionId)
    : ecmoDrillStageSources(sectionId)
}
