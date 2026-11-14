import { needleGeometry, type NeedleState } from '../../../../../../src/lib/ebus-model-contract'
import {
  needlePictureAlt,
  needlePictureStatus,
  needlePictureUri,
  needleWithinNode,
} from '../../../../../../src/lib/ebus-needle-picture'

/*
 * The needle lab's ultrasound pane (rebuild of 2026-11-11): the simulated sector, a line saying
 * what it shows of the needle, and what the learner's last movement did. The picture itself is
 * drawn in `src/lib/ebus-needle-picture.ts`, which the lesson page also uses.
 */
export function NeedleUltrasound({
  state: s,
  reveal,
  locked,
}: {
  state: NeedleState
  reveal: boolean
  locked: boolean
}) {
  const g = needleGeometry(s)
  return (
    <section
      className="model-image needle-ultrasound"
      data-needle-tip={g.tipVisible ? 'seen' : s.extension > 1 ? 'lost' : 'sheathed'}
    >
      <h2>Ultrasound · simulated</h2>
      <img className="needle-picture" src={needlePictureUri(s, { reveal })} alt={needlePictureAlt(s)} />
      <p className="needle-status" role="status" data-needle-status>
        {needlePictureStatus(s)}
        {!s.removed && s.extension > 0 && (
          <>
            {' '}
            Needle out {s.extension} mm{needleWithinNode(s) ? ', within the node.' : '.'}
          </>
        )}
      </p>
      {/* What the last movement did, said beside the picture the learner is watching. */}
      {s.notice && !locked && (
        <p role="status" className="model-feedback" data-needle-notice>
          {s.notice}
        </p>
      )}
    </section>
  )
}
