import { render } from '@testing-library/react'

import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'

import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { VA_MODELED_CONFIGURATION } from '../components/teaching/shared'
import {
  VA_CONFIGURATION_STRATEGIES,
  VaConfigurationStrategyCard,
  vaConfigurationStrategiesByClass,
  type VaConfigurationStrategy,
  type VaConfigurationStrategyId,
} from '../components/teaching/VaConfigurationStrategyCard'
import { evidenceById, validateEvidenceIds } from '../content/evidence'
import { ecmoFoundationSectionById } from '../content/foundationLessons'
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

function strategy(id: VaConfigurationStrategyId): VaConfigurationStrategy {
  const found = VA_CONFIGURATION_STRATEGIES.find((entry) => entry.id === id)
  if (!found) throw new Error(`no configuration strategy authored for ${id}`)
  return found
}

/** Everything one strategy says, in the order the card renders it. */
function strategyText(id: VaConfigurationStrategyId): string {
  const entry = strategy(id)
  return [
    entry.name,
    entry.mechanism,
    entry.doesNotChange,
    entry.caution,
    entry.modelBoundary,
  ].join(' ')
}

/**
 * The card's teaching copy on its own, so an assertion about it is not answered by the panel around
 * it. The source-id line is removed first: those ids carry publication years, and the guard below
 * that the card contains no number at all is about flow targets and timing cutoffs, not citations.
 */
function renderCard(detail: 'full' | 'concise'): string {
  const { container, unmount } = render(<VaConfigurationStrategyCard detail={detail} />)
  container.querySelector('[data-configuration-card-sources]')?.remove()
  const text = container.textContent ?? ''
  unmount()
  return text
}

/** The VA capstone panel in its presenting state, where the limb card and matrix live. */
function renderCapstone(): HTMLElement {
  const runtime = ecmoFoundationLessonRuntimes['va-integration-capstone']
  const variant = ecmoFoundationVariants(runtime, 'va')[0]
  const { container } = render(
    <EcmoFoundationTeachingPanel
      sectionId="va-integration-capstone"
      state={createFoundationVariantState(variant)}
    />,
  )
  return container
}

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

/* ------------------------------------------------------------------ *
 * The configuration strategy card
 * ------------------------------------------------------------------ */

