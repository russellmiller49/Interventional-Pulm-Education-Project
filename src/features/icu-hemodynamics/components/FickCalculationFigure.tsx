'use client'

import { useId } from 'react'

import { roundTo } from '../engine/calculations'
import {
  CARDIAC_OUTPUT_MODEL_CONSTANTS,
  fickCardiacOutput,
  fickVenousSampleSiteLabels,
  fickVenousSpecimenWords,
  type FickResult,
} from '../engine/fick'
import { FICK_EPISODES } from './FickMethodWorkbench'
import styles from './icu-hemodynamics.module.css'

/** The inputs a Fick calculation takes, in the order the reading page lists them. */
const INPUT_ROWS = [
  'vo2',
  'hemoglobin',
  'arterial-saturation',
  'mixed-venous-saturation',
  'venous-sample-site',
] as const

const BINDING = CARDIAC_OUTPUT_MODEL_CONSTANTS.hemoglobinOxygenBindingCapacityMlPerG
const DL_PER_L = CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter

/**
 * The Fick calculation, drawn: what goes in, the formula with those inputs in it, and what comes
 * out. It is the derived-values section's drawing (`DerivedValueFigure`) laid out the same way, so
 * the two sections that calculate a value look alike.
 *
 * Nothing here is authored for the drawing. Beside a reading page it draws that page's episode
 * (`FICK_EPISODES`), every number read from `fickCardiacOutput` over the same inputs the page's
 * card prints, so the drawing and the card cannot disagree; the oxygen-content constant is the
 * engine's own. No episode carries a number from the teaching-number register.
 *
 * Without an episode it draws the calculation's structure and no numbers: beside the task's
 * question, which asks which of two results was measured, a drawing of one episode's provenance
 * would be an answer.
 */
