import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { COURSE_FLOWS } from '../content/courseFlow'
import { bronchLearnerCopyErrors } from '../content/learnerCopy'
import {
  TEACHING_STILLS,
  TEACHING_STILL_SIZE,
  teachingStillUrl,
  teachingStillsNote,
  type TeachingStillId,
} from '../content/teachingStills'

const PUBLIC = path.join(process.cwd(), 'public')
const DIR = path.join(PUBLIC, 'bronchoscopy-foundations/renders')
const manifest = JSON.parse(readFileSync(path.join(DIR, 'renders.json'), 'utf8')) as {
  width: number
  height: number
  stills: { id: string; file: string; bytes: number; sha256: string }[]
}
const ids = Object.keys(TEACHING_STILLS) as TeachingStillId[]

/** Width and height from a JPEG's frame header. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let at = 2
  while (at < bytes.length) {
    const marker = bytes[at + 1]
    const length = bytes.readUInt16BE(at + 2)
    if (marker >= 0xc0 && marker <= 0xc3)
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) }
    at += 2 + length
  }
  throw new Error('No frame header')
}

describe('teaching stills drawn from the 3D airway', () => {
  test('every still the course names is a file on disk, of the stated size', () => {
    for (const id of ids) {
      const file = path.join(PUBLIC, teachingStillUrl(id))
      expect(existsSync(file)).toBe(true)
      expect(jpegSize(readFileSync(file))).toEqual(TEACHING_STILL_SIZE)
    }
  })

  test('the folder, the render manifest and the course agree, file for file', () => {
    const files = readdirSync(DIR)
      .filter((name) => name.endsWith('.jpg'))
      .map((name) => name.slice(0, -4))
      .sort()
    expect(files).toEqual([...ids].sort())
    expect(manifest.stills.map((still) => still.id).sort()).toEqual([...ids].sort())
    expect({ width: manifest.width, height: manifest.height }).toEqual(TEACHING_STILL_SIZE)
    for (const still of manifest.stills) {
      const bytes = readFileSync(path.join(DIR, still.file))
      expect(bytes.length).toBe(still.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(still.sha256)
    }
  })

  test('captions and descriptions pass the learner copy gate and say something', () => {
    for (const id of ids) {
      const still = TEACHING_STILLS[id]
      expect(bronchLearnerCopyErrors(`${id} caption`, still.caption)).toEqual([])
      expect(bronchLearnerCopyErrors(`${id} description`, still.alt)).toEqual([])
      expect(still.caption.length).toBeLessThanOrEqual(90)
      expect(still.alt.length).toBeGreaterThan(60)
      expect(still.alt).not.toBe(still.caption)
    }
  })

  test('a screen that asks for stills names them, and no other screen does', () => {
    const used = new Set<string>()
    for (const [sectionId, flow] of Object.entries(COURSE_FLOWS)) {
      for (const chunk of flow) {
        const where = `${sectionId} / ${chunk.id}`
        if (chunk.visual === 'stills') {
          const stills = chunk.stills ?? []
          expect([where, stills.length >= 1 && stills.length <= 4]).toEqual([where, true])
          expect(new Set(stills).size).toBe(stills.length)
          for (const id of stills) {
            expect(ids).toContain(id)
            used.add(id)
          }
        } else {
          expect([where, chunk.stills]).toEqual([where, undefined])
          expect([where, chunk.stillsHeading]).toEqual([where, undefined])
        }
      }
    }
    // A still nobody shows is a file shipped for nothing.
    expect([...used].sort()).toEqual([...ids].sort())
  })

  test('the bleeding section has a picture on each of its four teaching screens', () => {
    const teaching = (COURSE_FLOWS['bleeding-priorities'] ?? []).filter(
      (chunk) => chunk.kind === 'teach' && chunk.blocks.length > 0,
    )
    expect(teaching.map((chunk) => chunk.id)).toEqual([
      'threat',
      'first-moves',
      'escalation',
      'grade',
    ])
    for (const chunk of teaching) expect(chunk.visual).toBe('stills')
  })

  test('says once how the pictures are seen', () => {
    expect(teachingStillsNote(['bleeding-scope-wells-up'])).toBeNull()
    expect(teachingStillsNote(['bleeding-blocker'])).toBe(
      'From the front, the patient’s right is on the left.',
    )
    expect(teachingStillsNote(['bleeding-wedge-close', 'bleeding-side-down'])).toBe(
      'From the front, the patient’s right is on the left. In the side-down picture the patient’s right is at the bottom.',
    )
  })
})
