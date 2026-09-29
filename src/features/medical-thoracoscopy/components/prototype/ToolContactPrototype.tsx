'use client'

import { useState } from 'react'

import { assertThoracoscopyCopy } from '../../content/learnerCopy'
import { contactRule, type ContactPart } from '../../engine/space/contactPolicy'
import {
  currentToolContact,
  teachingTarget,
  type CurrentToolContact,
  type ToolContactPlace,
} from '../../engine/space/teachingTarget'
import styles from '../space/space-pane.module.css'
import { SpacePane } from '../space/SpacePane'
import { DEPTH_WORDS, PIVOT_WORDS, TOOL_WORDS } from '../space/spaceWords'
import type { PivotHandDirection, SpaceToolState } from '../space/types'
import { packagedSpaceLoader, useSpaceEngine, type SpaceEngineStart } from '../space/useSpaceEngine'
import { useReducedMotion } from '../space/useSpaceSupport'
import { PROTOTYPE_WORDS } from './SpacePrototype'

/**
 * The tool-contact spike (slice 13; plan, section 4.7): an engineering prototype, outside the
 * curriculum and the progress record, that records nothing. The forceps in the telescope's channel,
 * and one illustrative nodule. It shows that one table of contact serves moving about the space and
 * touching a target: the jaws reach the nodule while the telescope is kept clear of it, a pivot that
 * would sweep the forceps through the lung is refused with the part named, and once the forceps are
 * back in the channel the telescope moves as it did before.
 *
 * The nodule and the two places to start from come from the record the build script computed on the
 * proxies. With the lung the model has now, the lung lies in front of every line the port allows, so
 * the record sets the nodule on the lung's surface rather than the chest wall, and the page says so.
 * Not a biopsy lesson: no effect on tissue is shown, and nothing here has been clinically reviewed.
 * `taking-biopsies` stays in preparation.
 */
const CONTACT = currentToolContact()
const LOAD = CONTACT
  ? packagedSpaceLoader({
      target: teachingTarget(CONTACT.nodule.centre, CONTACT.nodule.radiusMm),
    })
  : null

export const TOOL_CONTACT_WORDS = {
  heading: 'Tool contact: engineering prototype',
  purpose:
    'This page shows one rule of the model at work: which part of the instruments may touch what. One table of contact stops the telescope as it moves about the space, and lets the jaws of the forceps, and nothing else, touch a target that has been authorised. It is not a biopsy lesson, no effect on tissue is shown, it records nothing, and nothing on it has been clinically reviewed.',
  onLung:
    'The nodule is illustrative. The plan puts it on the pleura of the chest wall, but with the lung as this model has it, the lung lies in front of every line the port allows, so nothing on the chest wall can be reached along the telescope. On this page the nodule sits on the lung’s surface instead. Nothing here says that a nodule there should be sampled.',
  onWall:
    'The nodule is illustrative, set on the pleura of the chest wall for this page. Nothing about its size, its look or where it sits is a clinical statement.',
  unavailable:
    'The nodule and the places to start from were worked out for another version of the anatomy, the instruments or the port, so there is nothing to show until they are worked out again.',
  placesHeading: 'Where to start',
  placesNote: 'Each starts the model afresh there, with the forceps in the channel.',
  facing: 'Facing the nodule',
  beside: 'Beside the lung',
  tryHeading: 'What to try',
  tryNote:
    'The buttons are in the pane’s Controls of the model; the keys do the same while the pane has focus.',
  tableHeading: 'What may touch the nodule now',
  tableCaption:
    'Read from the table of contact for the forceps as they are now. These are rules of the model, not statements about clinical safety.',
  partColumn: 'Part',
  ruleColumn: 'Against the nodule',
  mayTouch: 'May touch',
  keptClear: 'Kept clear',
} as const

const PART_NAMES: readonly { readonly part: ContactPart; readonly name: string }[] = [
  { part: 'sleeve', name: 'Sleeve' },
  { part: 'telescope', name: 'Telescope' },
  { part: 'tool-shaft', name: 'Forceps’ shaft' },
  { part: 'working-element', name: 'Forceps’ jaws' },
]

/** The four things to try, in order, naming the buttons as the dock prints them. */
export function tryWords(hand: PivotHandDirection): readonly string[] {
  const { facing, beside } = TOOL_CONTACT_WORDS
  return [
    `${facing}: press “${DEPTH_WORDS.in}” under Depth until the telescope stops. It is kept clear of the nodule, and what stopped it is named.`,
    `Press “${DEPTH_WORDS.out}” three times, then “${TOOL_WORDS.extend}” until the forceps stop: their jaws touch the nodule, the one contact the table allows. Press “${DEPTH_WORDS.in}” again: it is refused, since the jaws may touch the nodule but never go into it.`,
    `${beside}: press “${TOOL_WORDS.extend}” until the forceps stop, then “${PIVOT_WORDS[hand]}” under Pivot: the pivot is refused, and the part of the forceps that meets the lung is named.`,
    `Press “${TOOL_WORDS.retract}” until the forceps are back in the channel, then “${PIVOT_WORDS[hand]}” again: the telescope moves as it would with no forceps. Facing the nodule again, the telescope stops at it as it did before.`,
  ]
}

