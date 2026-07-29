import { render } from '@testing-library/react'

import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { VA_MODELED_CONFIGURATION } from '../components/teaching/shared'
import { ecmoFoundationLearningItems } from '../content/foundationLearningItems'
import {
  ecmoFoundationLessonRuntimes,
  ecmoFoundationVariants,
  ecmoVaOnlyFoundationSectionIds,
} from '../content/foundationLessonRuntime'
import { createFoundationVariantState } from '../session/foundationSession'

/**
 * Clinical-copy guards for the VA dual-circulation teaching.
 *
 * These pin physiology, not phrasing. Each one names a specific claim that is wrong for peripheral
 * femoral V-A ECMO with retrograde arterial return, and fails if that claim reappears anywhere a
 * learner can read it — panel prose, text equivalents, matrix cells, model boundaries, or the
 * prediction and transfer items.
 */

/** Everything a learner can read across the three VA lessons, in every state they can load. */
function vaLearnerCorpus(): string {
  const parts: string[] = []

  for (const sectionId of ecmoVaOnlyFoundationSectionIds) {
    const runtime = ecmoFoundationLessonRuntimes[sectionId]
    for (const variant of ecmoFoundationVariants(runtime, 'va')) {
      const { container, unmount } = render(
        <EcmoFoundationTeachingPanel
          sectionId={sectionId}
          state={createFoundationVariantState(variant)}
        />,
      )
      parts.push(container.textContent ?? '')
      unmount()
    }
    for (const phase of Object.values(runtime.phases)) {
      parts.push(phase.objective, phase.requiredAction, phase.teachingPoint)
    }
    for (const guided of runtime.guidedActions) parts.push(guided.label, guided.description)
    for (const variant of ecmoFoundationVariants(runtime, 'va')) {
      parts.push(variant.label, variant.modelBoundary ?? '')
    }

    const items = ecmoFoundationLearningItems[sectionId]
    for (const item of [items.prediction, items.transfer]) {
      parts.push(item.stem, item.explanation)
      for (const choice of item.choices) parts.push(choice.label, choice.rationale)
    }
  }

  return parts.join('\n')
}

let corpus = ''
beforeAll(() => {
  corpus = vaLearnerCorpus()
})

describe('the mixing point moves the way the physiology does', () => {
  it('has a corpus to check', () => {
    expect(corpus.length).toBeGreaterThan(5_000)
    expect(corpus).toMatch(/mixing point/i)
  })

  it('never says raising circuit flow moves the mixing point distally', () => {
    // Retrograde femoral return: raising circuit flow relative to native ejection pushes the
    // meeting place back toward the aortic root, which is proximal. The opposite claim was in the
    // capstone prediction as "pushes the watershed further from the arch".
    // `raising` must be immediately followed by the flow it is raising. Written this way so that
    // "Raising native ejection relative to circuit flow moves it more distally" — which is correct —
    // is not read as a claim about raising circuit flow.
    const flow = '(?:the\\s+)?(?:circuit|ECMO|pump|femoral venoarterial)\\s+flow'
    const distal =
      '(?:more distal|distally|further from the (?:arch|root)|away from the (?:arch|root))'
    expect(corpus).not.toMatch(new RegExp(`rais(?:e|es|ing)\\s+${flow}[^.]{0,90}${distal}`, 'i'))
    expect(corpus).not.toMatch(
      new RegExp(`(?:increas(?:e|es|ing)|higher)\\s+${flow}[^.]{0,90}${distal}`, 'i'),
    )
    // Deliberately no looser "flow ... moves it distally" check: it fires on the correct sentence
    // "raising native ejection relative to circuit flow moves it more distally", and a guard that
    // fails on accurate copy would be removed by the next person rather than obeyed.
  })

  it('says raising native ejection moves it distally', () => {
    expect(corpus).toMatch(
      /(?:rais|recover|increas|more)[^.]{0,80}native (?:ejection|output|LV flow)[^.]{0,120}(?:more distal|distally)/i,
    )
  })

  it('says raising circuit flow moves it proximally', () => {
    expect(corpus).toMatch(
      /(?:rais|increas)[^.]{0,90}(?:circuit|ECMO|femoral venoarterial)\s+flow[^.]{0,140}(?:more proximal|proximally|toward the (?:aortic )?root|back toward the (?:ascending aorta|root))/i,
    )
  })

  it('does not present raising flow as uniformly good or uniformly bad', () => {
    // The teaching point is that the same action helps one problem and deepens another. Copy that
    // only warns, or only reassures, has replaced one oversimplification with another.
    const raiseRationale = ecmoFoundationLearningItems[
      'va-integration-capstone'
    ].prediction.choices.find((choice) => choice.id === 'raise-circuit-flow')
    expect(raiseRationale).toBeDefined()
    const text = raiseRationale!.rationale
    expect(text).toMatch(/improve|lift|relieve/i)
    expect(text).toMatch(/afterload|eject against/i)
    expect(text).toMatch(/distension|congestion|stasis/i)
  })

  it('never claims raising flow uniformly worsens differential oxygenation', () => {
    expect(corpus).not.toMatch(
      /rais(?:e|es|ing)[^.]{0,60}flow[^.]{0,90}(?:always|uniformly|invariably)[^.]{0,40}(?:worsen|improv)/i,
    )
  })
})

