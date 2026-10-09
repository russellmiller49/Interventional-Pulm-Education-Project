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
  FigureCaption,
  FlowAccount,
  GuidedValue,
  LiveSetting,
  LiveValue,
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
      answer: `Filling pressures show a ${congestion.label.toLowerCase()}: right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg against a wedge pressure of ${reading(metrics.pcwpMmHg, 0)} mm Hg.`,
      limit:
        'The pattern says where filling pressures are high, not why the patient is in shock. Ask separately whether oxygenation or carbon dioxide clearance is part of the problem; the simulator has no failing lung.',
    },
    'mcs.model.q2-source-and-destination': {
      answer: pathways.map((pathway) => `${pathway.source} → ${pathway.destination}`).join('; '),
      limit: 'This is the pathway in place now, not the one to choose.',
    },
    'mcs.model.q3-mechanism-class': {
      answer: pathways.map((pathway) => pathway.relationshipLabel).join('; '),
      limit: 'Timing, direct pumping and an extracorporeal circuit are three different mechanisms.',
    },
    'mcs.model.q4-chamber-unloaded': {
      answer: `${pathways.map((pathway) => pathway.chamberUnloaded).join('; ')}. End-diastolic volume ${reading(metrics.lvedvMl, 0)} mL, wedge ${reading(metrics.pcwpMmHg, 0)} mm Hg, aortic valve ${metrics.aorticValveOpening ? 'opening' : 'not opening'}.`,
      limit:
        'End-diastolic volume here is a simulator surrogate, not an echo measurement. Read its direction.',
    },
    'mcs.model.q5-chamber-or-bed-loaded': {
      answer: `${pathways.map((pathway) => pathway.chamberOrBedLoaded).join('; ')}. Right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg.`,
      limit:
        'The loaded chamber is not always the one alarming. The cost can appear on the other side of the circulation from the device.',
    },
    'mcs.model.q6-what-limits-performance': {
      answer: `Preload ${reading(state.patient.preloadPercent, 0)}% of reference · afterload: systemic vascular resistance ${reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵, pulmonary vascular resistance ${reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units · rhythm ${state.patient.rhythm} · device position ${pump ? pump.leftPositionWords : 'not applicable on this pathway'} · tamponade: ${state.patient.tamponade ? 'present' : 'absent'} · ventricular interaction: right ventricular contractility ${reading(state.patient.rightVentricularContractility, 2)} against left ${reading(state.patient.leftVentricularContractility, 2)} · gas exchange: assess at the bedside.`,
      limit:
        'Inflow or outflow obstruction and gas exchange are not on this screen. Look for them with echo and a blood gas.',
    },
    'mcs.model.q7-what-defines-success': {
      answer: `Organ recovery: ${MCS_UNMODELED_ORGAN_SIGNALS.map((signal) => signal.label.toLowerCase()).join(', ')}.`,
      limit:
        'Say what success will look like before you change a setting, then check it at the bedside: mentation, urine output, skin perfusion and the lactate trend.',
    },
  }

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="Filling-pressure congestion pattern" id="integration-congestion">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <LiveValue
            label="Right atrial pressure"
            value={metrics.rapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
            note={
              congestion.rapElevated
                ? `Elevated: above ${congestion.thresholdMmHg} mm Hg (ACC consensus).`
                : `Not elevated: ${congestion.thresholdMmHg} mm Hg or below (ACC consensus).`
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
                ? `Elevated: above ${congestion.thresholdMmHg} mm Hg (ACC consensus).`
                : `Not elevated: ${congestion.thresholdMmHg} mm Hg or below (ACC consensus).`
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
          Hg. By the ACC consensus thresholds this is a {congestion.label.toLowerCase()}.
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

        <p className="mt-3 text-xs leading-5" data-congestion-reconcile>
          {MCS_CONGESTION_PATTERN_BOUNDARY.reconcileWith}
        </p>
        <p className="mt-2 text-xs leading-5" data-congestion-outside-the-numbers>
          Then weigh what two pressures cannot show: vascular access and anatomy, contraindications,
          the expected duration of support, whether gas exchange is part of the problem, and the
          patient&rsquo;s goals.
        </p>

        <TextEquivalent>
          Right atrial pressure {reading(metrics.rapMmHg, 0)} mm Hg
          {congestion.rapElevated ? ' is' : ' is not'} above {congestion.thresholdMmHg} mm Hg, and
          wedge pressure {reading(metrics.pcwpMmHg, 0)} mm Hg
          {congestion.pcwpElevated ? ' is' : ' is not'}. Under the{' '}
          {congestion.frameworkLabel.toLowerCase()}, that is a {congestion.label.toLowerCase()}.{' '}
          {congestion.statement} Mean arterial pressure is {reading(metrics.mapMmHg, 0)} mm Hg.
        </TextEquivalent>

        <FigureCaption>{MCS_CONGESTION_PATTERN_BOUNDARY.establishes}</FigureCaption>
      </PanelSection>

      <PanelSection
        title="Where these thresholds come from"
        id="integration-congestion-evidence"
        reference
      >
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Two sources put cut points on the same two pressures: an expert consensus statement and
          one cohort&rsquo;s own definition. Both are shown.
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
              Euvolemic was the study&rsquo;s label for the quadrant below both cutoffs. It does not
              mean the patient is euvolemic or well perfused.
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
              {mcsCongestionProfileDefinition(congestion.cohortProfileId).cohortLabel}. The pattern
              above uses the consensus thresholds, which cover cardiogenic shock of any cause.
            </p>
          </div>

          <p className="mt-3 text-xs leading-5" data-no-averaged-threshold>
            The 15 mm Hg the consensus statement describes and the{' '}
            {MCS_ORTEGA_COHORT_CUTOFFS.rapMmHg} and {MCS_ORTEGA_COHORT_CUTOFFS.pcwpMmHg} mm Hg the
            cohort used come from different populations. Know which one your unit uses.
          </p>

          <TextEquivalent>
            The primary framework is the {mcsClinicalSourceKindLabels[accSource.kind].toLowerCase()}{' '}
            described in {accSource.citation}, which uses a threshold above{' '}
            {congestion.thresholdMmHg} mm Hg on each pressure. The comparison framework is the{' '}
            {mcsClinicalSourceKindLabels[ortegaSource.kind].toLowerCase()} reported in{' '}
            {ortegaSource.citation}, which used {MCS_ORTEGA_COHORT_CUTOFFS.rapMmHg} mm Hg for right
            atrial pressure and {MCS_ORTEGA_COHORT_CUTOFFS.pcwpMmHg} mm Hg for wedge pressure in 295
            AMI-CS patients at one center, reviewed retrospectively and reassessed over 24 hours.
          </TextEquivalent>
        </AfterCommitment>

        <AfterCommitment summary="What a complete invasive profile contains">
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
            count toward completeness. Two filling pressures are a congestion pattern, not a
            complete profile.
          </TextEquivalent>
        </AfterCommitment>
      </PanelSection>

      <PanelSection
        title="The seven questions, answered from this state"
        id="integration-questions"
      >
        <div className={styles.scroller}>
          <table className={`${styles.table} min-w-[34rem]`} data-common-model-answers>
            <caption className="text-left text-xs leading-5 text-muted-foreground">
              Each of the seven questions, answered from this patient, with what to check next.
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
                  What to check next
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
      </PanelSection>

      <PanelSection title="The flow account behind those answers" id="integration-flow" reference>
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>
          {pathways.map((pathway) => pathwaySentence(pathway)).join(' ')}{' '}
          {flowAccountSentence(account, disclosed)}
        </TextEquivalent>
        <AlarmBand alarms={alarms} disclosed={disclosed} />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
      </PanelSection>

      <PanelSection
        title="The two interpreted values, with their sourcing"
        id="integration-guides"
        reference
      >
        <GuidedValue
          guide={mcsDerivedValueGuides.cardiacPowerOutputW}
          value={metrics.cardiacPowerOutputW}
        />
        <GuidedValue
          guide={mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex}
          value={metrics.papi}
        />
        <p className="mt-3 text-xs leading-5" data-papi-limitation>
          <span className="font-semibold">Simulator value. </span>
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.statement} Here the ratio barely moves
          with right-sided support, so judge that support from right atrial pressure and left-sided
          filling.
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
          . {MCS_RAP_PCWP_RATIO_CONTEXT.association}
        </TextEquivalent>
      </PanelSection>

      <PanelSection title="Bridge and exit" id="integration-strategy" reference>
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
            <span className="font-semibold">What the numbers leave out. </span>Program availability,
            vascular access and anatomy, contraindications, whether gas exchange is part of the
            problem, and the patient&rsquo;s goals of care.
          </li>
        </ul>
        <TextEquivalent>
          Temporary and durable support are different decisions in kind. An exit strategy is
          explicit from the start. Access and anatomy, contraindications, gas exchange and the
          patient&rsquo;s goals are weighed with the numbers.
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
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="integration-transfer">
          <TransferState principle="Read the congestion pattern before naming a device. Where filling pressures are high tells you which side is failing; choose the mechanism that supports that side.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
