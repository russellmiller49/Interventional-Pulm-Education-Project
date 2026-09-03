import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { ModelBoundary, styles, VA_MODELED_CONFIGURATION } from './shared'

/**
 * How VA configuration changes the physiology, taught once and rendered in two densities.
 *
 * The live simulation is one topology: peripheral femoral V-A ECMO with retrograde arterial return.
 * A learner who only ever sees that topology carries two wrong generalizations out of it — that "VA
 * ECMO" names a single flow path, and that the only lever on a regional oxygenation problem is how
 * much femoral flow the pump is asked for. Both are addressed here by naming five different things
 * that can change, saying what each one changes and what it does not, and marking every one of them
 * that this simulation cannot show.
 *
 * Two rules this card is written to keep.
 *
 * It is not a treatment algorithm. There is no order, no preference, no flow target, no dose and no
 * timing cutoff, because none of those follow from the sources cited: a position paper on physiology
 * and nomenclature fixes what a configuration *is* and what follows mechanically from it, not what
 * to do next in a given patient. Each entry therefore ends in a mechanism and a caution rather than
 * in an instruction.
 *
 * And every entry states its own model boundary. Four of the five are described rather than
 * simulated, and the fifth — raising femoral circuit flow — has a *direction* this simulation does
 * not compute either, because the two arterial saturations are authored by the loaded case rather
 * than derived from a mixing position. Saying so beside the mechanism is the difference between
 * teaching the physiology and implying the learner can watch it here.
 *
 * The content is exported as data so the clinical-copy guards can assert against individual
 * strategies rather than against a page-wide string, and so the concise version cannot drift from
 * the full one: both render the same records.
 */

/** The two densities. The full account belongs where the mechanism has just been taught. */
export type VaConfigurationCardDetail = 'full' | 'concise'

export type VaConfigurationStrategyId =
  | 'improve-native-lung-zone'
  | 'convert-to-v-av'
  | 'upper-body-arterial-return'
  | 'central-va'
  | 'raise-femoral-circuit-flow'

/**
 * What a strategy actually changes.
 *
 * Three classes, because that is the distinction the capstone needs in one line: a change to what
 * the native stream carries, a change to where the circuit gives blood back, and a change to how
 * much femoral flow is being run relative to native output. Collapsing them is how "raise the flow"
 * comes to be treated as interchangeable with the other four.
 */
export type VaConfigurationChangeClass =
  | 'native-stream-content'
  | 'return-topology'
  | 'relative-femoral-flow'

export interface VaConfigurationStrategy {
  readonly id: VaConfigurationStrategyId
  readonly name: string
  readonly changeClass: VaConfigurationChangeClass
  /** The mechanism: what moves, and why that matters for who gets which blood. */
  readonly mechanism: string
  /** The distinction that keeps the five apart rather than letting them read as one lever. */
  readonly doesNotChange: string
  /** The caution that has to travel with it. Never a prohibition, never an endorsement. */
  readonly caution: string
  /** Where this simulation stops on this entry. */
  readonly modelBoundary: string
  readonly evidenceIds: readonly string[]
}

const DUAL_CIRCULATION_SOURCES = [
  'elso-dual-circulation-2024',
  'elso-maastricht-nomenclature-2019',
] as const

/**
 * The intro boundary, stated before any alternative is named.
 *
 * Deliberately the first thing in the card: an alternative topology read without it is an invitation
 * to carry a conclusion drawn on this simulation into a configuration whose blood travels the other
 * way.
 */
export const VA_CONFIGURATION_CARD_BOUNDARY = `The live model on this page represents ${VA_MODELED_CONFIGURATION}. The alternatives below change the topology of support but are described rather than simulated.`

/** The one-line version for the diagram that shows the modeled topology. */
export const VA_CONFIGURATION_DIAGRAM_NOTE =
  'This diagram shows peripheral femoral V-A ECMO. V-AV, upper-body arterial return, and central return create different flow paths.'

