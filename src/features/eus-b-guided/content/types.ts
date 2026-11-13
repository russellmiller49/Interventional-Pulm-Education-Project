import type { EusbLabId } from '@/lib/eus-b-guided-contract'

export interface Choice {
  id: string
  text: string
  rationale: string
  correct?: boolean
  unsafe?: boolean
}

export interface Question {
  id: string
  prompt: string
  choices: Choice[]
  explanation: string
}

/** A drawing or table a briefing shows beside its text. */
export type FigureKind = 'survey-route' | 'reach-table'

/**
 * One task of a lesson. A lesson is its list of steps, in order; nothing else decides the flow.
 *
 * `view` and `lab` name an entry of the lab list (`src/lib/eus-b-guided-contract.ts`). A question
 * with a `view` is asked on that image with nothing named until the learner has answered or opened
 * the explanation.
 */
export type Step =
  | {
      kind: 'predict'
      id: string
      title: string
      stem?: string
      question: Question
      view?: EusbLabId
    }
  | {
      kind: 'brief'
      id: string
      title: string
      body: string[]
      points?: string[]
      figure?: FigureKind
      /** A labeled still shown beside the text. */
      view?: EusbLabId
      /** A station whose numbered landmarks are listed under the text, as on the still. */
      station?: string
    }
  | { kind: 'lab'; id: string; title: string; instruction: string; lab: EusbLabId }
  /** Mark each landmark of a view on a still with nothing named. */
  | { kind: 'identify'; id: string; title: string; instruction: string; lab: EusbLabId }
  | {
      kind: 'debrief'
      id: string
      title: string
      /** The lab step whose image this explains. */
      of: string
      body: string[]
      points?: string[]
      /** A station whose numbered landmarks are listed under the text, as on the image. */
      station?: string
    }
  | {
      kind: 'check'
      id: string
      title: string
      stem?: string
      question: Question
      view?: EusbLabId
    }

export type StepKind = Step['kind']

export interface Lesson {
  id: string
  title: string
  minutes: number
  objective: string
  /** The survey stop this lesson teaches, 1 to 6, where it teaches one. */
  stop?: number
  steps: Step[]
  takeaways: string[]
  sources: string[]
}

export interface Chapter {
  id: string
  title: string
  lessons: Lesson[]
}
