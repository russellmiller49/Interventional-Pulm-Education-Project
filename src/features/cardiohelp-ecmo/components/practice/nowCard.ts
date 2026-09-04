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

  if (input.safety && input.safety.labels.length > 0 && !facts.debriefRevealed) {
    return {
      kicker: 'Stopped for safety',
      heading: 'This path would harm a real patient',
      body: [...input.safety.labels, input.safety.lastResponse ?? ''].filter(Boolean).join(' '),
      tone: 'safety',
      primary: { label: 'Restart from the clean case', onActivate: actions.restart },
    }
  }

  switch (activeStage) {
    case 'brief':
      return {
        kicker,
        heading: 'Read the case',
        body: `${input.setting ? `${input.setting}. ` : ''}Read the patient picture and the data shown; nothing needs a decision yet. The circuit is open beside it so you can see where this patient sits on it.`,
        primary: { label: 'Begin case', onActivate: actions.beginCase },
      }
    case 'plan':
      return {
        kicker,
        heading: 'Commit your plan before touching anything',
        body: 'Choose the immediate goal, your first move, and the response you expect. The plan you commit is what the debrief compares against; later actions do not rewrite it.',
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
                label: 'Go to the next unmatched control',
                onActivate: () => actions.focusControl(input.initiation!.nextControlId!),
              }
            : undefined,
        }
      }
      if (facts.manageComplete && facts.observation.responseObserved) {
        return {
          kicker,
          heading: 'Response observed — record it',
          body: 'The circuit and the patient have had time to respond. Record what you see in the three domains.',
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
          body: 'The cause is addressed. Advance the clock so the circuit and patient can respond before you record what you see.',
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
          body: 'Reveal the debrief to compare what you recorded with the authored response, the causal chain and the sources.',
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
          heading: 'Your reassessment is recorded',
          body: 'Reveal the debrief to compare what you recorded with the authored response, the causal chain and the sources.',
          primary: { label: 'Reveal causal debrief', onActivate: actions.reveal },
        }
      }
      return {
        kicker,
        heading: 'Compare your reasoning with the authored path',
        body: 'Your committed plan, your actions and the modeled response are laid out below with their sources. Then pick up the next recommended step.',
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
