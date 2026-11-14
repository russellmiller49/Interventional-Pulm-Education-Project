import type { InstrumentClips } from './InstrumentLab'
import type { InstrumentId } from './instrument-model'

/**
 * Clips of the real devices, filmed by the site owner on the bench and supplied for teaching
 * (2026-11-03). Muted, trimmed and re-encoded from the originals; nothing else is in them.
 */
const CLIP_BASE = '/bronchoscopy-instruments/clips'

const clip = (name: string, caption: string) => ({
  src: `${CLIP_BASE}/${name}.mp4`,
  poster: `${CLIP_BASE}/${name}.jpg`,
  caption,
})

export const INSTRUMENT_CLIPS: Readonly<Record<InstrumentId, InstrumentClips>> = {
  forceps: {
    hand: clip(
      'forceps-hand',
      'In the hand: the spool pushed away from the thumb ring opens the cups; pulled back, it closes them.',
    ),
    tip: clip(
      'forceps-tip',
      'At the tip: the closed cups leave the channel, clear the tip, open, and close again.',
    ),
  },
  brush: {
    hand: clip(
      'brush-hand',
      'In the hand: the plunger pushed toward the thumb ring puts the brush out; pulled back, it sheathes it.',
    ),
    tip: clip(
      'brush-tip',
      'At the tip: the sheath clears the tip, the brush comes out of it, and goes back in before the sheath withdraws.',
    ),
  },
  needle: {
    hand: clip(
      'needle-hand',
      'In the hand: the hub drives the needle out, a syringe on the side port gives suction, and the stylet goes back in at the end.',
    ),
    tip: clip(
      'needle-tip',
      'At the tip: the catheter clears the tip with the needle inside, the needle comes out, and goes back in before withdrawal.',
    ),
  },
}
