import { useId } from 'react'

import { deriveEcmoCircuitPresentation } from '../../content/circuitPresentation'
import { resolveEcmoModeText } from '../../content/circuitSegments'
import {
  ECMO_LOCALIZATION_FOOTER,
  ECMO_LOCALIZATION_SCAFFOLD_BOUNDARY,
  ecmoLocalizationRow,
  ecmoLocalizationRowTextEquivalent,
  ecmoLocalizationZoneSentence,
  ecmoLocalizationRows,
  ecmoLocalizationScaffoldTextEquivalent,
  type EcmoLocalizationRow,
  type EcmoLocalizationRowId,
} from '../../content/localizationCards'
import type { EcmoSimulationState, SupportMode } from '../../engine/types'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { ModelBoundary, TextEquivalent, styles } from './shared'

/**
 * The localization grammar, rendered at one of two depths.
 *
 * The registry authors each pattern once; this decides how much of it a given lesson may show. The
 * split is the whole point of the component:
 *
 * `scaffold-table` is the foundation view. All four patterns, each with the place it lives, shown
 * while the circuit in front of the learner has nothing wrong with it. It stops at location on
 * purpose — the cause shortlist, the response that fits and the reflex to avoid are the answers to
 * questions the drills have not asked yet.
 *
 * `revealed-row` is the drill view: one row, in full, after a commitment. It is reached through
 * `EcmoDrillLocalization`, never by a panel deciding for itself that the moment has come.
 *
 * Rendered as bordered blocks rather than a table, so nothing needs a horizontal scroller at the
 * narrowest pane and a wrapped row keeps its pattern beside its location.
 */

function RowBlock({
  row,
  supportMode,
  revealed,
}: {
  readonly row: EcmoLocalizationRow
  readonly supportMode: SupportMode
  readonly revealed: boolean
}) {
  return (
    <div className="rounded-xl border px-3 py-2" data-localization-row={row.id}>
      <p data-row-pattern>
        <span className="font-semibold">{row.label}. </span>
        {resolveEcmoModeText(row.signature, supportMode)}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground" data-row-zones>
        {ecmoLocalizationZoneSentence(row.id)}
      </p>
      <p className="mt-1 font-medium" data-row-location>
        Where the problem lives: {row.problemLocation}
      </p>

      {revealed ? (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What to inspect
          </p>
          <ul className="mt-1 grid gap-1" data-row-causes>
            {row.causes.map((cause) => (
              <li key={cause}>{cause}</li>
            ))}
          </ul>
          <p className="mt-2" data-row-action>
            <span className="font-semibold">The move that fits: </span>
            {row.actionClass}
          </p>
          <p className="mt-1" data-row-reflex>
            <span className="font-semibold">The reflex that does harm here: </span>
            {row.harmfulReflex}
          </p>
          {supportMode === 'va' ? (
            <p className="mt-1" data-row-va-variation>
              <span className="font-semibold">On VA: </span>
              {row.vaVariation}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/**
 * The row's sources, each beside the claim this row takes from it.
 *
 * Rendered through the shared source list, so the title, class badge, link and copy control are the
 * ones every other citing surface shows. The claims are the row's own: a source supports several
 * things, and the line under each title states the one this pattern rests on rather than all of
 * them. Ids stay in data attributes, where a test can still find them and a learner never reads
 * them; an id that no longer resolves throws outside production, because that is a registry defect
 * rather than something to render around.
 */
function SourceSupport({ row }: { readonly row: EcmoLocalizationRow }) {
  const claims = Object.fromEntries(
    row.sourceSupport.map((support) => [support.evidenceId, support.claim]),
  )
  return (
    <section className={styles.section} aria-label="Source support and limits">
      <div data-localization-sources>
        <EcmoSourceList
          compact
          showLimitations
          evidenceIds={row.sourceSupport.map((support) => support.evidenceId)}
          claims={claims}
        />
      </div>
    </section>
  )
}

export type EcmoLocalizationCardProps =
  | { readonly mode: 'scaffold-table'; readonly supportMode: SupportMode }
  | {
      readonly mode: 'revealed-row'
      readonly supportMode: SupportMode
      readonly rowId: EcmoLocalizationRowId
    }

export function EcmoLocalizationCard(props: EcmoLocalizationCardProps) {
  const headingId = useId()
  const revealed = props.mode === 'revealed-row'
  const rows = revealed ? [ecmoLocalizationRow(props.rowId)] : ecmoLocalizationRows

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      data-localization-card
      data-localization-mode={props.mode}
      data-support-mode={props.supportMode}
    >
      <h3 id={headingId} className={styles.heading}>
        {revealed
          ? 'Which pattern this is, and where it lives'
          : 'Four patterns, and where each one lives'}
      </h3>

      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <RowBlock key={row.id} row={row} supportMode={props.supportMode} revealed={revealed} />
        ))}
      </div>

      {revealed ? null : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground" data-localization-scaffold-note>
          These are directions and patterns, not a diagnosis. The circuit in front of you has no
          injected problem, and the drills that work each pattern come later in the pathway.
        </p>
      )}

      <p className="mt-3 text-xs leading-5" data-localization-footer>
        {ECMO_LOCALIZATION_FOOTER.text}
      </p>

      {revealed ? <SourceSupport row={rows[0]} /> : null}

      <ModelBoundary>
        {revealed ? rows[0].modelBoundary : ECMO_LOCALIZATION_SCAFFOLD_BOUNDARY}
      </ModelBoundary>

      <TextEquivalent>
        {revealed
          ? ecmoLocalizationRowTextEquivalent(props.supportMode, rows[0].id)
          : ecmoLocalizationScaffoldTextEquivalent(props.supportMode)}
      </TextEquivalent>
    </section>
  )
}

/**
 * The drill entry point, gated three times over.
 *
 * A panel places this inside `AfterCommitment`, which already withholds it; it derives its own
 * presentation from the engine rather than from a prop; and it renders nothing at all unless that
 * presentation says a row is being revealed. Any one of the three would do the job — having all
 * three means a panel author cannot accidentally undo the contract by moving one line.
 */
export function EcmoDrillLocalization({
  state,
  rowId,
}: {
  readonly state: EcmoSimulationState
  readonly rowId: EcmoLocalizationRowId
}) {
  const presentation = deriveEcmoCircuitPresentation(state, { kind: 'drill-reveal', rowId })
  if (presentation.kind !== 'implicated') return null
  return (
    <EcmoLocalizationCard
      mode="revealed-row"
      rowId={presentation.rowId}
      supportMode={state.supportMode}
    />
  )
}
