/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

import type { CenterlineLabels } from '@/lib/airway-anatomy/types'

import { DOLPHIN_FRAMES, isLearnerVisible, learnerVisibleFrames } from '../content/frameBank'
import { DOLPHIN_FRAME_DRILLS, frameDrillErrors } from '../content/frameDrills'
import { DOLPHIN_SCOPE_STARTS } from '../content/scopeStarts'
import { DOLPHIN_SECTIONS } from '../content/sections'

const labels = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'public/airway-anatomy/dolphin-001/metadata/centerline_labels.json'),
    'utf8',
  ),
) as CenterlineLabels

/** The declared width and height: the PNG header, or a JPEG's start-of-frame segment. */
function imageSize(file: string): { width: number; height: number } {
  const buffer = fs.readFileSync(file)
  if (buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  let offset = 2
  while (offset < buffer.length) {
    const marker = buffer.readUInt16BE(offset)
    if (marker >= 0xffc0 && marker <= 0xffc2) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
    }
    offset += 2 + buffer.readUInt16BE(offset + 2)
  }
  throw new Error(`No image size in ${file}`)
}

describe('the frame bank', () => {
  it('has a rendered file of the declared size for every learner-visible frame', () => {
    for (const frame of learnerVisibleFrames()) {
      const file = path.join(process.cwd(), 'public', frame.src)
      expect(fs.existsSync(file)).toBe(true)
      expect(imageSize(file)).toEqual({ width: frame.width, height: frame.height })
    }
  })

  it('poses every render on the label it claims', () => {
    for (const frame of DOLPHIN_FRAMES) {
      if (frame.rights.kind !== 'simulator-render') continue
      const pose = frame.rights.pose
      const edgeId = 'start' in pose ? DOLPHIN_SCOPE_STARTS[pose.start].edgeId : pose.edgeId
      expect(labels.edgeLabels[String(edgeId)]?.abbreviatedLabel).toBe(frame.location)
    }
  })

  it('never shows a program still before its grant is recorded', () => {
    expect(
      isLearnerVisible({
        ...DOLPHIN_FRAMES[0],
        rights: { kind: 'nmmp-still', holder: 'NMMP', permission: 'pending', reference: 'x' },
      }),
    ).toBe(false)
  })

  it('keeps the answer out of every pre-answer description', () => {
    for (const frame of DOLPHIN_FRAMES) {
      expect(frame.preCommitAlt).not.toMatch(
        /\b(LNP|NPX|LS|LX|TRA|RTB|RMB|LMB|[RL]B\d+|carina|glottis|spout|larynx|trachea|bronchus|fornix|nasopharynx)\b/i,
      )
    }
  })

  it('points every section, item and drill at a frame that exists', () => {
    const ids = new Set(DOLPHIN_FRAMES.map((frame) => frame.id))
    for (const section of DOLPHIN_SECTIONS) {
      if (section.workspace.kind === 'frame') expect(ids.has(section.workspace.frameId)).toBe(true)
      if (section.act.kind === 'identify') {
        for (const row of section.act.identify.rows) expect(ids.has(row.frameId)).toBe(true)
      }
      for (const item of [
        section.prediction,
        section.transfer,
        ...section.practice.map((c) => c.item),
      ]) {
        if (item.media) expect(ids.has(item.media.frameId)).toBe(true)
      }
    }
    expect(frameDrillErrors()).toEqual([])
    expect(DOLPHIN_FRAME_DRILLS.every((drill) => drill.items.length > 0)).toBe(true)
  })
})
