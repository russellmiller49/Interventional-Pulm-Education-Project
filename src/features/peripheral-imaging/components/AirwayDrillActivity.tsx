'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'

import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { Link } from '@/i18n/navigation'

import {
  AIRWAY_DRILL,
  DRILL_ANSWER_LABELS,
  airwayDrillLinkTarget,
  airwayDrillValues,
  airwayDrillView,
  drillDebrief,
  drillVerdict,
} from '../content/airwayDrill'
import { AIRWAY_BRANCHES } from '../content/airwayNames'
import { imagingLesson } from '../content/pathway'
import { imagingSectionLinkTarget } from '../content/pathwayResolver'
import { PERIPHERAL_IMAGING_PRACTICE_HREF } from '../content/routes'
import {
  AIRWAY_DRILL_CASES,
  DRILL_ANSWERS,
  airwayDrillCase,
  type DrillAnswer,
} from '../lib/airwayDrill'
import { DrillAxialFigure } from './figures/DrillAxialFigure'
import styles from './stage/imaging-stage.module.css'
import { ImagingSuitePane } from './suite/ImagingSuitePane'

/**
 * One position of the drill: the catheter in a neighbouring bronchus, the C-arm free to turn 30°
 * either way, and one question — where the nodule lies from the tip.
 *
 * Until an answer is checked the image stands alone. The 3D view, the bronchi and the CT all show
 * the depth being asked for, so they open with the feedback and close again on "Try again".
 * Nothing is saved: an answer lives in this component for the feedback it drives (PI-01).
 */
export function AirwayDrillActivity({ caseId }: { readonly caseId: string }) {
  const entry = airwayDrillCase(caseId)
  const [orbit, setOrbit] = useState(0)
  const [selected, setSelected] = useState<DrillAnswer | null>(null)
  const [checked, setChecked] = useState<DrillAnswer | null>(null)
  const view = useMemo(() => airwayDrillView(), [])
  const revealed = checked !== null
  const lab = useMemo(
    () => (entry ? { values: airwayDrillValues(entry, orbit, revealed), events: [] } : null),
    [entry, orbit, revealed],
  )

  if (!entry || !lab) {
    return (
      <p role="status" data-unknown-drill={caseId}>
        That position is not in this drill. The drill is listed on the Practice page.
      </p>
    )
  }

  const total = AIRWAY_DRILL_CASES.length
  const previous = AIRWAY_DRILL_CASES[entry.number - 2] ?? null
  const next = AIRWAY_DRILL_CASES[entry.number] ?? null
  const debrief = drillDebrief(entry)
  const concept = imagingLesson(AIRWAY_DRILL.conceptSectionId)

  return (
    // Three blocks in reading order — the situation, the image, the question — so that on a narrow
    // screen the image sits above the choices it is read for. Wide, the image takes the right-hand
    // column beside both and stays in view while the text scrolls.
    <article
      className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start"
      data-airway-drill={entry.id}
      data-drill-revealed={revealed}
    >
      <div className="grid gap-5 lg:col-start-1 lg:row-start-1">
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Practice · catheter position {entry.number} of {total}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{AIRWAY_DRILL.title}</h1>
        </div>

        <section className={styles.teachingCard} data-drill-situation>
          <p className={styles.kicker}>The situation</p>
          <p>{AIRWAY_DRILL.situation}</p>
        </section>
      </div>

      <div
        className="grid min-w-0 gap-2 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        data-drill-image
      >
        <ImagingSuitePane
          key={`${entry.id}:${revealed ? 'revealed' : 'asked'}`}
          presentation="comparison"
          view={view}
          lab={lab}
          controlsEnabled
          independent={!revealed}
          monitorSize="large"
          goals={[]}
          chainCaption=""
          onLabChange={(patch) => {
            if (typeof patch.drillOrbit === 'number') setOrbit(patch.drillOrbit)
          }}
          onLabReset={() => setOrbit(0)}
        />
        <p className="text-xs leading-5 text-muted-foreground" data-drill-legend>
          {revealed ? AIRWAY_DRILL.revealLegend : AIRWAY_DRILL.imageLegend}
        </p>
      </div>

      <div className="grid content-start gap-5 lg:col-start-1 lg:row-start-2">
        <p className="text-sm text-muted-foreground" data-drill-pairing>
          Review the concept:{' '}
          <Link
            className="font-semibold text-primary"
            href={imagingSectionLinkTarget(AIRWAY_DRILL.conceptSectionId)}
          >
            {concept.title}
          </Link>
        </p>

        {checked ? (
          <section className="grid gap-3" data-drill-feedback aria-live="polite">
            <p className="text-base font-semibold" data-drill-verdict>
              {drillVerdict(entry, checked)}
            </p>
            <p className="text-sm text-muted-foreground">
              Your answer: {DRILL_ANSWER_LABELS[checked].toLowerCase()}.
            </p>
            <div className={styles.teachingCard}>
              <p className={styles.kicker}>How the image shows it</p>
              <p data-drill-position>{debrief.position}</p>
              <p data-drill-side>{debrief.side}</p>
              <p data-drill-depth>{debrief.depth}</p>
            </div>
            <div className={styles.teachingCard}>
              <p className={styles.kicker}>
                The catheter is in {AIRWAY_BRANCHES[entry.bronchus].short}
              </p>
              <p data-drill-next>{debrief.next}</p>
            </div>
            <DrillAxialFigure entry={entry} />
            <div>
              <button
                type="button"
                className={shellStyles.nowSecondary}
                data-answer-again
                onClick={() => {
                  setChecked(null)
                  setSelected(null)
                  setOrbit(0)
                }}
              >
                <RotateCcw aria-hidden="true" /> Try again
              </button>
            </div>
          </section>
        ) : (
          <div className="grid gap-4">
            <fieldset className={stageStyles.choiceList} data-prediction-choices>
              <legend>{AIRWAY_DRILL.question}</legend>
              <p className="text-sm text-muted-foreground" data-drill-method>
                {AIRWAY_DRILL.method}
              </p>
              {DRILL_ANSWERS.map((answer) => (
                <label
                  key={answer}
                  className={stageStyles.choice}
                  data-selected={selected === answer}
                >
                  <input
                    type="radio"
                    name={`airway-drill-${entry.id}`}
                    value={answer}
                    checked={selected === answer}
                    onChange={() => setSelected(answer)}
                  />
                  <span>{DRILL_ANSWER_LABELS[answer]}</span>
                </label>
              ))}
            </fieldset>
            <div>
              <button
                type="button"
                className={shellStyles.nowPrimary}
                data-now-primary
                disabled={!selected}
                onClick={() => {
                  if (selected) setChecked(selected)
                }}
              >
                Check my answer <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Drill positions">
          {previous ? (
            <Link
              className="inline-flex items-center gap-1 font-semibold text-primary"
              href={airwayDrillLinkTarget(previous.id)}
            >
              <ArrowLeft aria-hidden="true" /> Position {previous.number}
            </Link>
          ) : null}
          <Link className="font-semibold text-primary" href={PERIPHERAL_IMAGING_PRACTICE_HREF}>
            All practice
          </Link>
          {next ? (
            <Link
              className="inline-flex items-center gap-1 font-semibold text-primary"
              href={airwayDrillLinkTarget(next.id)}
              data-next-drill={next.id}
            >
              Next position <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <Link
              className="inline-flex items-center gap-1 font-semibold text-primary"
              href={PERIPHERAL_IMAGING_PRACTICE_HREF}
              data-back-to-list
            >
              Back to Practice <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </nav>
      </div>
    </article>
  )
}
