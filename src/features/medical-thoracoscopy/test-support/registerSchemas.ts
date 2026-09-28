import { z } from 'zod'

import { reviewDecisionSchema, statusWordSchema } from '../content/reviewRecords'

/**
 * Shapes of the registers that are kept for reviewers and are not read by the running course:
 * rights, assets, performance and traceability. The registers the course does read have their
 * schemas beside them in `content/`.
 */
const isoDate = /^\d{4}-\d{2}-\d{2}$/

const header = {
  version: z.number().int().positive(),
  preparedOn: z.string().regex(isoDate),
  preparedBy: z.string().min(1),
  statement: z.string().min(1),
}

export const rightsRegisterSchema = z
  .object({
    register: z.literal('medical-thoracoscopy-rights'),
    ...header,
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^R-[A-Z]+(-[A-Z]+)*$/),
            what: z.string().min(1),
            holder: z.string().min(1),
            terms: z.string().min(1),
            termsSource: z.string().min(1),
            permits: z.string().min(1),
            requires: z.array(z.string().min(1)),
            use: z.string().min(1),
            heldAt: z.string().min(1),
            inRepository: z.boolean(),
            status: statusWordSchema,
            openQuestion: z.string().min(1),
            blocksUpload: z.boolean(),
            decision: reviewDecisionSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export const assetLedgerSchema = z
  .object({
    ledger: z.literal('medical-thoracoscopy-assets'),
    ...header,
    budgets: z
      .object({
        source: z.string().min(1),
        pleuralScenePayloadMb: z.number().positive(),
        anatomyGlbMb: z.number().positive(),
        deviceGlbMb: z.number().positive(),
        deviceGlbTriangles: z.number().int().positive(),
        textureEdgePx: z.number().int().positive(),
        renderedTrianglesHigh: z.number().int().positive(),
        renderedTrianglesLow: z.number().int().positive(),
        drawCalls: z.number().int().positive(),
        collisionProxyTriangles: z.number().int().positive(),
        coverageUpdateMs: z.number().positive(),
      })
      .strict(),
    accounting: z
      .object({
        pleuralScenePayload: z.string().min(1),
        excluded: z.string().min(1),
        cacheAssumption: z.string().min(1),
      })
      .strict(),
    assets: z.array(
      z
        .object({
          id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          kind: z.enum(['device', 'anatomy', 'proxy', 'data', 'texture', 'manifest']),
          path: z.string().regex(/^public\/models\/medical-thoracoscopy\//),
          sha256: z.string().regex(/^[0-9a-f]{64}$/),
          bytes: z.number().int().positive(),
          triangles: z.number().int().nonnegative().nullable(),
          decodedBytes: z.number().int().positive().nullable(),
          label: z.string().min(1),
          rights: z.array(z.string().regex(/^R-[A-Z]+(-[A-Z]+)*$/)).min(1),
          claims: z.array(z.string().regex(/^MT-C-\d{4}$/)),
          definitionSha256: z
            .string()
            .regex(/^[0-9a-f]{64}$/)
            .nullable(),
          builtBy: z.string().min(1),
          uploaded: z.boolean(),
        })
        .strict(),
    ),
    scenes: z.array(
      z
        .object({
          id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          assets: z.array(z.string().min(1)).min(1),
          coldTransferBytes: z.number().int().positive(),
          sharedRuntimeBytes: z.number().int().nonnegative(),
          decodedBytes: z.number().int().positive().nullable(),
          drawCalls: z.number().int().positive().nullable(),
          renderedTriangles: z.number().int().positive().nullable(),
        })
        .strict(),
    ),
  })
  .strict()

const PERFORMANCE_RESULTS = ['NOT TESTED', 'met', 'not met'] as const

export const performanceTableSchema = z
  .object({
    table: z.literal('medical-thoracoscopy-performance'),
    ...header,
    targets: z
      .array(
        z
          .object({
            id: z.string().regex(/^PT-\d+$/),
            target: z.string().min(1),
            hardware: z.string().min(1),
            quality: z.string().min(1),
            browser: z.string().min(1),
            viewport: z.string().min(1),
            network: z.string().min(1),
            cache: z.string().min(1),
            scene: z.string().min(1),
            source: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    whatEachMeasurementRecords: z.array(z.string().min(1)).min(1),
    results: z.array(
      z
        .object({
          target: z.string().regex(/^PT-\d+$/),
          result: z.enum(PERFORMANCE_RESULTS),
          reason: z.string().min(1).optional(),
          measurement: z
            .object({
              date: z.string().regex(isoDate),
              ranBy: z.string().min(1),
              device: z.string().min(1),
              operatingSystem: z.string().min(1),
              browser: z.string().min(1),
              viewport: z.string().min(1),
              quality: z.string().min(1),
              network: z.string().min(1),
              cache: z.string().min(1),
              scene: z.string().min(1),
              commit: z.string().regex(/^[0-9a-f]{7,40}$/),
              assetManifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
              emulated: z.boolean(),
              medianFrameMs: z.number().positive().nullable(),
              p95FrameMs: z.number().positive().nullable(),
              p99FrameMs: z.number().positive().nullable(),
              durationSeconds: z.number().positive().nullable(),
              timeToInteractiveMs: z.number().positive().nullable(),
              memoryAfterLoadBytes: z.number().int().positive().nullable(),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
    otherMeasurements: z.array(z.unknown()),
  })
  .strict()

const LINKS = ['content', 'assets', 'tests', 'review decisions', 'release evidence'] as const

export const traceabilitySchema = z
  .object({
    register: z.literal('medical-thoracoscopy-traceability'),
    ...header,
    rows: z
      .array(
        z
          .object({
            experience: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
            kind: z.enum(['section', 'practice', 'case', 'prototype']),
            number: z.number().int().positive().nullable(),
            outcome: z.string().min(1),
            state: z.enum(['planned', 'written', 'complete']),
            content: z.array(z.string().min(1)),
            claims: z.array(z.string().regex(/^MT-C-\d{4}$/)),
            assets: z.array(z.string().min(1)),
            tests: z.array(z.string().min(1)),
            reviewDecisions: z.array(z.string().min(1)),
            releaseEvidence: z.array(z.string().min(1)),
            missing: z.array(z.enum(LINKS)),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export type RightsRegister = z.infer<typeof rightsRegisterSchema>
export type AssetLedger = z.infer<typeof assetLedgerSchema>
export type PerformanceTable = z.infer<typeof performanceTableSchema>
export type Traceability = z.infer<typeof traceabilitySchema>
