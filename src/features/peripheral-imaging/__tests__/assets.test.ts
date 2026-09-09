/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import metadata from '../../../../public/peripheral-imaging/anatomy/manifest.json'

describe('self-contained original model downloads', () => {
  it.each(['sampling-window'])(
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

describe('CT-derived Slicer assets', () => {
  it.each(['thorax', 'fluoroview-carm'])(
    '%s embeds Draco geometry within the browser asset budget',
    (name) => {
      const bytes = readFileSync(resolve('public/peripheral-imaging/anatomy', name + '.glb'))
      expect(bytes.length).toBeLessThan(1_100_000)
      expect(bytes.readUInt32LE(8)).toBe(bytes.length)
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
      expect(gltf.extensionsUsed).toContain('KHR_draco_mesh_compression')
      expect(gltf.buffers[0].uri).toBeUndefined()
      if (name === 'thorax') {
        expect(gltf.meshes).toHaveLength(4)
        const root = gltf.nodes[gltf.scenes[gltf.scene].nodes[0]]
        expect(root.scale).toEqual([0.001, 0.001, 0.001])
        expect(metadata.coordinateSystem).toBe('LAS')
      } else expect(gltf.animations).toHaveLength(1)
    },
  )
  it('preserves useful CT dynamic range during integer quantization and atlas packing', async () => {
    const { data, info } = await sharp('public/peripheral-imaging/anatomy/ct-atlas.png')
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(info.width).toBe(metadata.sizeXyz[0] * metadata.atlasColumns)
    expect(info.height).toBe(metadata.sizeXyz[1] * metadata.atlasRows)
    let min = 255,
      max = 0,
      sum = 0
    for (let i = 0; i < data.length; i += info.channels) {
      min = Math.min(min, data[i])
      max = Math.max(max, data[i])
      sum += data[i]
    }
    expect(min).toBeLessThan(10)
    expect(max).toBeGreaterThan(220)
    expect(sum / (info.width * info.height)).toBeGreaterThan(30)
    // The authored target belongs in lung, not in the wall or outside the exported volume.
    const ijk = [85, -20, -30].map((v, i) =>
      Math.round((v - metadata.originMm[i]) / metadata.spacingMm[i]),
    )
    const x = (ijk[2] % metadata.atlasColumns) * 192 + ijk[0],
      y = Math.floor(ijk[2] / metadata.atlasColumns) * 192 + ijk[1]
    const hu =
      metadata.huRange[0] +
      (data[(y * info.width + x) * info.channels] / 255) *
        (metadata.huRange[1] - metadata.huRange[0])
    expect(hu).toBeLessThan(-400)
    expect(hu).toBeGreaterThan(-1050)
  })
})
