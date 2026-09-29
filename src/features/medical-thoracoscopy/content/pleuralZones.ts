import { z } from 'zod'

import rawZones from './data/pleural-zones.json'
import { assertThoracoscopyCopy } from './learnerCopy'

/**
 * The survey zones: the regions of the parietal pleura of a right hemithorax that the course
 * names, and the order the survey visits them in.
 *
 * An authored construct. The division and the order are chosen for teaching; no source
 * prescribes them, and the learner is told so. The lessons and the anatomy asset read the same
 * file, so a region has one name and one boundary everywhere. How the asset divides the surface
 * is added to this file with the anatomy.
 */
export const PLEURAL_ZONE_IDS = [
  'diaphragm',
  'costophrenic-recess',
  'posterior-chest-wall',
  'apex',
  'anterior-chest-wall',
  'mediastinum',
  'lateral-chest-wall',
] as const

export type PleuralZoneId = (typeof PLEURAL_ZONE_IDS)[number]

const zoneSchema = z
  .object({
    id: z.enum(PLEURAL_ZONE_IDS),
    name: z.string().min(1),
    surveyOrder: z.number().int().positive(),
    /** Where it is, for the learner. */
    where: z.string().min(1),
    /** Its edges, precisely enough for the asset to divide the surface along them. */
    boundary: z.string().min(1),
    /** Why the survey takes it at this point in the order. */
    orderReason: z.string().min(1),
  })
  .strict()

const zoneListSchema = z
  .object({
    list: z.literal('medical-thoracoscopy-pleural-zones'),
    version: z.number().int().positive(),
    preparedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    preparedBy: z.string().min(1),
    statement: z.string().min(1),
    side: z.literal('right'),
    surface: z.literal('parietal pleura'),
    label: z.literal('Authored construct'),
    claimIds: z.array(z.string().regex(/^MT-C-\d{4}$/)).min(1),
    notTracked: z.string().min(1),
    zones: z.array(zoneSchema),
  })
  .strict()
  .superRefine((list, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message })
    const ids = list.zones.map((zone) => zone.id)
    if (ids.join() !== PLEURAL_ZONE_IDS.join()) issue('the zones are listed once each, in order')
    list.zones.forEach((zone, index) => {
      if (zone.surveyOrder !== index + 1) issue(`${zone.id} is number ${index + 1} in the order`)
    })
  })

export type PleuralZoneList = z.infer<typeof zoneListSchema>
export type PleuralZone = PleuralZoneList['zones'][number]

export const pleuralZoneList: PleuralZoneList = zoneListSchema.parse(rawZones)

export const pleuralZones: readonly PleuralZone[] = pleuralZoneList.zones

export function pleuralZone(id: PleuralZoneId): PleuralZone {
  const zone = pleuralZones.find((entry) => entry.id === id)
  if (!zone) throw new Error(`Unknown zone: ${id}`)
  return zone
}

export function isPleuralZoneId(value: unknown): value is PleuralZoneId {
  return typeof value === 'string' && (PLEURAL_ZONE_IDS as readonly string[]).includes(value)
}

assertThoracoscopyCopy([
  { where: 'zone list statement', text: pleuralZoneList.statement },
  { where: 'zone list, not tracked', text: pleuralZoneList.notTracked },
  ...pleuralZones.flatMap((zone) => [
    { where: `zone ${zone.id} name`, text: zone.name, options: { allowDigits: false } },
    { where: `zone ${zone.id} where`, text: zone.where },
    { where: `zone ${zone.id} boundary`, text: zone.boundary },
    { where: `zone ${zone.id} order reason`, text: zone.orderReason },
  ]),
])
