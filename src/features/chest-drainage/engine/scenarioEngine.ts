import type { SimulationState } from './types'

export interface ScenarioAction {
  id: string
  label: string
  result: 'safe' | 'partial' | 'unsafe'
  feedback: string
  nextState?: Partial<SimulationState>
}

export interface TroubleshootingScenario {
  id: string
  title: string
  learnerSees: string
  patientFirstPrompt: string
  bestReasoning: string
  debrief: string
  actions: ScenarioAction[]
}

export interface ScenarioEvaluation {
  result: ScenarioAction['result']
  score: number
  feedback: string
}

export function evaluateScenarioAction(
  scenario: TroubleshootingScenario,
  actionId: string,
): ScenarioEvaluation {
  const action = scenario.actions.find((item) => item.id === actionId)

  if (!action) {
    return {
      result: 'unsafe',
      score: 0,
      feedback: 'That action is not available in this case.',
    }
  }

  const scoreByResult: Record<ScenarioAction['result'], number> = {
    safe: 2,
    partial: 1,
    unsafe: 0,
  }

  return {
    result: action.result,
    score: scoreByResult[action.result],
    feedback: action.feedback,
  }
}

export function calculateScenarioScore(evaluations: ScenarioEvaluation[]): number {
  if (!evaluations.length) {
    return 0
  }

  const earned = evaluations.reduce((total, evaluation) => total + evaluation.score, 0)

  return Math.round((earned / (evaluations.length * 2)) * 100)
}