describe('configuration is taught as five distinct changes, not one lever', () => {
  it('authors five strategies across three kinds of change', () => {
    expect(VA_CONFIGURATION_STRATEGIES).toHaveLength(5)
    expect(VA_CONFIGURATION_STRATEGIES.map((entry) => entry.id)).toEqual([
      'improve-native-lung-zone',
      'convert-to-v-av',
      'upper-body-arterial-return',
      'central-va',
      'raise-femoral-circuit-flow',
    ])
    expect(
      vaConfigurationStrategiesByClass('native-stream-content').map((entry) => entry.id),
    ).toEqual(['improve-native-lung-zone', 'convert-to-v-av'])
    expect(vaConfigurationStrategiesByClass('return-topology').map((entry) => entry.id)).toEqual([
      'upper-body-arterial-return',
      'central-va',
    ])
    expect(
      vaConfigurationStrategiesByClass('relative-femoral-flow').map((entry) => entry.id),
    ).toEqual(['raise-femoral-circuit-flow'])
  })

  it('renders the full card in the parallel-physiology lesson and the concise one in the capstone', () => {
    for (const [sectionId, expected] of [
      ['va-parallel-physiology', 'full'],
      ['va-integration-capstone', 'concise'],
    ] as const) {
      const runtime = ecmoFoundationLessonRuntimes[sectionId]
      const variant = ecmoFoundationVariants(runtime, 'va')[0]
      const { container, unmount } = render(
        <EcmoFoundationTeachingPanel
          sectionId={sectionId}
          state={createFoundationVariantState(variant)}
        />,
      )
      expect(container.querySelector(`[data-va-configuration-card="${expected}"]`)).not.toBeNull()
      const other = expected === 'full' ? 'concise' : 'full'
      expect(container.querySelector(`[data-va-configuration-card="${other}"]`)).toBeNull()
      unmount()
    }
  })

  it('keeps the card out of the VV lessons and out of the VA baseline review', () => {
    for (const sectionId of ['vv-series-physiology', 'vv-integration-capstone'] as const) {
      const runtime = ecmoFoundationLessonRuntimes[sectionId]
      const variant = ecmoFoundationVariants(runtime, 'vv')[0]
      const { container, unmount } = render(
        <EcmoFoundationTeachingPanel
          sectionId={sectionId}
          state={createFoundationVariantState(variant)}
        />,
      )
      expect(container.querySelector('[data-va-configuration-card]')).toBeNull()
      unmount()
    }

    const runtime = ecmoFoundationLessonRuntimes['va-normal-state']
    const variant = ecmoFoundationVariants(runtime, 'va')[0]
    const { container } = render(
      <EcmoFoundationTeachingPanel
        sectionId="va-normal-state"
        state={createFoundationVariantState(variant)}
      />,
    )
    // The baseline review keeps the badge and the boundary and does not repeat the card.
    expect(container.querySelector('[data-va-configuration-card]')).toBeNull()
    expect(container.querySelector('[data-va-configuration]')).not.toBeNull()
  })

  it('names the modeled configuration before naming any alternative', () => {
    for (const detail of ['full', 'concise'] as const) {
      const { container, unmount } = render(<VaConfigurationStrategyCard detail={detail} />)
      const boundary =
        container.querySelector('[data-configuration-card-boundary]')?.textContent ?? ''
      expect(boundary).toContain(
        'The live model on this page represents peripheral femoral V-A ECMO with retrograde arterial return.',
      )
      expect(boundary).toContain('described rather than simulated')
      unmount()
    }
  })

  it('states beside the modeled diagram that other configurations run differently', () => {
    const runtime = ecmoFoundationLessonRuntimes['va-parallel-physiology']
    const variant = ecmoFoundationVariants(runtime, 'va')[0]
    const { container } = render(
      <EcmoFoundationTeachingPanel
        sectionId="va-parallel-physiology"
        state={createFoundationVariantState(variant)}
      />,
    )
    const note = container.querySelector('[data-configuration-diagram-note]')?.textContent ?? ''
    expect(note).toContain('This diagram shows peripheral femoral V-A ECMO')
    expect(note).toMatch(/V-AV, upper-body arterial return, and central return/)
  })

  it('expands V-AV where it is first named, in both densities', () => {
    expect(strategyText('convert-to-v-av')).toContain(
      'V-AV ECMO: venous drainage with both arterial and venous return limbs',
    )
    for (const detail of ['full', 'concise'] as const) {
      expect(renderCard(detail)).toMatch(/\bV-AV\b/)
    }
  })

  it('describes V-AV as venous drainage, arterial return, and an added venous return limb', () => {
    const text = strategyText('convert-to-v-av')
    expect(text).toMatch(/venous drainage/i)
    expect(text).toMatch(/arterial return/i)
    expect(text).toMatch(/venous return limb/i)
    expect(text).toMatch(/traverses the pulmonary circulation|crosses the pulmonary circulation/i)
    expect(text).toMatch(/oxygen content of what the left ventricle ejects/i)
  })

  it('never describes V-AV as merely more femoral arterial flow', () => {
    const text = strategyText('convert-to-v-av')
    expect(text).toMatch(/not a larger femoral arterial flow/i)
    expect(text).not.toMatch(
      /V-AV[^.]{0,80}(?:simply|merely|just)[^.]{0,40}(?:more|rais\w+|increas\w+)[^.]{0,30}flow/i,
    )
    // And the corpus never equates the two in either direction.
    expect(corpus).not.toMatch(
      /(?:rais\w+|increas\w+)[^.]{0,40}femoral[^.]{0,40}flow[^.]{0,60}(?:is|amounts to|the same as)[^.]{0,20}V-AV/i,
    )
  })

  it('says V-AV is not simulated, and says which parts are not computed', () => {
    const boundary = strategy('convert-to-v-av').modelBoundary
    expect(boundary).toMatch(/not simulated/i)
    expect(boundary).toMatch(/one return limb/i)
    expect(boundary).toMatch(/how flow divides|split/i)
    expect(boundary).toMatch(/recirculation/i)
    expect(boundary).toMatch(/cannula interaction|balancing/i)
  })

  it('does not claim V-AV settles every differential-oxygenation case', () => {
    expect(strategy('convert-to-v-av').caution).toMatch(
      /does not automatically settle every case of differential oxygenation/i,
    )
    expect(corpus).not.toMatch(
      /V-AV[^.]{0,60}(?:solves|resolves|corrects|fixes)[^.]{0,40}differential/i,
    )
  })

  it('keeps upper-body arterial return and central V-A as separate entries', () => {
    const upper = strategy('upper-body-arterial-return')
    const central = strategy('central-va')
    expect(upper.id).not.toBe(central.id)
    expect(upper.name).toMatch(/upper body/i)
    expect(central.name).toMatch(/central V-A ECMO/i)
    expect(upper.mechanism).toMatch(/axillary/i)
    expect(upper.mechanism).toMatch(/subclavian/i)
    expect(upper.mechanism).toMatch(/brachiocephalic/i)
    expect(central.mechanism).toMatch(/ascending or proximal aorta/i)
    expect(central.mechanism).toMatch(/anterograde/i)
    // Never presented as interchangeable.
    expect(upper.doesNotChange).toMatch(/not central V-A ECMO and the two are not interchangeable/i)
    expect(corpus).not.toMatch(
      /(?:upper-body|axillary|subclavian|brachiocephalic)[^.]{0,60}(?:same as|equivalent to|interchangeable with)[^.]{0,30}central/i,
    )
  })

  it('places the coronary origin at the root in the upper-body caution, never at the arch', () => {
    const caution = strategy('upper-body-arterial-return').caution
    expect(caution).toMatch(/coronary arteries arise from the aortic root/i)
    expect(caution).toMatch(
      /does not establish which circulation is supplying the coronary arteries/i,
    )
    expect(caution).toMatch(/between the root and the arch branches/i)
    expect(caution).not.toMatch(/coronar\w*[^.]{0,80}aris\w+ from the (?:aortic )?arch/i)
  })

  it('never lets an improved right radial value stand for coronary oxygenation', () => {
    for (const id of ['upper-body-arterial-return', 'central-va'] as const) {
      expect(strategyText(id)).not.toMatch(
        /right radial[^.]{0,100}(?:guarantee|establishes|confirms|proves|assures)[^.]{0,60}coronar/i,
      )
    }
    expect(strategy('upper-body-arterial-return').caution).toMatch(
      /Improving a right radial or cerebral-zone value does not establish/i,
    )
    expect(strategyText('central-va')).toMatch(
      /may therefore not be represented by a right radial measurement/i,
    )
  })

  it('does not say central return removes every regional oxygenation question', () => {
    const central = strategy('central-va')
    expect(central.doesNotChange).toMatch(/does not remove every regional oxygenation question/i)
    expect(central.doesNotChange).toMatch(
      /proximal native-lung zone can still exist between the aortic valve and the site of the arterial return/i,
    )
    expect(corpus).not.toMatch(
      /central[^.]{0,60}(?:eliminates|removes|abolishes|ends)[^.]{0,40}dual circulation/i,
    )
    expect(corpus).not.toMatch(
      /central[^.]{0,80}(?:guarantees|ensures|assures)[^.]{0,40}coronary (?:oxygenation|supply)/i,
    )
  })

  it('frames raising femoral flow by mechanism, with both halves of the trade', () => {
    const flow = strategy('raise-femoral-circuit-flow')
    expect(flow.mechanism).toMatch(
      /moves the mixing point more proximally, back toward the ascending aorta and the aortic root/i,
    )
    expect(flow.mechanism).toMatch(/may therefore improve upper-body or cerebral oxygenation/i)
    expect(flow.caution).toMatch(/raises what the left ventricle must eject against/i)
    expect(flow.caution).toMatch(/distension/i)
    expect(flow.caution).toMatch(/pulmonary congestion/i)
    expect(flow.caution).toMatch(/stasis/i)
    expect(flow.caution).toMatch(/thrombosis/i)
    expect(flow.caution).toMatch(/neither uniformly beneficial nor uniformly harmful/i)
  })

  it('keeps raising flow distinct from the other four changes', () => {
    const flow = strategy('raise-femoral-circuit-flow')
    expect(flow.doesNotChange).toMatch(/does not improve the native-lung zone/i)
    expect(flow.doesNotChange).toMatch(/it is not V-AV/i)
    expect(flow.doesNotChange).toMatch(/not equivalent to relocating the arterial return/i)
  })

  it('distinguishes improving the native-lung zone from changing the cannulation topology', () => {
    const native = strategy('improve-native-lung-zone')
    expect(native.mechanism).toMatch(
      /oxygen content of the blood that passes through the native lungs/i,
    )
    expect(native.doesNotChange).toMatch(/does not change the cannulation topology/i)
    expect(native.doesNotChange).toMatch(
      /content of the native stream rather than the position of the mixing point/i,
    )
    // And it is not turned into a ventilator algorithm.
    expect(strategyText('improve-native-lung-zone')).not.toMatch(
      /PEEP|tidal volume|driving pressure|recruit/i,
    )
  })

  it('reads as five parallel options rather than an ordered escalation', () => {
    for (const detail of ['full', 'concise'] as const) {
      const text = renderCard(detail)
      expect(text).toContain('not five steps in an order')
      expect(text).not.toMatch(/first[- ]line|second[- ]line|next step|step one|escalat/i)
      expect(text).not.toMatch(/if that fails|failing that|only then/i)
      expect(text).not.toMatch(/(?:always|invariably) (?:prefer|choose|start with)/i)
    }
    for (const entry of VA_CONFIGURATION_STRATEGIES) {
      expect(strategyText(entry.id)).not.toMatch(/is (?:always|the) preferred/i)
    }
  })

  it('introduces no numeric target, dose, or timing cutoff', () => {
    for (const detail of ['full', 'concise'] as const) {
      const text = renderCard(detail)
      // The whole card is written without a number in it. A digit appearing here would be the first
      // sign that a flow target, a dose, or a timing cutoff had been added to a configuration card.
      expect(text).not.toMatch(/\d/)
      assertNoUniversalTargetLanguage(text)
    }
  })

  it('cites the dual-circulation and nomenclature sources, and every id resolves', () => {
    for (const detail of ['full', 'concise'] as const) {
      const { container, unmount } = render(<VaConfigurationStrategyCard detail={detail} />)
      const sources = container.querySelector('[data-configuration-card-sources]')
      // Both configuration sources are cited by resolved title; the registry id stays in the data
      // attribute and never in anything a learner reads.
      for (const id of ['elso-dual-circulation-2024', 'elso-maastricht-nomenclature-2019']) {
        const entry = sources?.querySelector(`[data-evidence-id="${id}"]`)
        expect(entry?.textContent).toContain(evidenceById.get(id)?.title)
        expect(sources?.textContent).not.toContain(id)
      }
      unmount()
    }
    for (const entry of VA_CONFIGURATION_STRATEGIES) {
      expect(entry.evidenceIds).toContain('elso-dual-circulation-2024')
      expect(entry.evidenceIds).toContain('elso-maastricht-nomenclature-2019')
      expect(validateEvidenceIds(entry.evidenceIds)).toBe(true)
    }
    for (const sectionId of ecmoVaOnlyFoundationSectionIds) {
      expect(validateEvidenceIds(ecmoFoundationLessonRuntimes[sectionId].evidenceIds)).toBe(true)
      expect(validateEvidenceIds(ecmoFoundationSectionById.get(sectionId)?.sourceIds ?? [])).toBe(
        true,
      )
    }
    // The two lessons that teach configuration cite the two configuration sources.
    for (const sectionId of ['va-parallel-physiology', 'va-integration-capstone'] as const) {
      expect(ecmoFoundationSectionById.get(sectionId)?.sourceIds).toContain(
        'elso-dual-circulation-2024',
      )
      expect(ecmoFoundationSectionById.get(sectionId)?.sourceIds).toContain(
        'elso-maastricht-nomenclature-2019',
      )
    }
  })

  it('separates the three kinds of change in the concise version', () => {
    const text = renderCard('concise')
    expect(text).toContain('Change what the native stream carries')
    expect(text).toContain('Change where the circuit gives blood back')
    expect(text).toContain('Change the relative femoral circuit flow')
    // And says these are responses rather than members of the differential above them.
    expect(text).toMatch(/responses to a mechanism, not explanations of one/i)
  })

  it('does not add the strategies as hypothesis columns', () => {
    const container = renderCapstone()
    const columns = [...container.querySelectorAll('[data-hypothesis-column]')].map((node) =>
      node.getAttribute('data-hypothesis-column'),
    )
    expect(columns).toEqual([
      'differential-oxygenation',
      'lv-distension',
      'membrane-dysfunction',
      'gas-side-interruption',
      'vasoplegia',
    ])
    for (const id of VA_CONFIGURATION_STRATEGIES.map((entry) => entry.id)) {
      expect(columns).not.toContain(id)
    }
  })
})

