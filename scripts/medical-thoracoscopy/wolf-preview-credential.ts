/**
 * Issue a review code for the private manufacturer preview of the device explorer.
 *
 *   npx tsx scripts/medical-thoracoscopy/wolf-preview-credential.ts <label>
 *   npx tsx scripts/medical-thoracoscopy/wolf-preview-credential.ts --secret
 *
 * With a label (e.g. wolf-reviewer-1) it prints a new random code, to give to that reviewer, and
 * the `label:sha256:…` entry to add to MT_WOLF_PREVIEW_REVIEWERS on the host (comma-separated with
 * any others). The code itself is never stored anywhere but where you send it.
 *
 * With --secret it prints a value for MT_WOLF_PREVIEW_SESSION_SECRET.
 *
 * Run it in your own terminal. Nothing is written to disk.
 */
import { randomBytes } from 'node:crypto'

import {
  codeVerifier,
  newReviewCode,
} from '../../src/features/medical-thoracoscopy/wolf-preview/server/access'

const argument = process.argv[2]
if (argument === '--secret') {
  console.log(randomBytes(48).toString('base64url'))
} else if (argument && /^[a-z0-9][a-z0-9-]{0,39}$/.test(argument)) {
  const code = newReviewCode()
  console.log(`Review code for ${argument} (send this to the reviewer only):`)
  console.log(`  ${code}`)
  console.log('')
  console.log('Add this entry to MT_WOLF_PREVIEW_REVIEWERS (comma-separated):')
  console.log(`  ${argument}:${codeVerifier(code)}`)
} else {
  console.error('Usage: wolf-preview-credential.ts <label a-z0-9-> | --secret')
  process.exit(1)
}
