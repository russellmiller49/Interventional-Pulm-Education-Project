/**
 * Where the circuit meets the patient: one dual-lumen catheter in a large central vein.
 *
 * The circuit drawing shows the patient as a circle with an access lumen (A) and a return lumen
 * (V). This is the picture behind that circle, for the two sites drawn here. It states anatomy
 * and the direction of blood only: no site is ranked, no length or depth is given, and nothing
 * here is used by the simulation.
 */
export const CRRT_ACCESS_SITE_IDS = ['jugular', 'femoral'] as const
export type CrrtAccessSiteId = (typeof CRRT_ACCESS_SITE_IDS)[number]

/** Which lumen a walk stop is pointing at. */
export type CrrtAccessLumen = 'access' | 'return'

export interface CrrtAccessSiteLabel {
  readonly id: string
  readonly text: string
  /** The labelled point, in the drawing's own 150 × 235 frame. */
  readonly at: { readonly x: number; readonly y: number }
  /** The label's row in the label column, top to bottom. */
  readonly row: number
}

export interface CrrtAccessSite {
  readonly id: CrrtAccessSiteId
  /** The button and the caption. */
  readonly name: string
  /** The line printed in the circuit's inset. */
  readonly insetCaption: string
  /** One sentence on the route and where the tip lies. */
  readonly route: string
  readonly labels: readonly CrrtAccessSiteLabel[]
}

export const crrtAccessSites: Readonly<Record<CrrtAccessSiteId, CrrtAccessSite>> = {
  jugular: {
    id: 'jugular',
    name: 'Right internal jugular',
    insetCaption: 'RIGHT INTERNAL JUGULAR',
    route:
      'The catheter enters the right internal jugular vein low in the neck and runs down toward the heart. Its tip lies where the superior vena cava meets the right atrium.',
    labels: [
      { id: 'access-limb', text: 'Access limb (A): blood out', at: { x: 30, y: 22 }, row: 0 },
      { id: 'return-limb', text: 'Return limb (V): blood back', at: { x: 22, y: 40 }, row: 1 },
      { id: 'vein', text: 'Right internal jugular vein', at: { x: 61, y: 58 }, row: 2 },
      { id: 'svc', text: 'Superior vena cava', at: { x: 70, y: 124 }, row: 3 },
      { id: 'tip', text: 'Catheter tip', at: { x: 70, y: 150 }, row: 4 },
      { id: 'atrium', text: 'Right atrium', at: { x: 80, y: 176 }, row: 5 },
    ],
  },
  femoral: {
    id: 'femoral',
    name: 'Femoral',
    insetCaption: 'RIGHT FEMORAL',
    route:
      'The catheter enters the femoral vein below the inguinal ligament and runs up through the iliac vein. Its tip lies in the inferior vena cava.',
    labels: [
      { id: 'tip', text: 'Catheter tip', at: { x: 74, y: 30 }, row: 0 },
      { id: 'ivc', text: 'Inferior vena cava', at: { x: 75, y: 50 }, row: 1 },
      { id: 'iliac', text: 'Iliac vein', at: { x: 62, y: 98 }, row: 2 },
      { id: 'ligament', text: 'Inguinal ligament', at: { x: 44, y: 124 }, row: 3 },
      { id: 'vein', text: 'Right femoral vein', at: { x: 48, y: 200 }, row: 4 },
      { id: 'access-limb', text: 'Access limb (A): blood out', at: { x: 26, y: 190 }, row: 5 },
      { id: 'return-limb', text: 'Return limb (V): blood back', at: { x: 20, y: 208 }, row: 6 },
    ],
  },
}

/** What the picture says, for a reader who cannot see it. */
export function crrtAccessSiteTextEquivalent(site: CrrtAccessSiteId): string {
  const entry = crrtAccessSites[site]
  return `Access site, ${entry.name.toLowerCase()}: one catheter with two lumens in a central vein, drawn from the front with the patient's right on the left of the picture. ${entry.route} Blood leaves the patient through the access limb, marked A, and returns through the return limb, marked V.`
}

export const CRRT_ACCESS_SITE_SUMMARY =
  'One catheter with two lumens sits in a large central vein. Blood leaves the patient through the access lumen (A) and comes back through the return lumen (V).'

export const CRRT_ACCESS_TIP_CAPTION =
  'At the tip, inside the vein. The access openings are a short way back from the tip and the return opening is at the tip, so returned blood is carried on toward the heart.'