describe('coronary and arch anatomy are kept apart', () => {
  it('never describes the coronary arteries as arch branches', () => {
    expect(corpus).not.toMatch(/coronar\w*[^.]{0,80}aris\w+ from the (?:aortic )?arch/i)
    // The exact shape of the original defect: "the vessels arising from the arch — including the
    // coronary and cerebral circulations". Matched narrowly so that correct copy naming the arch
    // branches in one stage and the coronary origin in the next does not trip it.
    expect(corpus).not.toMatch(/from the arch[^.]{0,40}includ\w+[^.]{0,40}coronar/i)
    expect(corpus).not.toMatch(/coronary and cerebral beds sit above/i)
    expect(corpus).not.toMatch(
      /coronary and cerebral[^.]{0,40}(?:arise|sit) (?:from|above) the arch/i,
    )
  })

  it('places the coronary origin at the aortic root', () => {
    expect(corpus).toMatch(/coronar\w*[^.]{0,80}(?:aortic )?root/i)
  })

  it('names the three arch branches', () => {
    expect(corpus).toMatch(/brachiocephalic/i)
    expect(corpus).toMatch(/left common carotid/i)
    expect(corpus).toMatch(/left subclavian/i)
  })

  it('never says a right radial value establishes coronary oxygenation', () => {
    expect(corpus).not.toMatch(
      /right radial[^.]{0,100}(?:guarantee|establishes|confirms|proves|assures)[^.]{0,60}coronar/i,
    )
    expect(corpus).not.toMatch(
      /coronar\w*[^.]{0,80}(?:guaranteed|established|confirmed) by[^.]{0,40}right radial/i,
    )
  })

  it('states the right radial limit explicitly', () => {
    expect(corpus).toMatch(
      /right radial[^.]{0,160}(?:does not (?:on its own )?(?:establish|settle)|cannot always be inferred|not on its own establish)/i,
    )
  })

  it('never says native ejection guarantees the arch branches get native-lung blood', () => {
    // It depends on where the mixing point sits, which is the whole teaching point.
    expect(corpus).not.toMatch(
      /any native ejection[^.]{0,80}(?:means|guarantees)[^.]{0,80}(?:coronary|cerebral|upper body)/i,
    )
    expect(corpus).toMatch(/when the mixing point lies (?:distal|proximal)/i)
  })
})

describe('the modeled configuration is named, not implied', () => {
  it('labels the live simulation as peripheral femoral V-A with retrograde return', () => {
    expect(VA_MODELED_CONFIGURATION).toBe(
      'peripheral femoral V-A ECMO with retrograde arterial return',
    )
    expect(corpus).toContain(VA_MODELED_CONFIGURATION)
  })

  it('renders the configuration badge on every VA panel', () => {
    for (const sectionId of ecmoVaOnlyFoundationSectionIds) {
      const runtime = ecmoFoundationLessonRuntimes[sectionId]
      const variant = ecmoFoundationVariants(runtime, 'va')[0]
      const { container, unmount } = render(
        <EcmoFoundationTeachingPanel
          sectionId={sectionId}
          state={createFoundationVariantState(variant)}
        />,
      )
      expect(container.querySelector('[data-va-configuration]')).not.toBeNull()
      unmount()
    }
  })

  it('uses the ELSO hyphenated spelling and never bare VAV', () => {
    expect(corpus).toMatch(/\bV-AV\b/)
    // "VAV" unhyphenated must not appear as a configuration name.
    expect(corpus).not.toMatch(/(^|[^A-Za-z-])VAV([^A-Za-z-]|$)/)
  })

  it('says the other configurations are described but not simulated', () => {
    expect(corpus).toMatch(/described but not simulated here/i)
  })
})
