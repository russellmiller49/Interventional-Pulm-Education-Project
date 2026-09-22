/**
 * Measure the lit region of the recorded EBUS clips (EBUS-PRE-REVIEW-02, lane A).
 *
 * The workbench shows `Depth<n>.mp4` letterboxed inside a square box, so the sector occupies a
 * small part of what is rendered. Before cropping anything for display we measured where the
 * recorded content actually is, rather than guessing a border. This script is the record of that
 * measurement: it samples frames across every authored segment window of every depth file and
 * prints the union bounding box of pixels above a luminance floor.
 *
 * The luminance floor and the reporting live in the companion `measure-recorded-sector.py`.
 * It needs ffmpeg and python3 (numpy + Pillow) and is not part of the build or the test run.
 *
 *   node scripts/ebus-guided/measure-recorded-sector.mjs [outputDir]
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const DEPTHS = [2, 3, 4, 5, 6, 8]
// Every authored segment start plus a mid-window sample: gain 0–16 s, contrast 16–32 s, flow 32–38 s.
const TIMES = [1, 3, 5, 7, 9, 11, 13, 15, 17, 21, 25, 29, 33, 35, 37]

const mediaDir = 'EBUS-course/apps/web/public/media/knobology/Depth_segments'
const out = process.argv[2] ?? join(tmpdir(), 'ebus-recorded-sector')
mkdirSync(out, { recursive: true })

for (const depth of DEPTHS) {
  for (const time of TIMES) {
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-ss',
      String(time),
      '-i',
      join(mediaDir, `Depth${depth}.mp4`),
      '-frames:v',
      '1',
      '-y',
      join(out, `d${depth}_t${time}.png`),
    ])
  }
}

execFileSync('python3', [new URL('measure-recorded-sector.py', import.meta.url).pathname, out], {
  stdio: 'inherit',
})
rmSync(out, { recursive: true, force: true })