export const VA_CONFIGURATION_STRATEGIES: readonly VaConfigurationStrategy[] = [
  {
    id: 'improve-native-lung-zone',
    name: 'Improve the native-lung zone',
    changeClass: 'native-stream-content',
    mechanism:
      'Acts on the oxygen content of the blood that passes through the native lungs and is then ejected by the left ventricle. Whatever beds that native stream reaches — the aortic root and, depending on where the two streams meet, the arch branches — receive better oxygenated blood without anything about the cannulation having changed.',
    doesNotChange:
      'It does not change the cannulation topology and it does not move where the two streams meet. It addresses the content of the native stream rather than the position of the mixing point.',
    caution:
      'What can be done for the native lungs, and whether anything can be, is a judgement about that patient made by the treating team under local practice. This entry names the term of the problem the change acts on, not a ventilator strategy and no value to reach.',
    modelBoundary:
      'Not available as a manoeuvre here. This simulation authors the two arterial saturations from the loaded case rather than deriving them from what the native lungs are doing, so native-lung recovery cannot be applied and watched.',
    evidenceIds: [...DUAL_CIRCULATION_SOURCES, 'elso-adult-va-2021'],
  },
  {
    id: 'convert-to-v-av',
    name: 'Convert to V-AV ECMO',
    changeClass: 'native-stream-content',
    mechanism:
      'V-AV ECMO: venous drainage with both arterial and venous return limbs. A post-membrane venous return limb sends oxygenated blood to the right heart; that blood traverses the pulmonary circulation and can raise the oxygen content of what the left ventricle ejects next, while the arterial return limb goes on providing circulatory support. It therefore changes the content of the native-ejection zone rather than only moving a femoral retrograde mixing point.',
    doesNotChange:
      'It is not a larger femoral arterial flow. The arterial limb is still there; what is added is a second return, on the venous side, whose blood reaches the arterial circulation by way of the lungs and the left heart.',
    caution:
      'It does not automatically settle every case of differential oxygenation. The two return limbs have to be balanced against each other, and the benefit to the native-ejection zone depends on that blood actually crossing the pulmonary circulation and being ejected.',
    modelBoundary:
      'Not simulated. This simulation has one return limb: it does not compute how flow divides between an arterial and a venous return, does not model recirculation between a venous return limb and the drainage cannula, and does not model cannula interaction or the balancing of two return limbs.',
    evidenceIds: [...DUAL_CIRCULATION_SOURCES, 'elso-adult-va-2021'],
  },
  {
    id: 'upper-body-arterial-return',
    name: 'Relocate the arterial return to the upper body',
    changeClass: 'return-topology',
    mechanism:
      'Membrane-lung blood is given back to the arterial system more proximally — axillary, subclavian or brachiocephalic arterial return, according to the terminology of the configuration — so it is delivered into or nearer the upper-body arterial circulation instead of travelling retrograde up the aorta from a femoral cannula. That changes the mixing topology itself and can improve upper-body and cerebral supply.',
    doesNotChange:
      'It is not central V-A ECMO and the two are not interchangeable: the return still enters a branch vessel rather than the aorta itself, and the resulting flow path is its own.',
    caution:
      'Improving a right radial or cerebral-zone value does not establish which circulation is supplying the coronary arteries. The coronary arteries arise from the aortic root, and the mixing point can lie between the root and the arch branches.',
    modelBoundary:
      'Described, not simulated. This simulation returns blood from one femoral arterial cannula, so no upper-body return path exists in it to load and read.',
    evidenceIds: [...DUAL_CIRCULATION_SOURCES, 'elso-neuro-monitoring-2024'],
  },
  {
    id: 'central-va',
    name: 'Central V-A ECMO',
    changeClass: 'return-topology',
    mechanism:
      'Arterial return is placed centrally, typically into the ascending or proximal aorta according to the surgical configuration, so it is predominantly anterograde rather than retrograde from a femoral artery. That substantially changes the dual-circulation topology: circuit blood and native ejection no longer travel toward each other along the aorta.',
    doesNotChange:
      'It does not remove every regional oxygenation question. When the left ventricle ejects poorly oxygenated blood, a proximal native-lung zone can still exist between the aortic valve and the site of the arterial return.',
    caution:
      'The aortic-root and coronary region may therefore not be represented by a right radial measurement here either. Central return changes where the streams meet; it does not by itself establish what the coronary circulation is receiving.',
    modelBoundary:
      'Described, not simulated. Nothing in this simulation places the return centrally, so the anterograde topology cannot be loaded and read.',
    evidenceIds: [...DUAL_CIRCULATION_SOURCES, 'elso-adult-va-2021'],
  },
  {
    id: 'raise-femoral-circuit-flow',
    name: 'Increase femoral V-A circuit flow',
    changeClass: 'relative-femoral-flow',
    mechanism:
      'Raising circuit flow relative to native output moves the mixing point more proximally, back toward the ascending aorta and the aortic root. It may therefore improve upper-body or cerebral oxygenation for a time, because more of the arch territory comes to be filled by membrane blood.',
    doesNotChange:
      'It changes where two streams meet and not what either of them carries. It does not improve the native-lung zone, it is not V-AV, and it is not equivalent to relocating the arterial return: none of the oxygen content of the native stream has changed.',
    caution:
      'The same action raises what the left ventricle must eject against. It can reduce native ejection and worsen distension, pulmonary congestion, stasis and the risk of intracardiac thrombosis, so it can relieve one regional oxygenation problem while deepening the loading problem underneath it. Whether that trade is the right one depends on the mechanism established at the bedside; it is neither uniformly beneficial nor uniformly harmful.',
    modelBoundary:
      'The direction is described rather than modeled. This simulation does not compute where the two streams meet, so raising the pump speed here will not move the two arterial saturations on screen.',
    evidenceIds: [...DUAL_CIRCULATION_SOURCES, 'elso-adult-va-2021', 'ecmo-book-ch17'],
  },
]

