export interface ScenarioFeedback {
  readonly whatHappened: string
  readonly whyItHappened: string
  readonly likelyFrame?: string
  readonly theCue: string
  readonly conceptIds: readonly string[]
  readonly evidenceIds: readonly string[]
}

export interface ScenarioDecisionTraceEntry {
  readonly id: string
  readonly timeSeconds: number
  readonly action: string
  readonly systemState: string
}

export interface ScenarioExpertTraceStep {
  readonly id: string
  readonly moment: string
  readonly cue: string
  readonly reasoning: string
  readonly commitment: string
}

export interface ScenarioFeedbackEvent {
  readonly id: string
  readonly actionId: string
  readonly actionLabel: string
  readonly timeSeconds: number
  readonly timing: 'immediate' | 'after-consequence' | 'debrief'
  readonly hardInterrupt: boolean
  readonly feedback: ScenarioFeedback
}
