import { mcsCommonModelQuestions } from '../../content/commonModel'
import {
  MCS_MODEL_BOUNDARY_REFERENCES,
  mcsDerivedValueGuides,
} from '../../content/derivedValueGuides'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  MCS_UNMODELED_ORGAN_SIGNALS,
  activeAlarms,
  activePathways,
  beforeAfterReadings,
  fillingProfileView,
  flowAccountView,
  impellaView,
  reading,
} from './selectors'
import {
  AlarmBand,
  BeforeAfter,
  DEADBAND_CAPTION,
  FigureScope,
  FlowAccount,
  GuidedValue,
  LiveSetting,
  LiveValue,
  ModelBoundary,
  PanelSection,
  TextEquivalent,
  TransferState,
  alarmSentence,
  beforeAfterSentence,
  flowAccountSentence,
  pathwaySentence,
  styles,
} from './shared'

/**
 * Section 9 — the seven questions, answered from the live state, before any device is named.
 *
 * The figure is the common model's own question list with a live answer beside each one, and its
 * most important rows are the ones the simulation cannot answer. Question one asks about gas
 * exchange, which this engine does not model a failure of; question seven asks what would define
 * success, and every finding that would is in the unmodeled column. Filling in those rows with a
 * confident-looking value would turn a reasoning aid into a decision rule, which is exactly the
 * error the section exists to prevent.
 *
 * Nothing here recommends a device. The phenotype row reads a relationship between two pressures the
 * engine already produced, states it as a reading, and prints the questions that relationship cannot
 * settle immediately beneath it.
 */

const questions = mcsCommonModelQuestions

export function DeviceSelectionIntegrationPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const metrics = state.metrics
  const account = flowAccountView(state)
  const profile = fillingProfileView(state)
  const pathways = activePathways(state)
  const pump = impellaView(state)
  const alarms = activeAlarms(state)
  const rows = beforeAfterReadings(
    [
      {
        metric: 'rapMmHg',
        label: 'Right atrial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      { metric: 'pcwpMmHg', label: 'Wedge pressure', unit: 'mm Hg', digits: 0, kind: 'modeled' },
      {
        metric: 'leftDeviceFlowLMin',
        label: 'Displayed pump flow',
        unit: 'L/min',
        kind: 'estimated',
      },
      {
        metric: 'effectiveSystemicFlowLMin',
        label: 'Effective systemic delivery',
        unit: 'L/min',
        kind: 'reasoned',
      },
      {
        metric: 'mapMmHg',
        label: 'Mean arterial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      {
        metric: 'svo2Percent',
        label: 'Mixed venous saturation',
        unit: '%',
        digits: 0,
        kind: 'modeled',
      },
    ],
    beforeMetrics,
    metrics,
  )

  const answers: Readonly<Record<string, { readonly answer: string; readonly limit: string }>> = {
    'mcs.model.q1-dominant-problem': {
      answer: `${profile.statement} Right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg against a wedge pressure of ${reading(metrics.pcwpMmHg, 0)} mm Hg.`,
      limit:
        'This simulation models no gas-exchange failure state, so whether oxygenation or carbon dioxide clearance is part of the dominant problem is not established here at all. The fixed arterial saturation this simulation carries is a model constant, not evidence that oxygenation support is unnecessary.',
    },
    'mcs.model.q2-source-and-destination': {
      answer: pathways.map((pathway) => `${pathway.source} → ${pathway.destination}`).join('; '),
      limit:
        'The pathway on screen is the one currently in place. It is not a proposal, and the route a device would be inserted along is not drawn.',
    },
    'mcs.model.q3-mechanism-class': {
      answer: pathways.map((pathway) => pathway.relationshipLabel).join('; '),
      limit:
        'Timing, direct pumping and an extracorporeal pathway are three different kinds of thing. This module simulates the first two and describes the third.',
    },
    'mcs.model.q4-chamber-unloaded': {
      answer: `${pathways.map((pathway) => pathway.chamberUnloaded).join('; ')}. End-diastolic volume ${reading(metrics.lvedvMl, 0)} mL, wedge ${reading(metrics.pcwpMmHg, 0)} mm Hg, aortic valve ${metrics.aorticValveOpening ? 'opening' : 'not opening'}.`,
      limit:
        'End-diastolic volume here is an educational surrogate rather than a traced volume, so read it as a direction.',
    },
    'mcs.model.q5-chamber-or-bed-loaded': {
      answer: `${pathways.map((pathway) => pathway.chamberOrBedLoaded).join('; ')}. Right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg.`,
      limit:
        'A chamber that is being loaded is not always the one alarming. The consequence can appear on the other side of the circulation from the device.',
    },
    'mcs.model.q6-what-limits-performance': {
      answer: `Preload ${reading(state.patient.preloadPercent, 0)}% of reference · afterload: systemic vascular resistance ${reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵, pulmonary vascular resistance ${reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units · rhythm ${state.patient.rhythm} · position ${pump ? pump.leftPositionWords : 'not applicable on this pathway'} · obstruction: ${state.patient.tamponade ? 'modeled tamponade present' : 'no modeled obstruction'} · ventricular interaction: right ventricular contractility ${reading(state.patient.rightVentricularContractility, 2)} against left ${reading(state.patient.leftVentricularContractility, 2)} · gas exchange: not modeled.`,
      limit:
        'Seven constraints, and the model represents six of them. Gas exchange is the one it does not, so it cannot be ruled in or out from anything on this screen.',
    },
    'mcs.model.q7-what-defines-success': {
      answer: `Not answerable from this simulation. The findings that would define success — ${MCS_UNMODELED_ORGAN_SIGNALS.map((signal) => signal.label.toLowerCase()).join(', ')} — are not modeled here.`,
      limit:
        'Stating what success would look like before a setting is changed is the step this simulation can prompt and cannot perform. It belongs to the bedside and to the responsible team.',
    },
  }

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="The phenotype these two pressures point at" id="integration-phenotype">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveValue
            label="Right atrial pressure"
            value={metrics.rapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
          />
          <LiveValue
            label="Wedge pressure"
            value={metrics.pcwpMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
          />
          <LiveSetting
            label="What the relationship reads as"
            value={
              profile.dominant === 'not-resolved'
                ? 'not resolved by these two pressures'
                : profile.dominant.replace('-', ' ')
            }
            kind="reasoned"
            note={profile.statement}
          />
          <LiveValue
            label="Mean arterial pressure"
            value={metrics.mapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
          />
        </div>
        <p className="mt-3 text-xs leading-5" data-phenotype-limit>
          Filling pressures support phenotype reasoning. They do not select a device. Local
          expertise, vascular access and anatomy, contraindications, the expected duration of
          support, whether gas exchange is part of the problem, and the patient&rsquo;s own goals
          all sit outside anything two numbers can produce — and none of them is on this screen.
        </p>
        <TextEquivalent>
          Right atrial pressure {reading(metrics.rapMmHg, 0)} mm Hg and wedge pressure{' '}
          {reading(metrics.pcwpMmHg, 0)} mm Hg. {profile.statement} Mean arterial pressure is{' '}
          {reading(metrics.mapMmHg, 0)} mm Hg. This reading is a relationship between two pressures,
          not a device recommendation.
        </TextEquivalent>
        <ModelBoundary>
          The classification above is a statement about the relationship between two modeled
          pressures and has an explicit unresolved branch, because a profile that does not separate
          the two sides is a real answer. No number on this panel produces a device.
        </ModelBoundary>
        <FigureScope
          establishes="Which relationship the two filling pressures currently show, and which of the seven questions the live state can and cannot answer."
          doesNotEstablish="Which device this patient should receive. Temporary and durable support remain different decisions in kind, and neither follows from a reading."
        />
      </PanelSection>

      <PanelSection
        title="The seven questions, answered from this state"
        id="integration-questions"
      >
        <div className={styles.scroller}>
          <table className={`${styles.table} min-w-[34rem]`} data-common-model-answers>
            <caption className="text-left text-xs leading-5 text-muted-foreground">
              Each of the seven questions with what this state can say about it and what it cannot.
              The last column is not a caveat; on two of these rows it is the whole answer.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Question
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  From this state
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  What this state cannot say
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id} data-common-model-question={question.id}>
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    {question.order}. {question.question}
                  </th>
                  <td className="py-1 pr-3 align-top" data-question-answer>
                    {answers[question.id]?.answer ?? 'not answerable from this state'}
                  </td>
                  <td className="py-1 align-top" data-question-limit>
                    {answers[question.id]?.limit ?? question.whyItMatters}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TextEquivalent>
          {questions
            .map(
              (question) =>
                `Question ${question.order}, ${question.question} From this state: ${answers[question.id]?.answer ?? 'not answerable'}`,
            )
            .join(' ')}
        </TextEquivalent>
        <ModelBoundary>
          Two rows are deliberately empty of a value. This simulation models no gas-exchange failure
          state, and it models no organ-level response, so the question about gas exchange and the
          question about what would define success are answered by naming what is missing rather
          than by a number.
        </ModelBoundary>
      </PanelSection>

      <PanelSection title="The flow account behind those answers" id="integration-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>
          {pathways.map((pathway) => pathwaySentence(pathway)).join(' ')}{' '}
          {flowAccountSentence(account, disclosed)}
        </TextEquivalent>
        <AlarmBand alarms={alarms} />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
      </PanelSection>

      <PanelSection title="The two interpreted values, with their sourcing" id="integration-guides">
        <GuidedValue
          guide={mcsDerivedValueGuides.cardiacPowerOutputW}
          value={metrics.cardiacPowerOutputW}
        />
        <GuidedValue
          guide={mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex}
          value={metrics.papi}
        />
        <p className="mt-3 text-xs leading-5" data-papi-limitation>
          <span className="font-semibold">A limit of this model. </span>
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.statement}{' '}
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.appliesWhen} The pulmonary pulsatility
          ratio moves only weakly with right-sided support here, and mostly through right atrial
          pressure, so it must not be used on its own to judge whether right-sided support is
          working — and no single number on this panel, this one included, produces a device.
        </p>
        <TextEquivalent>
          Cardiac power {reading(metrics.cardiacPowerOutputW, 2)} W and pulmonary pulsatility ratio{' '}
          {reading(metrics.papi, 1)}, both shown with the cohort observations they come from.
          Neither is a treatment target and neither selects a device.
        </TextEquivalent>
      </PanelSection>

      <PanelSection title="Bridge, exit, and the decision this is not" id="integration-strategy">
        <ul className="mt-3 grid gap-2 text-xs leading-5" data-strategy-boundaries>
          <li data-strategy="temporary-versus-durable">
            <span className="font-semibold">
              Temporary and durable support are different decisions.{' '}
            </span>
            A durable pump is not a longer temporary one: candidacy evaluation, implantation,
            anticoagulation, driveline care and an agreed strategy are settled before it begins.
          </li>
          <li data-strategy="bridge-and-exit">
            <span className="font-semibold">The exit question starts with the support. </span>
            Recovery, escalation to a pathway that also supports the right heart or gas exchange,
            durable support, or transplant evaluation — one of those is being waited for from the
            first hour, and the expected duration is itself a selection criterion.
          </li>
          <li data-strategy="outside-the-numbers">
            <span className="font-semibold">What no reading on this screen contains. </span>Local
            expertise and programme availability, vascular access and anatomy, contraindications,
            whether gas exchange is part of the problem, and the patient&rsquo;s goals of care.
          </li>
        </ul>
        <TextEquivalent>
          Temporary and durable support are different decisions in kind. An exit strategy is
          explicit from the start. Local expertise, access and anatomy, contraindications, gas
          exchange and the patient&rsquo;s goals sit outside every number on this screen.
        </TextEquivalent>
      </PanelSection>

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the escalation, and now" id="integration-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="The filling pressures the phenotype was read from, and what the added support changed."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="integration-transfer">
          <TransferState principle="Name the limiting problem before naming a device. The relationship between the two filling pressures is where that naming starts, and no single number on any screen finishes it.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveValue
                label="Right atrial pressure"
                value={metrics.rapMmHg}
                unit="mm Hg"
                digits={0}
                kind="modeled"
              />
              <LiveValue
                label="Wedge pressure"
                value={metrics.pcwpMmHg}
                unit="mm Hg"
                digits={0}
                kind="modeled"
              />
              <LiveSetting
                label="What the relationship reads as"
                value={
                  profile.dominant === 'not-resolved'
                    ? 'not resolved by these two pressures'
                    : profile.dominant.replace('-', ' ')
                }
                kind="reasoned"
                note={profile.statement}
              />
              <LiveValue
                label="Pulmonary pulsatility ratio"
                value={metrics.papi}
                unit=""
                kind="derived"
              />
            </div>
            <FlowAccount account={account} disclosed={disclosed} />
            <TextEquivalent>
              In the transfer patient: right atrial pressure {reading(metrics.rapMmHg, 0)} mm Hg,
              wedge pressure {reading(metrics.pcwpMmHg, 0)} mm Hg, pulmonary pulsatility ratio{' '}
              {reading(metrics.papi, 1)}. {profile.statement}{' '}
              {flowAccountSentence(account, disclosed)}
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
