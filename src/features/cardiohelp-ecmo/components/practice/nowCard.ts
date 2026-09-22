import type { NowCardModel } from '../shell/EcmoNowCard'
import type { EcmoPracticeStage, PracticeStageFacts } from './stages'

/**
 * The one thing to do now, per stage of a Practice case.
 *
 * This replaces the stage rail's inline "what to do next" heading and the workbench's objective
 * map: one resolver, one card, one primary action. The safety tone takes over whenever a critical
 * error is standing.
 */
export interface NowCardInput {
  readonly facts: PracticeStageFacts
  readonly activeStage: EcmoPracticeStage
  readonly activityMode: 'practice' | 'challenge'
  readonly setting?: string
  readonly safety?: { readonly labels: readonly string[]; readonly lastResponse?: string }
  readonly pendingMachineTask?: { readonly label: string; readonly controlId: string } | null
  readonly initiation?: {
    readonly allMatched: boolean
    readonly nextControlId: string | null
  } | null
  readonly secondsSinceLastAction?: number | null
  readonly nextLabel?: string | null
  readonly actions: {
    readonly beginCase: () => void
    readonly focusControl: (controlId: string) => void
    readonly openStage: (stage: EcmoPracticeStage) => void
    readonly advanceSeconds: (seconds: number) => void
    readonly reveal: () => void
    readonly restart: () => void
    readonly replay: () => void
    readonly next?: () => void
  }
}

