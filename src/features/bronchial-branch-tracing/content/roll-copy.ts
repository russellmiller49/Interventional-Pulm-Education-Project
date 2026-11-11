import type { BandTone } from '../components/Band'
import type { RollSummary, TurnVerdict } from '../engine/roll-drill'

/** Every sentence of "The scope has rolled". */
export const ROLL_TITLE = 'The scope has rolled'
export const ROLL_MINUTES = 6
export const ROLL_OBJECTIVE =
  'Turn your map to a picture that has rolled, from how it turned on the way in, then take the opening the map marks.'
export const ROLL_CONCEPT =
  'The map is drawn as the scope shows the segmental ostium. Past it the scope is rolled, by your hand and by the airway, and the picture turns with it. The airway does not turn. To read the map at a division, turn the map until it sits as the picture does, or roll the scope until the picture sits as the map does.'

export interface RollCard {
  heading: string
  body: string
  where?: string
}

export const rollStartCard = (bronchus: string, first: boolean): RollCard => ({
  heading: `At the ${bronchus} ostium, the map and the picture agree`,
  body: first
    ? `This is the map for this lesion, and the scope is looking into ${bronchus} as the map shows it: the directions on the picture’s rim are the map’s. From here on the scope arrives rolled and the rim says nothing.`
    : `A second route, and its own map. The scope is looking into ${bronchus} as the map shows it. From here on it arrives rolled.`,
  where: 'Bronchoscope panel and Map panel: compare the two, then drive in.',
})

export const rollDriveCard = (division: number): RollCard => ({
  heading: 'Watch the picture turn',
  body: `The scope is driving to division ${division}. Nothing is asked until it stops. Watch which way the picture turns on the way in: that is what tells you how to turn the map.`,
})

export const rollTurnCard = (division: number): RollCard => ({
  heading: 'Turn the map to the picture',
  body: `The scope has stopped at division ${division}, rolled, and its rim says nothing. Turn the map until its arcs sit as the openings do in the picture, then check.`,
  where: 'Map panel: Turn left and Turn right, under the map.',
})

export const rollChooseCard = (): RollCard => ({
  heading: 'Take the opening the map marks',
  body: 'The map now sits as the picture does. Its shaded branch is the way on toward the lesion: find that opening in the picture and take it.',
  where: 'Bronchoscope panel: click the opening’s number, or use the buttons here.',
})

export const rollReadyCard = (last: boolean, nextRoute: boolean): RollCard => ({
  heading: 'That is the opening',
  body: last
    ? 'The map, turned to the picture, gave you the branch at every division.'
    : nextRoute
      ? 'The map, turned to the picture, gave you the branch. That is the end of this route; the next has its own map.'
      : 'The map, turned to the picture, gave you the branch. The scope will roll again on the way to the next division.',
})

export function rollTurnVerdict(verdict: Exclude<TurnVerdict, 'fits'>): {
  tone: BandTone
  headline: string
  detail: string
} {
  if (verdict === 'half')
    return {
      tone: 'near',
      headline: 'A half turn out.',
      detail:
        'The carina lines up, but each opening is on the other side. A carina looks the same either way up, so the picture at rest cannot settle it: how it turned on the way in does. Watch the drive in again if you need to.',
    }
  if (verdict === 'quarter')
    return {
      tone: 'miss',
      headline: 'A quarter turn out.',
      detail:
        'The map’s arcs lie across the openings. Turn the map until the line between its branches runs the way the carina does in the picture.',
    }
  return {
    tone: 'miss',
    headline: 'Not yet.',
    detail:
      'The map sits between two fits. Turn it another step and compare the arcs with the openings again.',
  }
}

export const ROLL_TURN_FITS = {
  tone: 'in' as BandTone,
  headline: 'The map sits as the picture does.',
  detail: 'Read the way on from the map.',
}
export const ROLL_TURN_SHOWN = {
  tone: 'near' as BandTone,
  headline: 'The map has been turned for you.',
  detail: 'Compare its arcs with the openings before you choose.',
}
export const ROLL_CHOICE_DECLINED = {
  tone: 'miss' as BandTone,
  headline: 'That opening leads away.',
  detail:
    'On the map as it is turned, the shaded branch is not on that side. Find the shaded branch’s side on the map, then the same side in the picture.',
}

/** "Map turned 90° clockwise." The map's turn in words, for the readout under it. */
export function mapTurnReadout(degrees: number): string {
  const turn = ((degrees % 360) + 360) % 360
  if (turn === 0) return 'The map sits as it was drawn.'
  if (turn === 180) return 'Map turned a half turn.'
  return turn < 180
    ? `Map turned ${turn}° clockwise.`
    : `Map turned ${360 - turn}° counterclockwise.`
}

export function rollSummaryLines(summary: RollSummary): string[] {
  return [
    `Map turned to the picture at the first check: ${summary.turn.firstTry} of ${summary.turn.asked}.`,
    `Opening taken at the first choice: ${summary.choose.firstTry} of ${summary.choose.asked}.`,
  ]
}
export const ROLL_CLOSING =
  'A carina by itself fixes the map only to a half turn. What the picture did on the way in settles which way, so keep track of the turn as you advance.'
