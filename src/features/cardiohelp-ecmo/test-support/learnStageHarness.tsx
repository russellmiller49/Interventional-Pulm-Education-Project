import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { EcmoLessonStage } from '../components/stage/EcmoLessonStage'
import { resolveGuidedLesson } from '../components/stage/adapters/drillStageAdapter'
import { ecmoLearnPredictionFor } from '../content/learnPredictionItems'
import type { EcmoSimulationState } from '../engine'

/**
 * Drives a drill on the real Learn stage, over the real session core and the real simulator.
 *
 * The stage owns its engine, so the harness reads the simulator through the stage's observability
 * seam rather than from a reducer of its own: `latestState()` is the engine state after the last
 * change. Every helper here performs the step the way a learner does — the Now card's one primary
 * action, a control on the console or the circuit — and never reaches into the session.
 *
 * Callers must mock `@/i18n/navigation` (the stage links and routes) and `fetch` (site analytics)
 * before mounting; both are per-suite concerns.
 */

let latest: EcmoSimulationState | null = null

export function latestState(): EcmoSimulationState {
  if (!latest) throw new Error('The stage has not reported a simulation state yet')
  return latest
}

export function resetStageHarness() {
  latest = null
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
}

/** Mount a drill by id and wait until its first step is on the Now card. */
export async function mountDrill(scenarioId: string) {
  const lesson = resolveGuidedLesson(scenarioId)
  window.history.replaceState(
    null,
    '',
    `/cardiohelp-ecmo/learn?lesson=${scenarioId}&track=${lesson.supportMode}`,
  )
  const view = render(
    <EcmoLessonStage
      onStateChange={(state) => {
        latest = state
      }}
    />,
  )
  await screen.findByRole('heading', { name: lesson.steps[0].title })
  await waitFor(() => expect(latestState().scenario.scenarioId).toBe(scenarioId))
  return { lesson, view }
}

export function nowCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('[data-now-card]')
  if (!card) throw new Error('No Now card on the stage')
  return card
}

export function nowPrimary(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-primary]')
  if (!button) throw new Error('The Now card has no primary action')
  return button
}

/** The prediction's own radios — the header's track toggle is a radiogroup too, and is not a choice. */
export function predictionRadios(): HTMLElement[] {
  const fieldset = document.querySelector<HTMLElement>('[data-prediction-choices]')
  return fieldset ? Array.from(fieldset.querySelectorAll<HTMLElement>('input[type="radio"]')) : []
}

export function nowStatus(): string {
  return document.querySelector('[data-now-card] [data-now-status]')?.textContent ?? ''
}

/** A read step's one action, which also moves the lesson on. */
export function readStep(actionName: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: actionName }))
}

/** A model-advance or unrecognised task: perform it from the Now card, then take Next step. */
export function performAndAdvance(actionName: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: actionName }))
  fireEvent.click(screen.getByRole('button', { name: /^Next step$/i }))
}

/** A recognised console task completes from the simulator; wait for Done, then take Next step. */
export async function awaitDoneAndAdvance() {
  await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
  fireEvent.click(screen.getByRole('button', { name: /^Next step$/i }))
}

export async function openConsoleScreenAndAdvance(buttonName: string) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }))
  await awaitDoneAndAdvance()
}

/** Ramps the rotary from a stopped circuit to the reference speed, the way the lesson asks. */
export async function rampToReferenceSpeedAndAdvance() {
  const knob = screen.getByRole('slider', { name: /RPM rotary setpoint/i })
  while (latestState().device.rpmSetpoint < 3200) {
    fireEvent.keyDown(knob, { key: 'ArrowUp' })
  }
  expect(latestState().device.rpmSetpoint).toBe(3200)
  await awaitDoneAndAdvance()
}

export function predictionChoice(scenarioId: string, plausibility: string) {
  const prediction = ecmoLearnPredictionFor(scenarioId)
  if (!prediction) throw new Error(`No authored prediction for ${scenarioId}`)
  const choice = prediction.item.choices.find((item) => item.plausibility === plausibility)
  if (!choice) throw new Error(`No ${plausibility} choice for ${scenarioId}`)
  return { ...choice, commitment: prediction.commitments[choice.id] }
}

/** Answers the prediction, then takes the verdict's separate Continue. */
export function answerPredictionAndAdvance(scenarioId: string, plausibility = 'best') {
  fireEvent.click(
    screen.getByRole('radio', { name: predictionChoice(scenarioId, plausibility).label }),
  )
  fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

/** Walks the console tour from its first step to the authored prediction. */
export async function walkOrientationToPrediction() {
  readStep(/identify all four domains/i)
  await openConsoleScreenAndAdvance('Parameter list')
  await rampToReferenceSpeedAndAdvance()
  performAndAdvance('Let the circuit respond')
  const running = latestState()
  await openConsoleScreenAndAdvance('Parameter list')
  await openConsoleScreenAndAdvance('Blood parameters')
  await openConsoleScreenAndAdvance('Transport')
  await openConsoleScreenAndAdvance('Interventions')
  await openConsoleScreenAndAdvance('Timers')
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  await openConsoleScreenAndAdvance('Alarm list')
  await openConsoleScreenAndAdvance('Home')
  readStep(/I can distinguish the two gas controls/i)
  performAndAdvance(/Return the circuit to its pre-use state/i)
  return { running, atPrediction: latestState() }
}
