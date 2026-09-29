import { z } from 'zod'

import rawMeasurements from './data/reference-measurements.json'

/**
 * The measurements of the manufacturer's reference frames, written by
 * `scripts/medical-thoracoscopy/measure_reference_frames.py`. Numbers only: no image, crop or
 * overlay of a frame is kept in the repository.
 *
 * Every value is a derived measurement. Its tolerance is how far it moved when each assumption of
 * the fit was varied, plus one pixel. The device definitions copy the values they use and name the
 * entries they came from; a test holds the two together. No course page imports this file.
 */
const sha256 = z.string().regex(/^[0-9a-f]{64}$/)

const measurementBase = {
  id: z.string().regex(/^[a-z]+\.[a-z][A-Za-z]*$/),
  frame: z.number().int().positive(),
  quantity: z.string().min(1),
  unit: z.enum(['mm', 'deg', 'inner wall radius']),
  tolerance: z.number().nonnegative(),
  method: z.string().min(1),
}

const measurementSchema = z.union([
  z.object({ ...measurementBase, value: z.number() }).strict(),
  z
    .object({
      ...measurementBase,
      points: z.array(z.tuple([z.number(), z.number()])).min(2),
    })
    .strict(),
])

export const referenceMeasurementsSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-reference-measurements'),
    version: z.number().int().positive(),
    measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    measuredBy: z.literal('scripts/medical-thoracoscopy/measure_reference_frames.py'),
    statement: z.string().min(1),
    document: z.object({ id: z.literal('S-FRAMES'), sha256 }).strict(),
    publishedValuesUsed: z.record(z.string(), z.number()),
    variations: z.record(z.string().regex(/^\d+$/), z.array(z.string().min(1)).min(1)),
    frames: z
      .array(
        z
          .object({
            frame: z.number().int().positive(),
            part: z.string().regex(/^ppt\/media\/image\d+\.png$/),
            sha256,
            widthPx: z.number().int().positive(),
            heightPx: z.number().int().positive(),
            shows: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    cameras: z.array(
      z
        .object({
          frame: z.number().int().positive(),
          principalPointPx: z.tuple([z.number(), z.number()]),
          focalPx: z.number().positive(),
          tipDepthMm: z.number().positive().optional(),
          shaftTiltDeg: z.number(),
          rollDeg: z.number().optional(),
        })
        .strict(),
    ),
    measurements: z.array(measurementSchema).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message })
    const frames = new Set(record.frames.map((frame) => frame.frame))
    const ids = record.measurements.map((entry) => entry.id)
    if (new Set(ids).size !== ids.length) issue('measurement ids are unique')
    for (const entry of record.measurements) {
      if (!frames.has(entry.frame)) issue(`${entry.id}: frame ${entry.frame} is not listed`)
      if (!record.variations[String(entry.frame)]) {
        issue(`${entry.id}: frame ${entry.frame} lists no variations`)
      }
    }
  })

export type ReferenceMeasurements = z.infer<typeof referenceMeasurementsSchema>
export type ReferenceMeasurement = ReferenceMeasurements['measurements'][number]

export const referenceMeasurements: ReferenceMeasurements =
  referenceMeasurementsSchema.parse(rawMeasurements)

export function measurementById(id: string): ReferenceMeasurement {
  const entry = referenceMeasurements.measurements.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`Unknown measurement: ${id}`)
  return entry
}