interface ChangeClassCopy {
  readonly label: string
  readonly summary: string
}

/**
 * The three classes, for the concise version.
 *
 * The capstone needs the distinction and not the whole card: a learner working a differential has to
 * know that these are responses of three different kinds, and that none of them is a cause of the
 * deterioration they are trying to name.
 */
export const VA_CONFIGURATION_CHANGE_CLASSES: Readonly<
  Record<VaConfigurationChangeClass, ChangeClassCopy>
> = {
  'native-stream-content': {
    label: 'Change what the native stream carries',
    summary:
      'Raise the oxygen content of the blood the left ventricle ejects, either by improving the native-lung zone or by adding a venous return limb so that oxygenated blood reaches the right heart and crosses the lungs.',
  },
  'return-topology': {
    label: 'Change where the circuit gives blood back',
    summary:
      'Move the arterial return, to the upper body or centrally, so membrane blood enters the arterial system somewhere else. This changes the flow path itself rather than the amount of support.',
  },
  'relative-femoral-flow': {
    label: 'Change the relative femoral circuit flow',
    summary:
      'Run more or less femoral circuit flow relative to native output. This moves the mixing point without changing what either stream carries, and it moves left ventricular loading at the same time.',
  },
}

const CHANGE_CLASS_ORDER: readonly VaConfigurationChangeClass[] = [
  'native-stream-content',
  'return-topology',
  'relative-femoral-flow',
]

export function vaConfigurationStrategiesByClass(
  changeClass: VaConfigurationChangeClass,
): readonly VaConfigurationStrategy[] {
  return VA_CONFIGURATION_STRATEGIES.filter((strategy) => strategy.changeClass === changeClass)
}

const NOT_AN_ALGORITHM =
  'These are five different things to change, not five steps in an order. Nothing here says which one is preferred, when a change should be made, or what value to reach: that depends on the patient, on the mechanism that has actually been established, and on the practice of the program looking after them.'

const CARD_SOURCES = [
  'elso-dual-circulation-2024',
  'elso-maastricht-nomenclature-2019',
  'elso-adult-va-2021',
] as const

/**
 * The heading level the card renders at.
 *
 * Both hosts render it inside a panel whose own headings are level 3, so the default keeps one
 * document outline rather than restarting it inside a card.
 */
type HeadingLevel = 3 | 4

