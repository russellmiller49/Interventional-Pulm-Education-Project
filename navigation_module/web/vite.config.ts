import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCOPE_CALIBRATION_SCHEMA = 'bronchoedu_scope_calibration/v1'
const DEFAULT_SCOPE_VIEW_PROFILE = 'flexible'
const SCOPE_VIEW_PROFILE_IDS = ['flexible', 'robotic'] as const
const SCOPE_VIEW_PROFILE_LABELS = {
  flexible: 'Flexible',
  robotic: 'Robotic',
} as const
const scopeCalibrationPath = fileURLToPath(
  new URL('./public/cases/default/scope_calibration.json', import.meta.url),
)
const enableScopeDebug = process.env.VITE_ENABLE_SCOPE_DEBUG === 'true'
const appBasePath = normalizeBasePath(process.env.VITE_BASE_PATH)

export default defineConfig({
  resolve: {
    alias: {
      '@bronchoscopy-core': fileURLToPath(
        new URL('../../src/lib/bronchoscopy-core', import.meta.url),
      ),
    },
  },
  worker: { format: 'es' },
  base: appBasePath,
  css: { postcss: { plugins: [] } },
  plugins: [
    react(),
    sharedNativeCt(),
    scopeCalibrationWriter('/__scope_calibration'),
    scopeCalibrationWriter('/api/scope-calibration'),
  ],
  define: {
    __APP_BASE_PATH__: JSON.stringify(appBasePath),
    __ENABLE_SCOPE_DEBUG__: JSON.stringify(enableScopeDebug),
  },
  server: {
    fs: {
      strict: true,
      allow: [fileURLToPath(new URL('../../', import.meta.url))],
    },
  },
})

// The standalone development app reads the same generated CT bricks as the
// integrated app; it never copies or edits the original medical inputs.
function sharedNativeCt() {
  return {
    name: 'shared-native-ct',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = /^\/airway-anatomy\/case-001\/ct\/native-v1\/(\d+-\d+-\d+\.i16\.gz)$/.exec(
          (req.url ?? '').split('?')[0],
        )
        if (!match || !['GET', 'HEAD'].includes(req.method ?? '')) return next()
        const path = fileURLToPath(
          new URL(`../../public/airway-anatomy/case-001/ct/native-v1/${match[1]}`, import.meta.url),
        )
        try {
          const info = await stat(path)
          res.setHeader('Content-Type', 'application/gzip')
          res.setHeader('Content-Length', info.size)
          if (req.method === 'HEAD') res.end()
          else createReadStream(path).pipe(res)
        } catch {
          res.statusCode = 404
          res.end()
        }
      })
    },
  }
}

function normalizeBasePath(value: string | undefined) {
  if (!value) {
    return '/'
  }
  return value.endsWith('/') ? value : `${value}/`
}

function scopeCalibrationWriter(endpoint: string) {
  return {
    name: `scope-calibration-writer:${endpoint}`,
    configureServer(server) {
      server.middlewares.use(endpoint, async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end('method not allowed')
          return
        }

        try {
          const body = await readJsonBody(request)
          const nodeId = typeof body.nodeId === 'string' ? body.nodeId : ''
          if (!/^\d+$/.test(nodeId)) {
            response.statusCode = 400
            response.end('nodeId must be a numeric string')
            return
          }

          const payload = await readScopeCalibration()
          const profileId = parseScopeViewProfileId(body.profileId) ?? DEFAULT_SCOPE_VIEW_PROFILE
          const profile = payload.profiles[profileId]
          payload.caseId = typeof body.caseId === 'string' ? body.caseId : payload.caseId
          payload.updatedAt = new Date().toISOString()
          if (body.adjustment === null) {
            delete profile.adjustments[nodeId]
          } else if (isRecord(body.adjustment)) {
            profile.adjustments[nodeId] = body.adjustment
          } else {
            response.statusCode = 400
            response.end('adjustment must be an object or null')
            return
          }
          payload.adjustments = payload.profiles[payload.defaultProfile]?.adjustments ?? {}

          await mkdir(dirname(scopeCalibrationPath), { recursive: true })
          await writeFile(scopeCalibrationPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify({ ok: true, path: '/cases/default/scope_calibration.json', profileId }),
          )
        } catch (error) {
          response.statusCode = 500
          response.end(error instanceof Error ? error.message : String(error))
        }
      })
    },
  }
}

async function readScopeCalibration() {
  try {
    const parsed = JSON.parse(await readFile(scopeCalibrationPath, 'utf8'))
    if (isRecord(parsed)) {
      return normalizeScopeCalibrationPayload(parsed)
    }
  } catch {
    // Fall through to a fresh calibration file.
  }
  return {
    schema: SCOPE_CALIBRATION_SCHEMA,
    caseId: 'synthetic-target',
    defaultProfile: DEFAULT_SCOPE_VIEW_PROFILE,
    profiles: freshScopeCalibrationProfiles({}),
    adjustments: {},
  }
}

function normalizeScopeCalibrationPayload(parsed: Record<string, unknown>) {
  const legacyAdjustments = isRecord(parsed.adjustments) ? parsed.adjustments : {}
  const defaultProfile =
    parseScopeViewProfileId(parsed.defaultProfile) ?? DEFAULT_SCOPE_VIEW_PROFILE
  const payload = {
    ...parsed,
    schema: SCOPE_CALIBRATION_SCHEMA,
    defaultProfile,
    profiles: normalizeScopeCalibrationProfiles(parsed.profiles, legacyAdjustments),
    adjustments: {},
  }
  payload.adjustments = payload.profiles[payload.defaultProfile]?.adjustments ?? {}
  return payload
}

function normalizeScopeCalibrationProfiles(
  rawProfiles: unknown,
  legacyAdjustments: Record<string, unknown>,
) {
  const profiles = freshScopeCalibrationProfiles(legacyAdjustments)
  if (!isRecord(rawProfiles)) {
    return profiles
  }
  for (const profileId of SCOPE_VIEW_PROFILE_IDS) {
    const rawProfile = rawProfiles[profileId]
    if (!isRecord(rawProfile)) {
      continue
    }
    profiles[profileId] = {
      ...profiles[profileId],
      ...rawProfile,
      label:
        typeof rawProfile.label === 'string'
          ? rawProfile.label
          : SCOPE_VIEW_PROFILE_LABELS[profileId],
      adjustments: isRecord(rawProfile.adjustments)
        ? rawProfile.adjustments
        : cloneRecord(legacyAdjustments),
    }
  }
  return profiles
}

function freshScopeCalibrationProfiles(adjustments: Record<string, unknown>) {
  return {
    flexible: {
      label: SCOPE_VIEW_PROFILE_LABELS.flexible,
      description: 'Default flexible bronchoscopy view orientation.',
      adjustments: cloneRecord(adjustments),
    },
    robotic: {
      label: SCOPE_VIEW_PROFILE_LABELS.robotic,
      description: 'Preserved robotic bronchoscopy-style view orientation.',
      adjustments: cloneRecord(adjustments),
    },
  }
}

function parseScopeViewProfileId(value: unknown): (typeof SCOPE_VIEW_PROFILE_IDS)[number] | null {
  return value === 'flexible' || value === 'robotic' ? value : null
}

function cloneRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function readJsonBody(
  request: import('node:http').IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    request.on('error', reject)
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        const parsed = JSON.parse(raw || '{}')
        resolve(isRecord(parsed) ? parsed : {})
      } catch (error) {
        reject(error)
      }
    })
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