assertThoracoscopyCopy([
  ...Object.entries(TOOL_CONTACT_WORDS).map(([key, text]) => ({
    where: `tool contact ${key}`,
    text,
    options: { allowDigits: false },
  })),
  ...PART_NAMES.map(({ part, name }) => ({
    where: `tool contact part ${part}`,
    text: name,
    options: { allowDigits: false },
  })),
  ...(['head', 'feet', 'front', 'back'] as const).flatMap((hand) =>
    tryWords(hand).map((text, index) => ({
      where: `tool contact try ${hand} ${index}`,
      text,
      options: { allowDigits: false },
    })),
  ),
])

function startOf(contact: CurrentToolContact, place: ToolContactPlace): SpaceEngineStart {
  return {
    scenario: `tool-contact:${place.id}`,
    pose: place.pose,
    lungStep: place.lungStep,
    tool: { authorised: true },
    target: contact.geometry,
  }
}

export function ToolContactPrototype() {
  const reducedMotion = useReducedMotion()
  const [drawIn3d, setDrawIn3d] = useState(true)
  return (
    <section className={styles.prototype} aria-labelledby="tool-contact-heading">
      <h1 id="tool-contact-heading">{TOOL_CONTACT_WORDS.heading}</h1>
      <p>{TOOL_CONTACT_WORDS.purpose}</p>
      {CONTACT && LOAD ? (
        <>
          <p data-nodule-on={CONTACT.nodule.on}>
            {CONTACT.nodule.on === 'lung-surface'
              ? TOOL_CONTACT_WORDS.onLung
              : TOOL_CONTACT_WORDS.onWall}
          </p>
          <div className={styles.prototypeControls}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setDrawIn3d((value) => !value)}
              aria-pressed={!drawIn3d}
            >
              {drawIn3d ? PROTOTYPE_WORDS.drawAsCut : PROTOTYPE_WORDS.drawIn3d}
            </button>
          </div>
          <ContactRun
            contact={CONTACT}
            load={LOAD}
            reducedMotion={reducedMotion}
            drawIn3d={drawIn3d}
          />
        </>
      ) : (
        <p role="status">{TOOL_CONTACT_WORDS.unavailable}</p>
      )}
    </section>
  )
}

export function ContactRun({
  contact,
  load,
  reducedMotion,
  drawIn3d,
}: {
  readonly contact: CurrentToolContact
  readonly load: NonNullable<Parameters<typeof useSpaceEngine>[1]['load']>
  readonly reducedMotion: boolean
  readonly drawIn3d: boolean
}) {
  const facing = contact.places.find((place) => place.id === 'facing-the-nodule')
  const beside = contact.places.find((place) => place.id === 'beside-the-lung')
  if (!facing || !beside) throw new Error('The tool-contact record needs both places')
  const [place, setPlace] = useState<ToolContactPlace['id']>('facing-the-nodule')
  const session = useSpaceEngine(startOf(contact, facing), { reducedMotion, load })
  const { paneState } = session
  const ready = paneState.readiness.kind === 'ready'
  const goTo = (next: ToolContactPlace) => {
    setPlace(next.id)
    session.restart(startOf(contact, next))
  }
  return (
    <>
      <section aria-labelledby="tool-contact-places" data-place={place}>
        <h2 id="tool-contact-places">{TOOL_CONTACT_WORDS.placesHeading}</h2>
        <p className={styles.viewNote}>{TOOL_CONTACT_WORDS.placesNote}</p>
        <div className={styles.prototypeControls}>
          {[facing, beside].map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.actionButton}
              disabled={!ready}
              aria-pressed={place === entry.id}
              data-place-button={entry.id}
              onClick={() => goTo(entry)}
            >
              {entry.id === 'facing-the-nodule'
                ? TOOL_CONTACT_WORDS.facing
                : TOOL_CONTACT_WORDS.beside}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="tool-contact-try">
        <h2 id="tool-contact-try">{TOOL_CONTACT_WORDS.tryHeading}</h2>
        <p className={styles.viewNote}>{TOOL_CONTACT_WORDS.tryNote}</p>
        <ol className={styles.tryList}>
          {tryWords(contact.towardTheLung).map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
      </section>
      <ContactTable tool={paneState.tool} />
      <SpacePane
        state={paneState}
        space={session.space}
        shown={['scope', 'tool']}
        operable={['scope', 'tool']}
        reducedMotion={reducedMotion}
        onCommand={session.onCommand}
        drawIn3d={drawIn3d}
      />
    </>
  )
}

/** The table of contact's rows for the nodule, for the forceps as they are now. */
export function ContactTable({ tool }: { readonly tool: SpaceToolState | undefined }) {
  const phase = tool?.phase ?? 'in-channel'
  const authorisation = tool?.authorised ? 'authorised' : 'not-authorised'
  return (
    <section aria-labelledby="tool-contact-table">
      <h2 id="tool-contact-table">{TOOL_CONTACT_WORDS.tableHeading}</h2>
      <table className={styles.keyTable} data-tool-phase={phase}>
        <caption className={styles.ledgerCaption}>{TOOL_CONTACT_WORDS.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{TOOL_CONTACT_WORDS.partColumn}</th>
            <th scope="col">{TOOL_CONTACT_WORDS.ruleColumn}</th>
          </tr>
        </thead>
        <tbody>
          {PART_NAMES.map(({ part, name }) => {
            const rule = contactRule(part, 'teaching-target', phase, authorisation)
            return (
              <tr key={part} data-part={part} data-rule={rule}>
                <th scope="row">{name}</th>
                <td>
                  {rule === 'may-touch'
                    ? TOOL_CONTACT_WORDS.mayTouch
                    : TOOL_CONTACT_WORDS.keptClear}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