export function VaConfigurationStrategyCard({
  detail = 'full',
  headingLevel = 3,
}: {
  readonly detail?: VaConfigurationCardDetail
  readonly headingLevel?: HeadingLevel
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h4'
  const headingId = `va-configuration-strategies-${detail}`

  if (detail === 'concise') {
    return (
      <section
        className={styles.section}
        aria-labelledby={headingId}
        data-va-configuration-card="concise"
      >
        <Heading id={headingId} className={styles.heading}>
          How configuration can change the problem
        </Heading>
        <p className="mt-2 text-sm leading-6" data-configuration-card-boundary>
          {VA_CONFIGURATION_CARD_BOUNDARY}
        </p>
        <p className="mt-2 text-sm leading-6">
          These are responses to a mechanism, not explanations of one. None of them belongs in the
          differential above: they are things that can be changed once the mechanism in front of you
          has been named. They divide into three kinds, and the three are not interchangeable.
        </p>

        <dl className="mt-3 grid gap-3">
          {CHANGE_CLASS_ORDER.map((changeClass) => {
            const copy = VA_CONFIGURATION_CHANGE_CLASSES[changeClass]
            const strategies = vaConfigurationStrategiesByClass(changeClass)
            return (
              <div
                key={changeClass}
                className="rounded-xl border p-3"
                data-configuration-change-class={changeClass}
              >
                <dt className="text-sm font-semibold">{copy.label}</dt>
                <dd className="mt-1 text-sm leading-6">{copy.summary}</dd>
                <dd className="mt-1 text-sm leading-6">
                  <span className="font-semibold">In this class: </span>
                  {strategies.map((strategy) => strategy.name).join('; ')}.
                </dd>
              </div>
            )
          })}
        </dl>

        <p className="mt-3 text-sm leading-6" data-configuration-flow-tradeoff>
          The third kind is the one most easily reached for, and the one that carries a cost on
          another axis. Raising femoral circuit flow relative to native output moves the mixing
          point more proximally, back toward the aortic root, so it can improve upper-body or
          cerebral oxygenation for a time — while raising what the left ventricle must eject
          against, which can reduce native ejection and worsen distension, pulmonary congestion and
          stasis. It is not a way of improving the native-lung zone, and it is not V-AV.
        </p>

        <p className="mt-3 text-sm leading-6">{NOT_AN_ALGORITHM}</p>

        <ModelBoundary>
          V-AV, upper-body arterial return and central V-A ECMO are described here and are not
          simulated: this simulation carries one return limb, in one femoral artery, and computes no
          split between two returns and no recirculation between a venous return and the drainage
          cannula. The mixing point does not move here either — the two arterial saturations are
          authored by the loaded case rather than derived from native ejection and circuit flow. The
          full account of all five, with the caution that belongs to each, is in the
          parallel-physiology section of this track.
        </ModelBoundary>

        <div className="mt-3" data-configuration-card-sources>
          <EcmoSourceList compact evidenceIds={CARD_SOURCES} />
        </div>
      </section>
    )
  }

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      data-va-configuration-card="full"
    >
      <Heading id={headingId} className={styles.heading}>
        Configuration changes the physiology
      </Heading>
      <p className="mt-2 text-sm leading-6" data-configuration-card-boundary>
        {VA_CONFIGURATION_CARD_BOUNDARY}
      </p>
      <p className="mt-2 text-sm leading-6">
        Everything above this point is a consequence of two streams meeting inside one aorta. That
        meeting is a property of the configuration rather than of venoarterial support in general,
        so the same reasoning reaches different answers when the blood is given back somewhere else.
        Each entry below names what changes, what it leaves alone, the caution that goes with it,
        and where this simulation stops.
      </p>

      <dl className="mt-3 grid gap-3">
        {VA_CONFIGURATION_STRATEGIES.map((strategy) => (
          <div
            key={strategy.id}
            className="rounded-xl border p-3"
            data-va-configuration-strategy={strategy.id}
            data-configuration-change-class={strategy.changeClass}
          >
            {/*
              A term, not a heading: the content model of `dt` excludes heading content, and the
              card is a definition list rather than a set of subsections. The class label is shown as
              words beside it so the grouping is never carried by position or colour alone.
            */}
            <dt>
              <span className="block text-sm font-semibold">{strategy.name}</span>
              <span className="mt-1 block text-xs uppercase tracking-wide text-muted-foreground">
                {VA_CONFIGURATION_CHANGE_CLASSES[strategy.changeClass].label}
              </span>
            </dt>
            <dd className="mt-2 text-sm leading-6" data-configuration-mechanism>
              <span className="font-semibold">What changes. </span>
              {strategy.mechanism}
            </dd>
            <dd className="mt-1 text-sm leading-6" data-configuration-distinction>
              <span className="font-semibold">What it does not change. </span>
              {strategy.doesNotChange}
            </dd>
            <dd className="mt-1 text-sm leading-6" data-configuration-caution>
              <span className="font-semibold">Caution. </span>
              {strategy.caution}
            </dd>
            <dd
              className="mt-1 rounded-xl border border-dashed px-3 py-2 text-xs leading-5"
              data-configuration-model-boundary
            >
              <span className="font-semibold">Model boundary. </span>
              {strategy.modelBoundary}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-sm leading-6" data-configuration-not-an-algorithm>
        {NOT_AN_ALGORITHM}
      </p>

      <ModelBoundary>
        One of these five is available on this page and four are not. Femoral circuit flow can be
        changed here, but even for that one the mixing point does not move: this simulation authors
        the upper-body and lower-body saturations from the loaded case rather than computing where
        native and circuit blood meet. V-AV, upper-body arterial return and central V-A ECMO have no
        representation in it at all — there is one return limb, in one femoral artery, and no split
        between two returns, no cannula interaction and no V-AV recirculation is computed. Read the
        four described entries as physiology to carry to a different configuration, not as states
        you can load and check.
      </ModelBoundary>

      <div className="mt-3" data-configuration-card-sources>
        <EcmoSourceList compact evidenceIds={CARD_SOURCES} />
      </div>
    </section>
  )
}
