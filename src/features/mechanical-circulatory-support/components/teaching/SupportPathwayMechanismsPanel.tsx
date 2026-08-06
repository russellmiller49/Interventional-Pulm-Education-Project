import { mcsSupportPathwayCardById } from '../../content/supportPathways'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  activePathways,
  beforeAfterReadings,
  flowAccountView,
  mcsComparisonPathways,
  reading,
  type McsPathwayView,
} from './selectors'
import {
  BeforeAfter,
  DEADBAND_CAPTION,
  FigureScope,
  FlowAccount,
  ModelBoundary,
  PanelSection,
  PathwayGraphic,
  TextEquivalent,
  TransferState,
  beforeAfterSentence,
  flowAccountSentence,
  pathwaySentence,
  styles,
} from './shared'

/**
 * Section 2 — where blood enters, what changes it, where it returns, and what that loads.
 *
 * The comparison table is the figure. It is authored from the standardized pathway cards rather than
 * from a second description of the same devices, so a distinction that is true on the cards cannot
 * quietly become untrue here: the balloon has no source and no destination, the two microaxial
 * pathways run to different destinations and are serial, a durable pump is a different decision in
 * kind, and the two extracorporeal pathways are named for comparison without being simulated.
 *
 * The pathway currently in place is drawn above the table and marked in it. Before a commitment the
 * table shows only the mechanism on screen; the cross-mechanism comparison is exactly what the
 * learner is asked to predict, so it arrives with the verdict.
 */

interface ComparisonRow {
  readonly id: string
  readonly name: string
  readonly movesBlood: string
  readonly source: string
  readonly destination: string
  readonly relationship: string
  readonly unloads: string
  readonly loads: string
  readonly gasExchange: string
  readonly simulated: boolean
}

/**
 * The comparison, taken from the pathway cards.
 *
 * Reading the fields off `mcsSupportPathwayCards` rather than restating them means the eight cards
 * in the foundation disclosure and this table cannot disagree — and the card schema already refuses
 * a pathway that omits any of these fields.
 */
function comparisonRows(): readonly ComparisonRow[] {
  const ids = [
    'iabp-counterpulsation',
    'impella-left-transvalvular',
    'impella-right-caval-to-pa',
    'durable-continuous-flow-lvad',
    'vv-ecmo-comparison',
    'va-ecmo-comparison',
  ] as const
  const relationship: Readonly<Record<string, string>> = {
    'iabp-counterpulsation': 'No pathway — timing only',
    'impella-left-transvalvular': 'Parallel with native ejection',
    'impella-right-caval-to-pa': 'In series ahead of the left heart',
    'durable-continuous-flow-lvad': 'Parallel with native ejection, durable',
    'vv-ecmo-comparison': 'In series with the native lung',
    'va-ecmo-comparison': 'Parallel with the native heart',
  }
  return ids.map((id) => {
    const card = mcsSupportPathwayCardById.get(id)
    if (!card) throw new Error(`MCS teaching panel: no pathway card for ${id}`)
    return {
      id,
      name: card.shortName,
      movesBlood:
        card.displayedFlow.valueType === 'no-device-flow-reported'
          ? 'No — it moves no blood along a pathway of its own'
          : 'Yes',
      source: card.bloodEntersFrom,
      destination: card.bloodReturnsTo,
      relationship: relationship[id] ?? '—',
      unloads: card.chamberPrimarilyUnloaded,
      loads: card.chamberOrBedPotentiallyLoaded,
      gasExchange: card.gasExchange.provides ? 'Yes' : 'No',
      simulated: card.availability === 'simulated-in-this-module',
    }
  })
}

const comparisonTableRows = comparisonRows()

function currentRowIds(pathways: readonly McsPathwayView[]): readonly string[] {
  return pathways.map((pathway) => pathway.id)
}

export function SupportPathwayMechanismsPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const pathways = activePathways(state)
  const account = flowAccountView(state)
  const active = currentRowIds(pathways)
  const rows = beforeAfterReadings(
    [
      { metric: 'nativeFlowLMin', label: 'Native contribution', unit: 'L/min', kind: 'modeled' },
      {
        metric: 'deviceFlowLMin',
        label: 'Displayed device contribution',
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
        metric: 'pulsePressureMmHg',
        label: 'Pulse pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      {
        metric: 'lvedvMl',
        label: 'Left ventricular end-diastolic volume',
        unit: 'mL',
        digits: 0,
        kind: 'modeled',
      },
      {
        metric: 'mapMmHg',
        label: 'Mean arterial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
    ],
    beforeMetrics,
    state.metrics,
  )

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="The pathway in place right now" id="mechanisms-current">
        {pathways.map((pathway) => (
          <PathwayGraphic key={pathway.id} pathway={pathway} />
        ))}
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>
          {pathways.map((pathway) => pathwaySentence(pathway)).join(' ')} The flow account reads:{' '}
          {flowAccountSentence(account, disclosed)}
        </TextEquivalent>
        <ModelBoundary>
          The diagram is a statement about which compartments a mechanism connects, not a scale
          drawing of a catheter, a cannula, or a vessel. Insertion route is not drawn at all, and
          the direction a device was advanced is not the direction blood travels through it.
        </ModelBoundary>
        <FigureScope
          establishes="Which compartment this mechanism draws from, which one it returns to, which chamber it relieves, and which chamber or vascular bed inherits the consequence."
          doesNotEstablish="Which mechanism this patient should receive. A pathway describes what a mechanism does; it does not diagnose what is limiting this circulation."
        />
      </PanelSection>

      {disclosed ? (
        <PanelSection title="The mechanisms side by side" id="mechanisms-comparison">
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Read down the &ldquo;moves blood&rdquo; column first. It is the column that separates a
            mechanism with a pathway from a mechanism without one, and it is the distinction every
            other row depends on. The two extracorporeal pathways are named here for comparison and
            are not simulated in this module.
          </p>
          <div className={styles.scroller}>
            <table className={`${styles.table} min-w-[46rem]`} data-mechanism-comparison>
              <caption className="text-left text-xs leading-5 text-muted-foreground">
                Each mechanism with the compartment blood enters from, the compartment it returns
                to, whether it moves blood at all, its relationship to the native circulation, the
                chamber it unloads, the chamber or bed it can load, and whether it provides gas
                exchange. The row for the mechanism currently on screen is marked.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Mechanism
                  </th>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Moves blood
                  </th>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Enters from
                  </th>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Returns to
                  </th>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Relationship
                  </th>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Unloads
                  </th>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Can load
                  </th>
                  <th scope="col" className="pb-1 font-semibold">
                    Gas exchange
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonTableRows.map((row) => (
                  <tr
                    key={row.id}
                    data-comparison-pathway={row.id}
                    data-on-screen={active.includes(row.id) ? 'true' : undefined}
                  >
                    <th scope="row" className="py-1 pr-3 align-top font-medium">
                      {row.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.simulated ? 'simulated here' : 'named for comparison, not simulated'}
                        {active.includes(row.id) ? ' · on screen now' : ''}
                      </span>
                    </th>
                    <td className="py-1 pr-3 align-top">{row.movesBlood}</td>
                    <td className="py-1 pr-3 align-top">{row.source}</td>
                    <td className="py-1 pr-3 align-top">{row.destination}</td>
                    <td className="py-1 pr-3 align-top">{row.relationship}</td>
                    <td className="py-1 pr-3 align-top">{row.unloads}</td>
                    <td className="py-1 pr-3 align-top">{row.loads}</td>
                    <td className="py-1 align-top">{row.gasExchange}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TextEquivalent>
            {comparisonTableRows
              .map(
                (row) =>
                  `${row.name}: moves blood — ${row.movesBlood.toLowerCase()}; enters from ${row.source} returns to ${row.destination}; ${row.relationship.toLowerCase()}; unloads ${row.unloads}; can load ${row.loads}; gas exchange ${row.gasExchange.toLowerCase()}`,
              )
              .join('. ')}
            .
          </TextEquivalent>

          <ul className="mt-3 grid gap-2 text-xs leading-5" data-required-distinctions>
            <li data-distinction="iabp-is-not-a-pump">
              <span className="font-semibold">Counterpulsation moves no blood of its own. </span>
              {mcsComparisonPathways.iabp.relationshipLabel}. It has no source compartment and no
              destination compartment, so its flow line is empty rather than small.
            </li>
            <li data-distinction="left-versus-right-microaxial">
              <span className="font-semibold">
                Left and right microaxial support go to different places.{' '}
              </span>
              Left is ventricle-to-aorta. Right is caval-to-pulmonary-artery, and its blood has not
              reached the systemic circulation yet.
            </li>
            <li data-distinction="serial-pumps-are-not-additive">
              <span className="font-semibold">Serial pump flows are never summed. </span>The right
              pump delivers into the lung; the left pump moves that same blood onward afterwards.
              Adding the two counts one stream twice.
            </li>
            <li data-distinction="durable-is-not-more-temporary">
              <span className="font-semibold">
                A durable pump is a different decision in kind.{' '}
              </span>
              Candidacy, implantation, and an agreed exit strategy are settled before support
              begins, which is not true of any temporary pathway here.
            </li>
            <li data-distinction="vv-ecmo-adds-no-systemic-flow">
              <span className="font-semibold">
                Venovenous extracorporeal support provides gas exchange without a direct arterial
                flow stream.{' '}
              </span>
              It returns blood to the venous side, so it creates no direct arterial pump-flow
              contribution and systemic circulatory flow remains native cardiac output — although
              improved gas exchange and altered right ventricular loading may indirectly affect that
              native output.
            </li>
            <li data-distinction="va-ecmo-loads-the-lv">
              <span className="font-semibold">
                Venoarterial extracorporeal support may load the left ventricle.{' '}
              </span>
              It creates an extracorporeal arterial-flow pathway and may increase left ventricular
              afterload and loading — particularly with peripheral retrograde arterial return,
              higher circuit flow, and limited native ejection. How much, and in which direction,
              depends on the configuration, so it is the opposite tendency to a transvalvular pump
              rather than a fixed quantity.
            </li>
            <li data-distinction="insertion-direction-is-not-flow-direction">
              <span className="font-semibold">
                Advancement direction is not blood-flow direction.{' '}
              </span>
              A cannula advanced from a leg vein still carries blood caval-to-pulmonary.
            </li>
          </ul>

          <ModelBoundary>
            Two of the six mechanisms in this table are described rather than simulated. Nothing in
            this module produces an extracorporeal circuit, a gas-exchange failure state, or a
            membrane lung, so the last two rows are comparison content and the workspace cannot be
            used to explore them.
          </ModelBoundary>
        </PanelSection>
      ) : (
        <PanelSection title="What the comparison will hold" id="mechanisms-pending">
          <p className="mt-2 text-sm leading-6">
            The same circulation is about to be held against three mechanisms in turn. The columns
            you will read them in are: whether the mechanism moves blood at all, where blood enters,
            where it returns, its relationship to the native circulation, the chamber it relieves,
            the chamber or bed it can load, and whether it provides gas exchange.
          </p>
          <p className="mt-2 text-sm leading-6">
            Native contribution is {reading(state.metrics.nativeFlowLMin, 1)} L/min and effective
            systemic delivery is {reading(state.metrics.effectiveSystemicFlowLMin, 1)} L/min on the
            mechanism currently in place.
          </p>
          <TextEquivalent>
            The comparison table is not shown yet. It has eight columns — mechanism, moves blood,
            enters from, returns to, relationship, unloads, can load, and gas exchange — and it
            fills in once an answer has been committed.
          </TextEquivalent>
        </PanelSection>
      )}

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the mechanism changed, and now" id="mechanisms-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="The flow lines and the two chamber readings, on the mechanism the task opened with and on the one in place now."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="mechanisms-transfer">
          <TransferState principle="Source, active component, destination. A mechanism is chosen against the compartment that is failing, not against the size of the number its display reports.">
            {pathways.map((pathway) => (
              <PathwayGraphic key={`transfer-${pathway.id}`} pathway={pathway} />
            ))}
            <FlowAccount account={account} disclosed={disclosed} />
            <TextEquivalent>
              In the transfer patient the pathway in place is:{' '}
              {pathways.map((pathway) => pathwaySentence(pathway)).join(' ')} The flow account
              reads: {flowAccountSentence(account, disclosed)}
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