/* ------------------------------------------------------------------ *
 * Cannulated-limb ischemia, kept outside the matrix
 * ------------------------------------------------------------------ */

describe('cannulated-limb ischemia stays on the differential without widening the matrix', () => {
  it('titles the matrix as a selected list rather than a complete one', () => {
    const container = renderCapstone()
    const heading = container.querySelector('#va-hypothesis-matrix-heading')?.textContent ?? ''
    expect(heading).toBe(
      'Selected high-yield explanations for deterioration with unchanged displayed flow',
    )
    expect(container.querySelector('[data-matrix-not-exhaustive]')?.textContent ?? '').toMatch(
      /not a complete differential/i,
    )
  })

  it('keeps the explanation visible outside the matrix', () => {
    const container = renderCapstone()
    const card = container.querySelector(
      '[data-additional-va-hypothesis="cannulated-limb-ischemia"]',
    )
    expect(card).not.toBeNull()
    expect(card?.textContent ?? '').toContain(
      'Additional bedside-only explanation: cannulated-limb ischemia',
    )
    // Outside the table, not a sixth column inside it.
    expect(card?.closest('[data-hypothesis-matrix]')).toBeNull()
    expect(container.querySelectorAll('[data-hypothesis-column]')).toHaveLength(5)
    // And it keeps its matrix row, so it is still compared against the five.
    expect(container.querySelector('[data-matrix-row="cannulated-limb"]')).not.toBeNull()
  })

  it('says it may occur alone or alongside any of the listed mechanisms', () => {
    const card = renderCapstone().querySelector(
      '[data-additional-va-hypothesis="cannulated-limb-ischemia"]',
    )
    const coexist = card?.querySelector('[data-limb-coexists]')?.textContent ?? ''
    expect(coexist).toMatch(/the whole explanation .{0,40}on its own/i)
    expect(coexist).toMatch(/alongside any of the five/i)
    expect(coexist).toMatch(/It is not an alternative to them/i)
    // Never mutually exclusive with the listed mechanisms.
    expect(card?.textContent ?? '').not.toMatch(
      /(?:instead of|rather than|excludes)[^.]{0,40}(?:loading|distension|differential oxygenation|membrane|gas)/i,
    )
  })

  it('never lets a console reading or one probe value settle the limb', () => {
    const card = renderCapstone().querySelector(
      '[data-additional-va-hypothesis="cannulated-limb-ischemia"]',
    )
    const text = card?.textContent ?? ''
    expect(text).toMatch(/No signal on this console reliably substitutes for examining/i)
    expect(text).toMatch(/whatever limb-monitoring approach the program/i)
    expect(text).toMatch(/a single number from it neither establishes nor excludes/i)
    expect(text).toMatch(/An entirely unremarkable console does not exclude it/i)
    // Near-infrared monitoring is one approach among others, never a requirement.
    expect(text).not.toMatch(
      /(?:NIRS|near-infrared)[^.]{0,60}(?:is required|must be|is mandatory|is necessary)/i,
    )
  })

  it('shows the fixed-limb boundary where the explanation is read', () => {
    const card = renderCapstone().querySelector(
      '[data-additional-va-hypothesis="cannulated-limb-ischemia"]',
    )
    const boundary = card?.querySelector('[data-model-boundary]')?.textContent ?? ''
    expect(boundary).toMatch(/holds distal-limb perfusion and the near-infrared value fixed/i)
    expect(boundary).toMatch(/cannot demonstrate limb ischemia developing/i)
    expect(boundary).toMatch(
      /absence of a modeled change is therefore not evidence that limb perfusion is adequate/i,
    )
  })

  it('keeps the guided action that sends the learner to look at the limb', () => {
    const guided = ecmoFoundationLessonRuntimes['va-integration-capstone'].guidedActions.find(
      (action) => action.id === 'review-limb-and-bedside-findings',
    )
    expect(guided).toBeDefined()
    expect(guided?.label).toMatch(/cannulated limb/i)
    expect(guided?.description).toMatch(/limb distal to the arterial cannula/i)
  })

  it('keeps the matrix limitation about the fixed limb', () => {
    const limitation = renderCapstone().querySelector(
      '[data-model-limitation="limb-fixed-across-states"]',
    )
    expect(limitation).not.toBeNull()
    expect(limitation?.textContent ?? '').toMatch(
      /absence of a modeled change is not evidence that limb perfusion is adequate/i,
    )
  })
})
