import { mcsCommonModelQuestions } from '../../content/commonModel'
import { mcsClinicalSourceKindLabels, mcsCongestionSource } from '../../content/congestionEvidence'
import {
  MCS_ACC_CONGESTION_FRAMEWORK,
  MCS_COMPLETE_PROFILE_BOUNDARY,
  MCS_COMPLETE_PROFILE_COMPONENTS,
  MCS_CONGESTION_PATTERN_BOUNDARY,
  MCS_ORTEGA_COHORT_CUTOFFS,
  MCS_ORTEGA_CONGESTION_FRAMEWORK,
  MCS_RAP_PCWP_RATIO_CONTEXT,
  mcsCongestionProfileDefinition,
} from '../../content/congestionProfile'
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
  congestionProfileView,
  flowAccountView,
  impellaView,
  reading,
} from './selectors'
import {
  AfterCommitment,
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
 * Nothing here recommends a device. The congestion row reads two pressures the engine already
 * produced against a named, cited framework, states the result as a pattern rather than as a
 * diagnosis, and prints what that pattern cannot settle immediately beneath it. The framework is the
 * ACC 2025 consensus description; the four-cell grid built from its prose is labelled everywhere as
 * an educational operationalization, because the consensus statement published a description and not
 * this software.
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
  const congestion = congestionProfileView(state)
  const accSource = mcsCongestionSource(MCS_ACC_CONGESTION_FRAMEWORK.sourceIds[0])
  const ortegaSource = mcsCongestionSource(MCS_ORTEGA_CONGESTION_FRAMEWORK.sourceIds[0])
  const garanSource = mcsCongestionSource(MCS_COMPLETE_PROFILE_BOUNDARY.sourceId)
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
      answer: `Filling pressures identify a ${congestion.label.toLowerCase()}. The dominant shock mechanism is not fully determined by these two pressures. Right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg against a wedge pressure of ${reading(metrics.pcwpMmHg, 0)} mm Hg.`,
      limit:
        'A congestion pattern says where filling pressures are elevated; it does not name the cause of shock. This simulation also models no gas-exchange failure state, so whether oxygenation or carbon dioxide clearance is part of the dominant problem is not established here at all. The fixed arterial saturation this simulation carries is a model constant, not evidence that oxygenation support is unnecessary.',
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
      answer: `Preload ${reading(state.patient.preloadPercent, 0)}% of reference · afterload: systemic vascular resistance ${reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵, pulmonary vascular resistance ${reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units · rhythm ${state.patient.rhythm} · modeled device position ${pump ? pump.leftPositionWords : 'not applicable on this pathway'} · tamponade: ${state.patient.tamponade ? 'modeled present' : 'modeled not present'} · ventricular interaction: right ventricular contractility ${reading(state.patient.rightVentricularContractility, 2)} against left ${reading(state.patient.leftVentricularContractility, 2)} · gas exchange: not modeled.`,
      limit:
        'Tamponade is the one obstructive state this simulation carries. Inflow obstruction, outflow obstruction, and device-path malposition beyond the modeled position state are not comprehensively modeled here, so none of them has been examined or excluded. Gas exchange is not modeled at all and cannot be ruled in or out from anything on this screen.',
    },
    'mcs.model.q7-what-defines-success': {
      answer: `Not answerable from this simulation. The findings that would define success — ${MCS_UNMODELED_ORGAN_SIGNALS.map((signal) => signal.label.toLowerCase()).join(', ')} — are not modeled here.`,
      limit:
        'Stating what success would look like before a setting is changed is the step this simulation can prompt and cannot perform. It belongs to the bedside and to the responsible team.',
    },
  }

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="Filling-pressure congestion pattern" id="integration-congestion">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveValue
            label="Right atrial pressure"
            value={metrics.rapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
            note={
              congestion.rapElevated
                ? `Above the ${congestion.thresholdMmHg} mm Hg the consensus statement describes.`
                : `Not above the ${congestion.thresholdMmHg} mm Hg the consensus statement describes.`
            }
          />
          <LiveValue
            label="Wedge pressure"
            value={metrics.pcwpMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
            note={
              congestion.pcwpElevated
                ? `Above the ${congestion.thresholdMmHg} mm Hg the consensus statement describes.`
                : `Not above the ${congestion.thresholdMmHg} mm Hg the consensus statement describes.`
            }
          />
          <LiveSetting
            label="Congestion pattern"
            value={congestion.label}
            kind="reasoned"
            note={congestion.statement}
          />
          <LiveValue
            label="Mean arterial pressure"
            value={metrics.mapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
          />
        </div>

        <p className="mt-3 text-sm leading-6" data-congestion-reading>
          RAP is {reading(metrics.rapMmHg, 0)} mm Hg and PCWP is {reading(metrics.pcwpMmHg, 0)} mm
          Hg. Under the ACC consensus–described filling-pressure framework, this is consistent with
          a {congestion.label.toLowerCase()}.
        </p>

        <dl
          className="mt-3 grid gap-1 text-xs leading-5"
          data-congestion-framework={congestion.frameworkId}
        >
          <div>
            <dt className="font-semibold">Framework</dt>
            <dd data-framework-label>{congestion.frameworkLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold">Threshold it uses</dt>
            <dd>{MCS_ACC_CONGESTION_FRAMEWORK.thresholdSummary} Above, not at.</dd>
          </div>
          <div>
            <dt className="font-semibold">Source type</dt>
            <dd data-source-kind={accSource.kind}>{mcsClinicalSourceKindLabels[accSource.kind]}</dd>
          </div>
          <div>
            <dt className="font-semibold">Source</dt>
            <dd>
              {accSource.citation} {accSource.locator}.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Evidence</dt>
            <dd data-evidence-ids>{accSource.id}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs leading-5" data-congestion-operationalization>
          <span className="font-semibold">How this grid was built. </span>
          {MCS_ACC_CONGESTION_FRAMEWORK.operationalizationNote}
        </p>

        <p className="mt-3 text-xs leading-5" data-congestion-limit>
          {MCS_CONGESTION_PATTERN_BOUNDARY.doesNotEstablish}
        </p>
        <p className="mt-2 text-xs leading-5" data-congestion-reconcile>
          {MCS_CONGESTION_PATTERN_BOUNDARY.reconcileWith}
        </p>
        <p className="mt-2 text-xs leading-5" data-congestion-outside-the-numbers>
          Local expertise, vascular access and anatomy, contraindications, the expected duration of
          support, whether gas exchange is part of the problem, and the patient&rsquo;s own goals
          all sit outside anything two pressures can produce — and none of them is on this screen.
        </p>

        <TextEquivalent>
          Right atrial pressure {reading(metrics.rapMmHg, 0)} mm Hg
          {congestion.rapElevated ? ' is' : ' is not'} above {congestion.thresholdMmHg} mm Hg, and
          wedge pressure {reading(metrics.pcwpMmHg, 0)} mm Hg
          {congestion.pcwpElevated ? ' is' : ' is not'}. Under the{' '}
          {congestion.frameworkLabel.toLowerCase()}, that is a {congestion.label.toLowerCase()}.{' '}
          {congestion.statement} Mean arterial pressure is {reading(metrics.mapMmHg, 0)} mm Hg. This
          is a congestion pattern, not a diagnosis of the dominant shock mechanism and not a device
          recommendation.
        </TextEquivalent>

        <ModelBoundary>
          {accSource.doNotInfer} The four-cell grid this panel draws is an educational
          operationalization of that prose; the consensus statement did not publish or validate this
          software algorithm.
        </ModelBoundary>

        <FigureScope
          establishes={MCS_CONGESTION_PATTERN_BOUNDARY.establishes}
          doesNotEstablish="The cause of shock, isolated ventricular failure, organ perfusion, or which support device this patient should receive. Temporary and durable support remain different decisions in kind, and neither follows from a congestion pattern."
        />
      </PanelSection>

      <PanelSection title="Where these thresholds come from" id="integration-congestion-evidence">
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Two different sources put cut points on the same two pressures. They are shown side by
          side and never merged: one is broad expert consensus, the other is one cohort&rsquo;s own
          operational definition, and there is no honest number between them.
        </p>

        <AfterCommitment summary="The ACC consensus description, and the AMI-CS cohort definition, side by side">
          <div
            className="rounded-xl border p-3"
            data-congestion-source={accSource.id}
            data-source-kind={accSource.kind}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {mcsClinicalSourceKindLabels[accSource.kind]}
            </p>
            <p className="mt-1 text-sm font-semibold">{MCS_ACC_CONGESTION_FRAMEWORK.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {accSource.citation} {accSource.locator}.
            </p>
            <ul className="mt-2 grid gap-1 text-xs leading-5">
              <li>
                Wedge or LV end-diastolic pressure above 15 mm Hg contributes to an LV-predominant
                congestion pattern.
              </li>
              <li>
                Right atrial or central venous pressure above 15 mm Hg with a relatively normal
                wedge pressure contributes to an RV-predominant pattern.
              </li>
              <li>Elevation of both contributes to a biventricular pattern.</li>
              <li>
                The writing committee suggests integrating invasive hemodynamics with
                echocardiography or point-of-care ultrasound and the rest of the clinical picture.
              </li>
            </ul>
            <p className="mt-2 text-xs leading-5">
              <span className="font-semibold">Applies when: </span>
              {accSource.appliesWhen}
            </p>
            <p className="mt-1 text-xs leading-5">
              <span className="font-semibold">Do not infer: </span>
              {accSource.doNotInfer}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground" data-evidence-ids>
              Evidence: {accSource.id}
            </p>
          </div>

          <div
            className="mt-3 rounded-xl border border-dashed p-3"
            data-congestion-source={ortegaSource.id}
            data-source-kind={ortegaSource.kind}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {mcsClinicalSourceKindLabels[ortegaSource.kind]}
            </p>
            <p className="mt-1 text-sm font-semibold">{MCS_ORTEGA_CONGESTION_FRAMEWORK.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {ortegaSource.citation} {ortegaSource.locator}.
            </p>
            <ul className="mt-2 grid gap-1 text-xs leading-5">
              <li>
                Right atrial pressure at or above {MCS_ORTEGA_COHORT_CUTOFFS.rapMmHg} mm Hg counted
                as elevated in that cohort.
              </li>
              <li>
                Pulmonary capillary wedge pressure at or above {MCS_ORTEGA_COHORT_CUTOFFS.pcwpMmHg}{' '}
                mm Hg counted as elevated in that cohort.
              </li>
              <li>
                Four cohort profile categories: right-ventricular, left-ventricular, biventricular,
                and the quadrant below both cut points.
              </li>
              <li>
                Profiles were reassessed serially over the first 24 hours after the catheter was
                placed; a persistent congestive profile was associated with higher in-hospital
                mortality, and the biventricular profile carried the highest.
              </li>
              <li>{ortegaSource.population}</li>
            </ul>
            <p className="mt-2 text-xs leading-5" data-ortega-euvolemic-note>
              Euvolemic was the study&rsquo;s label for the quadrant below both cohort cutoffs. It
              does not independently establish total-body euvolemia or adequate perfusion.
            </p>
            <p className="mt-2 text-xs leading-5">
              <span className="font-semibold">Applies when: </span>
              {ortegaSource.appliesWhen}
            </p>
            <p className="mt-1 text-xs leading-5">
              <span className="font-semibold">Do not infer: </span>
              {ortegaSource.doNotInfer}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground" data-evidence-ids>
              Evidence: {ortegaSource.id}
            </p>
            <p className="mt-2 text-xs leading-5" data-cohort-comparison>
              Under those cohort cut points, the two pressures on screen would fall in the{' '}
              {mcsCongestionProfileDefinition(congestion.cohortProfileId).cohortLabel}. The module
              classifies with the consensus framework rather than this one, because this module
              addresses cardiogenic shock more broadly than a single-center AMI-CS cohort.
            </p>
          </div>

          <p className="mt-3 text-xs leading-5" data-no-averaged-threshold>
            The 15 mm Hg the consensus statement describes and the{' '}
            {MCS_ORTEGA_COHORT_CUTOFFS.rapMmHg} and {MCS_ORTEGA_COHORT_CUTOFFS.pcwpMmHg} mm Hg the
            cohort used are not averaged and no compromise value is created from them. They answer
            different questions in different populations.
          </p>

          <TextEquivalent>
            The primary framework is the {mcsClinicalSourceKindLabels[accSource.kind].toLowerCase()}{' '}
            described in {accSource.citation}, which uses a threshold above{' '}
            {congestion.thresholdMmHg} mm Hg on each pressure. The comparison framework is the{' '}
            {mcsClinicalSourceKindLabels[ortegaSource.kind].toLowerCase()} reported in{' '}
            {ortegaSource.citation}, which used {MCS_ORTEGA_COHORT_CUTOFFS.rapMmHg} mm Hg for right
            atrial pressure and {MCS_ORTEGA_COHORT_CUTOFFS.pcwpMmHg} mm Hg for wedge pressure in 295
            AMI-CS patients at one center, reviewed retrospectively and reassessed over 24 hours.
            The two sets of numbers are shown separately and are never averaged.
          </TextEquivalent>
        </AfterCommitment>

        <AfterCommitment summary="What two filling pressures are not: the complete-profile boundary">
          <div
            className="rounded-xl border p-3"
            data-congestion-source={garanSource.id}
            data-source-kind={garanSource.kind}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {mcsClinicalSourceKindLabels[garanSource.kind]}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {garanSource.citation} {garanSource.locator}.
            </p>
            <ul className="mt-2 grid gap-1 text-xs leading-5" data-complete-profile-components>
              {MCS_COMPLETE_PROFILE_COMPONENTS.map((component) => (
                <li key={component}>{component}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-5">{MCS_COMPLETE_PROFILE_BOUNDARY.statement}</p>
            <p className="mt-2 text-xs leading-5" data-complete-profile-simulation>
              {MCS_COMPLETE_PROFILE_BOUNDARY.inThisSimulation}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground" data-evidence-ids>
              Evidence: {garanSource.id}
            </p>
          </div>

          <TextEquivalent>
            A complete invasive profile in that registry meant five measured components:{' '}
            {MCS_COMPLETE_PROFILE_COMPONENTS.join(', ')}. Derived values were recorded but did not
            count toward completeness. This simulation models the pressures and produces a modeled
            balance signal rather than a measured pulmonary artery saturation, so the two filling
            pressures above are a congestion pattern rather than a complete profile.
          </TextEquivalent>
        </AfterCommitment>

        <ModelBoundary>
          {garanSource.doNotInfer} This module publishes no filling-pressure cut point of its own,
          and the modeled mixed venous saturation it carries is not a measured pulmonary artery
          saturation.
        </ModelBoundary>
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
        <AlarmBand alarms={alarms} disclosed={disclosed} />
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
        <div className="mt-3 rounded-xl border border-dashed p-3" data-rap-pcwp-ratio>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {MCS_RAP_PCWP_RATIO_CONTEXT.label}
          </p>
          <p className="text-lg font-semibold">
            {congestion.rapToPcwpRatio === null
              ? 'not available'
              : congestion.rapToPcwpRatio.toFixed(2)}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {MCS_RAP_PCWP_RATIO_CONTEXT.valueType} — no unit
          </p>
          <p className="mt-1 text-xs leading-5">{MCS_RAP_PCWP_RATIO_CONTEXT.association}</p>
          <p className="mt-1 text-xs leading-5" data-ratio-do-not-infer>
            <span className="font-semibold">Do not infer: </span>
            {MCS_RAP_PCWP_RATIO_CONTEXT.doNotInfer}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground" data-evidence-ids>
            Evidence: {MCS_RAP_PCWP_RATIO_CONTEXT.sourceIds.join(', ')}
          </p>
        </div>
        <TextEquivalent>
          Cardiac power {reading(metrics.cardiacPowerOutputW, 2)} W and pulmonary pulsatility ratio{' '}
          {reading(metrics.papi, 1)}, both shown with the cohort observations they come from. The
          right atrial to wedge pressure ratio is{' '}
          {congestion.rapToPcwpRatio === null
            ? 'not available'
            : congestion.rapToPcwpRatio.toFixed(2)}
          , a derived arithmetic relationship carried here only as an outcome association. None of
          the three is a treatment target, none assigns a ventricular phenotype, and none selects a
          device.
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
            expertise and program availability, vascular access and anatomy, contraindications,
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
          <TransferState principle="Read the congestion pattern before naming a device, and keep the two apart. Where filling pressures are elevated is the start of the reasoning; it is not the cause of shock, and no single number on any screen finishes the decision.">
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
                label="Congestion pattern"
                value={congestion.label}
                kind="reasoned"
                note={`${congestion.statement} ${congestion.frameworkLabel}.`}
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
              {reading(metrics.papi, 1)}. Under the {congestion.frameworkLabel.toLowerCase()} that
              is a {congestion.label.toLowerCase()}. {congestion.statement}{' '}
              {flowAccountSentence(account, disclosed)}
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