export function resolveNowCard(input: NowCardInput): NowCardModel {
  const { facts, activeStage, actions } = input
  const stageNumber = facts.stages.find((stage) => stage.id === activeStage)?.number ?? 1
  const kicker = `Now · ${stageNumber} of ${facts.stages.length} · ${labelFor(activeStage)}`

  /*
   * A safety event takes over the card. It does not take away the explanation.
   *
   * This branch used to offer Restart and nothing else, and it sits ahead of the reassess and
   * debrief branches that carry "Reveal causal debrief" — so on the two paths the September 2026
   * walkthrough took (C1-2 in VV initiation, C5-1 in recirculation) the only route out of a safety
   * warning was to throw the attempt away. The warning stays exactly as prominent: same tone, same
   * heading, the event named through its own authored label. What changed is that the primary
   * action reads the case explanation and the restart moved beside it as a choice.
   *
   * Revealing is a read. It sets the debrief phase and nothing else: no event is cleared, no
   * treatment runs, no observation is anchored, no credit or trajectory moves, and the learner's
   * own attempt is still the one on screen.
   */
  if (input.safety && input.safety.labels.length > 0 && !facts.debriefRevealed) {
    return {
      kicker: 'Safety feedback',
      heading: 'Review this safety event',
      body: [...input.safety.labels, input.safety.lastResponse ?? ''].filter(Boolean).join(' '),
      tone: 'safety',
      status:
        'Reading the explanation does not clear this event, undo it, or complete the case. You can also keep working this attempt from the case workflow below.',
      primary: { label: 'Open the case explanation', onActivate: actions.reveal },
      secondary: { label: 'Restart this case from the beginning', onActivate: actions.restart },
    }
  }

  switch (activeStage) {
    case 'brief':
      return {
        kicker,
        heading: 'Read the case',
        /*
         * "The circuit is open beside it so you can see where this patient sits on it" — quoted back
         * by a learner in September 2026 as the example of copy she had to read twice. Two pronouns
         * ("it" for the panel, "it" for the circuit) and a spatial claim about a pane that may not
         * be beside anything at a narrow width.
         */
        body: `${input.setting ? `${input.setting}. ` : ''}Read the clinical brief and its measurements, then explore the activity or view its explanation. The working simulation opens when you reach management.`,
        primary: { label: 'Begin case', onActivate: actions.beginCase },
      }
    case 'plan':
      return {
        kicker,
        heading: 'Consider a plan (optional)',
        body: 'Try a prediction to compare with the case explanation, start the guided activity, or read the explanation directly.',
      }
    case 'manage': {
      if (input.pendingMachineTask) {
        return {
          kicker,
          heading: 'Make the machine change on the simulator',
          body: `${input.pendingMachineTask.label}. The checklist updates from the simulator itself; nothing can be applied from the side panel.`,
          primary: {
            label: 'Go to the control',
            onActivate: () => actions.focusControl(input.pendingMachineTask!.controlId),
          },
        }
      }
      if (input.initiation && !input.initiation.allMatched) {
        return {
          kicker,
          heading: 'Configure the simulator, then start support',
          body: 'Set the ordered speed on the console and the ordered sweep and oxygen fraction on the gas blender. Each order is matched from the simulator itself.',
          primary: input.initiation.nextControlId
            ? {
                label: 'Go to the next control that does not match the order',
                onActivate: () => actions.focusControl(input.initiation!.nextControlId!),
              }
            : undefined,
        }
      }
      if (facts.manageComplete && facts.observation.responseObserved) {
        return {
          kicker,
          heading: 'Response observed — record it',
          body: 'The circuit and the patient have had time to respond. Record what you see on the device, in the circuit and in the patient.',
          primary: { label: 'Go to reassess', onActivate: () => actions.openStage('reassess') },
        }
      }
      const attempted = facts.observation.anchor !== null
      return {
        kicker,
        heading: 'Act on the case',
        body: 'Apply bedside actions from the cards; machine changes happen on the console or the gas blender. When you have made your final decision, observe the response.',
        status:
          input.secondsSinceLastAction !== null && input.secondsSinceLastAction !== undefined
            ? `${input.secondsSinceLastAction} s since your last action`
            : undefined,
        primary:
          attempted && !facts.observation.responseObserved
            ? {
                label: `Observe the response (${facts.observation.remainingSeconds} s)`,
                onActivate: () => actions.advanceSeconds(facts.observation.remainingSeconds),
              }
            : undefined,
      }
    }
    case 'reassess':
      if (!facts.observation.responseObserved && facts.observation.anchor !== null) {
        const seconds = facts.observation.remainingSeconds
        return {
          kicker,
          heading: `Let the response develop — ${seconds} s to go`,
          /*
           * "Your last action is in" rather than "the cause is addressed".
           *
           * This card is reached from recognition-only cases too, where the authored move is to
           * verify the pattern and escalate and the cause is deliberately still running. Telling
           * the learner it had been addressed contradicted the monitor they were about to read
           * (IA-3). What the card actually knows is that an action was taken and the clock has not
           * caught up with it yet, so that is what it says.
           */
          body: 'Your last action is in. Advance the clock so the circuit and patient can respond before you record what you see.',
          primary: {
            label: `Advance ${seconds} second${seconds === 1 ? '' : 's'} now`,
            onActivate: () => actions.advanceSeconds(seconds),
          },
        }
      }
      if (facts.reassessmentSubmitted && !facts.debriefRevealed) {
        return {
          kicker,
          heading: 'Your reassessment is recorded',
          body: 'Reveal the debrief to compare what you recorded with the response this case teaches, the causal chain and the sources.',
          primary: { label: 'Reveal causal debrief', onActivate: actions.reveal },
        }
      }
      return {
        kicker,
        heading: 'Record what you observe in three places',
        body: 'Pick the device, the circuit or gas, and the patient response you actually see on the monitor and the trends, not the one you expected. This loop is the point of the case.',
      }
    case 'debrief':
    default:
      if (!facts.debriefRevealed) {
        return {
          kicker,
          heading: facts.reassessmentSubmitted
            ? 'Your reassessment is recorded'
            : 'Review the case explanation',
          body: 'Reveal the case explanation, causal chain and sources. Any responses you recorded remain separate from the teaching example.',
          primary: { label: 'Reveal causal debrief', onActivate: actions.reveal },
        }
      }
      return {
        kicker,
        heading: 'Compare your reasoning with the path this case teaches',
        body: 'The case explanation and any actions you performed are shown below with their sources. Viewing this page does not perform the activity.',
        primary:
          input.nextLabel && actions.next
            ? { label: `Next: ${input.nextLabel}`, onActivate: actions.next }
            : undefined,
        secondary: { label: 'Replay this case', onActivate: actions.replay },
      }
  }
}

function labelFor(stage: EcmoPracticeStage): string {
  return stage === 'brief'
    ? 'Brief'
    : stage === 'plan'
      ? 'Plan'
      : stage === 'manage'
        ? 'Manage'
        : stage === 'reassess'
          ? 'Reassess'
          : 'Debrief'
}