export function FickCalculationFigure({ episodeId }: { readonly episodeId?: string }) {
  const captionId = useId()
  const episode = episodeId
    ? (FICK_EPISODES.find((candidate) => candidate.id === episodeId) ?? null)
    : null
  const result = episode ? fickCardiacOutput(episode.inputs) : null
  // Structure only: the row labels of the page's first episode, with no values.
  const labels = fickCardiacOutput(FICK_EPISODES[0].inputs).trace
  const rows = INPUT_ROWS.map((id) => {
    const row = (result ?? { trace: labels }).trace.find((candidate) => candidate.id === id)!
    if (!result || !episode)
      return { id, label: row.label, value: null, status: null, usable: true }
    const site = fickVenousSampleSiteLabels[episode.inputs.venousSampleSite]
    return {
      id,
      label: row.label,
      value: inputValue(id, row.value, site.label),
      status: row.statusLabel,
      provenance: row.status,
      usable: id === 'venous-sample-site' ? site.isTrueMixedVenous : row.value !== null,
    }
  })

  return (
    <figure
      className={styles.derivedValueFigure}
      aria-labelledby={captionId}
      data-fick-figure={episode?.id ?? 'structure'}
      data-fick-values={result ? 'shown' : 'structure'}
    >
      <figcaption id={captionId}>
        <strong>Fick cardiac output: what goes in, and what comes out</strong>
        {episode ? <span data-fick-episode> · {episode.label}</span> : null}
      </figcaption>
      <p className={styles.derivedValueStage}>Inputs</p>
      <ul className={styles.derivedValueInputs} data-fick-inputs>
        {rows.map((row) => (
          <li
            key={row.id}
            data-fick-input={row.id}
            data-usable={row.usable}
            data-provenance={'provenance' in row ? row.provenance : undefined}
          >
            <b>{row.label}</b>
            {row.value ? (
              <span className={styles.fickFigureValue}>
                <span data-fick-input-value>{row.value}</span>
                {row.status ? <small>{row.status}</small> : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className={styles.derivedValueStage} data-fick-follows>
        Formula
      </p>
      <div className={styles.fickFigureFormula} data-fick-formula>
        <p>
          Oxygen content = {BINDING} mL/g × hemoglobin × saturation
          <br />
          Cardiac output = oxygen uptake ÷ (arteriovenous oxygen-content difference × {
            DL_PER_L
          }{' '}
          dL/L)
        </p>
        {result && episode ? <PlacedFormula result={result} inputs={episode.inputs} /> : null}
      </div>
      <p className={styles.derivedValueStage} data-fick-follows>
        Result
      </p>
      <div
        className={styles.derivedValueResult}
        data-fick-result={result?.status ?? 'not-shown'}
        data-fick-uptake={result?.vo2Provenance}
      >
        {result ? (
          result.status === 'calculated' ? (
            <>
              <strong>{result.cardiacOutputLMin!.toFixed(2)} L/min</strong> · {result.methodName}
            </>
          ) : (
            <>
              <strong>Result withheld</strong>
              <ul className={styles.fickFigureReasons} data-fick-withheld>
                {result.withheldReasons.map((reason) => (
                  <li key={reason}>{firstSentence(reason)}</li>
                ))}
              </ul>
            </>
          )
        ) : (
          <strong>Cardiac output, in L/min</strong>
        )}
      </div>
    </figure>
  )
}

/** The formula again with this episode's numbers in it, as far as the inputs allow. */
function PlacedFormula({
  result,
  inputs,
}: {
  readonly result: FickResult
  readonly inputs: (typeof FICK_EPISODES)[number]['inputs']
}) {
  const arterial = result.arterialOxygenContentMlDl
  const venous = result.mixedVenousOxygenContentMlDl
  const difference = result.contentDifferenceMlDl
  // Short names, so each step keeps to one line: "Mixed-venous content", "Central venous (superior
  // vena cava) content". The input above names the specimen in full.
  const short = fickVenousSpecimenWords(inputs.venousSampleSite).short
  const venousLabel = `${short.charAt(0).toUpperCase()}${short.slice(1)} content`
  if (arterial === null || venous === null || difference === null)
    return (
      <p data-fick-placed="not-computed">
        {/* The engine's own words for a calculation it cannot follow. */}
        {result.unitAccount[0]}
      </p>
    )
  const hemoglobin = roundTo(inputs.hemoglobinGDl!, 1)
  // Each line is equal or, where the rounded figures shown do not reproduce it, approximate.
  const subtracted = roundTo(arterial - venous, 2) === difference ? '=' : '≈'
  const vo2 = roundTo(inputs.vo2MlMin!, 0)
  const output = result.cardiacOutputLMin
  const divided =
    output !== null && roundTo(vo2 / (difference * DL_PER_L), 2) === output ? '=' : '≈'
  return (
    <ul className={styles.fickFigurePlaced} data-fick-placed="shown">
      <li>
        Arterial content: {BINDING} × {hemoglobin} ×{' '}
        {roundTo(inputs.arterialSaturationFraction!, 2)} = {arterial.toFixed(2)} mL/dL
      </li>
      <li>
        {venousLabel}: {BINDING} × {hemoglobin} ×{' '}
        {roundTo(inputs.mixedVenousSaturationFraction!, 2)} = {venous.toFixed(2)} mL/dL
      </li>
      <li>
        Difference: {arterial.toFixed(2)} − {venous.toFixed(2)} {subtracted} {difference.toFixed(2)}{' '}
        mL/dL
      </li>
      <li data-fick-division>
        {output === null
          ? result.unitAccount.at(-1)
          : `Cardiac output: ${vo2} ÷ (${difference.toFixed(2)} × ${DL_PER_L}) ${divided} ${output.toFixed(2)} L/min`}
      </li>
    </ul>
  )
}

function inputValue(id: (typeof INPUT_ROWS)[number], value: number | null, site: string) {
  if (id === 'venous-sample-site') return site
  if (value === null) return 'Not available'
  if (id === 'vo2') return `${roundTo(value, 0)} mL/min`
  if (id === 'hemoglobin') return `${roundTo(value, 1)} g/dL`
  return `${roundTo(value * 100, 0)}%`
}

/** A withheld reason's first sentence: the page beside the drawing gives the rest. */
function firstSentence(reason: string): string {
  const end = reason.search(/\.\s/)
  return end === -1 ? reason : reason.slice(0, end + 1)
}
