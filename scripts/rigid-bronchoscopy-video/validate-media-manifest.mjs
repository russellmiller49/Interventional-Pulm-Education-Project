#!/usr/bin/env node
/**
 * Validate the rigid-bronchoscopy-techniques Higgsfield generation-history
 * manifest. Runnable today: with everything "planned" it passes and asserts
 * that no media/generationId has been fabricated. As shots are generated,
 * downloaded, and approved it enforces that the corresponding files exist.
 *
 * Usage: node scripts/rigid-bronchoscopy-video/validate-media-manifest.mjs
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const moduleRoot = resolve(
  repoRoot,
  'public/module-assets/v1/rigid-bronchoscopy-techniques',
)
const manifestPath = resolve(moduleRoot, 'manifest/generation-history.json')

const VALID_STATUS = new Set(['planned', 'submitted', 'downloaded', 'approved', 'rejected'])
const VALID_REVIEW = new Set([
  'planned',
  'generated-draft',
  'faculty-review',
  'revision-required',
  'approved',
  'rejected',
])
const REQUIRED_KEYS = [
  'shotId',
  'lessonId',
  'status',
  'aspectRatio',
  'durationSeconds',
  'clinicalReviewStatus',
]

const errors = []
const warnings = []

function fileIsNonEmpty(relPath) {
  try {
    return statSync(resolve(moduleRoot, relPath)).size > 0
  } catch {
    return false
  }
}

function main() {
  let raw
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`✖ Cannot read/parse manifest: ${manifestPath}\n  ${err.message}`)
    process.exit(1)
  }

  const shots = Array.isArray(raw.shots) ? raw.shots : []
  if (shots.length === 0) {
    warnings.push('Manifest has no shots.')
  }

  const seen = new Set()
  for (const shot of shots) {
    const id = shot.shotId ?? '(missing shotId)'

    for (const key of REQUIRED_KEYS) {
      if (shot[key] === undefined) {
        errors.push(`${id}: missing required key "${key}"`)
      }
    }

    if (seen.has(id)) {
      errors.push(`${id}: duplicate shotId`)
    }
    seen.add(id)

    if (shot.aspectRatio && shot.aspectRatio !== '16:9') {
      errors.push(`${id}: aspectRatio must be "16:9" (got "${shot.aspectRatio}")`)
    }
    if (shot.status && !VALID_STATUS.has(shot.status)) {
      errors.push(`${id}: invalid status "${shot.status}"`)
    }
    if (shot.clinicalReviewStatus && !VALID_REVIEW.has(shot.clinicalReviewStatus)) {
      errors.push(`${id}: invalid clinicalReviewStatus "${shot.clinicalReviewStatus}"`)
    }

    const isPlanned = shot.status === 'planned'
    const isDelivered = shot.status === 'downloaded' || shot.status === 'approved'

    // Nothing should be fabricated for a planned shot.
    if (isPlanned) {
      if (shot.generationId) {
        errors.push(`${id}: planned shot must not carry a generationId`)
      }
      if (shot.downloadedPath) {
        errors.push(`${id}: planned shot must not carry a downloadedPath`)
      }
    }

    // A delivered shot must have a real, non-empty file.
    if (isDelivered) {
      if (!shot.downloadedPath) {
        errors.push(`${id}: status "${shot.status}" requires a downloadedPath`)
      } else if (!fileIsNonEmpty(shot.downloadedPath)) {
        errors.push(`${id}: downloadedPath does not resolve to a non-empty file: ${shot.downloadedPath}`)
      }
    }

    // Approved clinical review must be backed by a delivered, approved shot.
    if (shot.clinicalReviewStatus === 'approved' && shot.status !== 'approved') {
      errors.push(`${id}: clinicalReviewStatus "approved" requires status "approved"`)
    }
  }

  console.log(`Rigid-bronchoscopy technique media manifest: ${shots.length} shot(s)`)
  const byStatus = shots.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})
  console.log(`  status: ${JSON.stringify(byStatus)}`)

  for (const warning of warnings) {
    console.warn(`⚠ ${warning}`)
  }

  if (errors.length > 0) {
    console.error(`\n✖ ${errors.length} problem(s):`)
    for (const error of errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  console.log('\n✔ Manifest is valid. No fabricated media detected.')
}

main()
