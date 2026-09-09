/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('self-contained original model downloads', () => {
  it.each(['thorax-airways', 'sampling-window', 'fixed-cbct-suite', 'mobile-cbct-suite'])(
    '%s is a binary glTF with embedded geometry and millimeter-to-meter scale',
    (name) => {
      const bytes = readFileSync(resolve('public/peripheral-imaging', name + '.glb'))
      expect(bytes.subarray(0, 4).toString()).toBe('glTF')
      expect(bytes.readUInt32LE(4)).toBe(2)
      expect(bytes.readUInt32LE(8)).toBe(bytes.length)
      expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a)
      const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
      expect(document.meshes.length).toBeGreaterThan(0)
      expect(document.buffers).toHaveLength(1)
      expect(document.buffers[0].uri).toBeUndefined()
      expect(document.images ?? []).toHaveLength(0)
      const root = document.nodes[document.scenes[document.scene].nodes[0]]
      expect(root.matrix[0]).toBeCloseTo(0.001)
      expect(root.matrix[5]).toBeCloseTo(0.001)
      expect(root.matrix[10]).toBeCloseTo(0.001)
    },
  )
})
