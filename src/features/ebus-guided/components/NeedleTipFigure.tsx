import { initialModelState, modelReducer, type NeedleState } from '@/lib/ebus-model-contract'
import { needlePictureAlt, needlePictureUri } from '@/lib/ebus-needle-picture'
import styles from './needle-tip-figure.module.css'

/*
 * The two pictures the needle lab is about, side by side (2026-11-11): the needle at the stop with
 * its tip in the image, and the same needle after the scope has turned a few degrees. They are the
 * lab's own picture, drawn from the same model in the same two states the learner made, with the
 * true tip marked. The lab itself ends with the assembly out of the scope, so the learner's last
 * picture has no needle in it to explain anything on.
 */
const AT_STOP = [
  { type: 'sheath', value: 1 },
  { type: 'secure' },
  { type: 'stop', value: 19 },
  { type: 'needle', value: 19 },
].reduce(
  (state, action) => modelReducer(state, action) as NeedleState,
  initialModelState('needle') as NeedleState,
)
const TURNED = modelReducer(AT_STOP, { type: 'rotate', value: 6 }) as NeedleState
/** The tip marked, and the lab's depth scale left off: these two are read, not measured. */
const PLAIN = { reveal: true, scale: false }

export function NeedleTipFigure() {
  return (
    <div className={styles.figure} data-needle-tip-figure>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={needlePictureUri(AT_STOP, PLAIN)} alt={needlePictureAlt(AT_STOP)} />
        <figcaption>
          <strong>Tip in the image.</strong> The line ends at the tip, at the stop.
        </figcaption>
      </figure>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={needlePictureUri(TURNED, PLAIN)} alt={needlePictureAlt(TURNED)} />
        <figcaption>
          <strong>Scope turned a few degrees.</strong> The needle has not moved. The line now ends
          short of the tip, which is out of the image.
        </figcaption>
      </figure>
    </div>
  )
}
