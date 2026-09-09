/** @jest-environment node */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'
import metadata from '../../../../public/peripheral-imaging/anatomy/manifest.json'
import dtsMetadata from '../../../../public/peripheral-imaging/anatomy/dts.json'
import packageManifest from '../../../../public/peripheral-imaging/manifest.json'
import roomProvenance from '../../../../public/peripheral-imaging/room-hero.json'
import { LESION_CENTER, LESION_RADIUS } from '../lib/physics'

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
  it('ships a 2400 × 1000 room still under 400 KB with flush shell edges and render provenance', async () => {
    const png = readFileSync(resolve('public/peripheral-imaging/room-hero.png'))
    expect(png.length).toBeLessThan(400_000)
    const { data, info } = await sharp(png)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([2400, 1000])
    const background = Buffer.from([6, 21, 25])
    let painted = 0,
      edgeMismatches = 0
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const start = (y * info.width + x) * info.channels
        const match = data.subarray(start, start + 3).equals(background)
        if (!match) painted++
        if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && !match)
          edgeMismatches++
      }
    expect(edgeMismatches).toBe(0)
    expect(painted).toBeGreaterThan(info.width * info.height * 0.02)
    expect(roomProvenance.output).toEqual({
      path: 'room-hero.png',
      width: 2400,
      height: 1000,
      bytes: png.length,
      sha256: createHash('sha256').update(png).digest('hex'),
    })
    expect(roomProvenance.ctSourceSha256).toBe(metadata.sourceSha256)
    expect(roomProvenance.airwaySourceSha256).toBe(metadata.airwaySourceSha256)
    expect(roomProvenance.sourceSha256).toBe(
      createHash('sha256').update(JSON.stringify(roomProvenance.sources)).digest('hex'),
    )
    expect(
      packageManifest.assets.find((asset) => asset.path === 'room-hero.png')?.sourceSha256,
    ).toBe(roomProvenance.sourceSha256)
    expect(roomProvenance.render.camera).toBe('room')
    expect(roomProvenance.render.background).toBe('#061519')
    expect(roomProvenance.render.layers).not.toContain('labels')
  })

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
    // The nodule is now in the atlas itself, and its centre/radius follow the physics contract.
    expect(metadata.authoredNodule.centerMm).toEqual(LESION_CENTER)
    expect(metadata.authoredNodule.radiusMm).toBe(LESION_RADIUS)
    expect(metadata.authoredNodule.profile).toMatch(/part-solid/)
    const ijk = LESION_CENTER.map((v, i) =>
      Math.round((v - metadata.originMm[i]) / metadata.spacingMm[i]),
    )
    const x = (ijk[2] % metadata.atlasColumns) * 192 + ijk[0],
      y = Math.floor(ijk[2] / metadata.atlasColumns) * 192 + ijk[1]
    const hu =
      metadata.huRange[0] +
      (data[(y * info.width + x) * info.channels] / 255) *
        (metadata.huRange[1] - metadata.huRange[0])
    expect(Math.abs(hu - metadata.authoredNodule.coreHu)).toBeLessThan(12)
    for (const point of [
      [70, -20, -30],
      [100, -20, -30],
      [85, -35, -30],
      [85, -5, -30],
    ]) {
      const [i, j, k] = point.map((v, axis) =>
        Math.round((v - metadata.originMm[axis]) / metadata.spacingMm[axis]),
      )
      const u = (k % metadata.atlasColumns) * metadata.sizeXyz[0] + i
      const v = Math.floor(k / metadata.atlasColumns) * metadata.sizeXyz[1] + j
      const surrounding =
        metadata.huRange[0] +
        (data[(v * info.width + u) * info.channels] / 255) *
          (metadata.huRange[1] - metadata.huRange[0])
      expect(surrounding).toBeGreaterThan(-1050)
      expect(surrounding).toBeLessThan(-700)
    }
  })
  it('records the source SHA and one consistent nodule for CT and DTS', () => {
    expect(metadata.sourceSha256).toBe(
      '572afc5bf6b2d80b28439e0397ad4e24e4eb6dfb2630780593259e081ae0a29b',
    )
    const hash = createHash('sha256')
      .update(readFileSync('public/peripheral-imaging/anatomy/ct-atlas.png'))
      .digest('hex')
    expect(metadata.atlasSha256).toBe(hash)
    expect(dtsMetadata.sourceSha256).toBe(metadata.sourceSha256)
    expect(dtsMetadata.sourceAtlasSha256).toBe(hash)
    expect(dtsMetadata.authoredNodule).toEqual(metadata.authoredNodule)
  })
  it('covers every binary asset with matching output and source provenance', () => {
    const root = 'public/peripheral-imaging'
    const binaries = readdirSync(root, { recursive: true })
      .map(String)
      .filter((file) => /\.(png|glb)$/.test(file))
      .sort()
    expect(packageManifest.assets.map((asset) => asset.path).sort()).toEqual(binaries)
    for (const asset of packageManifest.assets) {
      const bytes = readFileSync(resolve(root, asset.path))
      expect(asset.bytes).toBe(bytes.length)
      expect(asset.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(asset.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    }
    expect(packageManifest.authoredNodule).toEqual(metadata.authoredNodule)
    expect(packageManifest.noduleSourceSha256).toBe(
      createHash('sha256')
        .update(readFileSync('scripts/peripheral-imaging/authored_nodule.py'))
        .digest('hex'),
    )
  })
  it('keeps the public package self-contained and below twelve MiB', () => {
    const root = 'public/peripheral-imaging'
    const files = readdirSync(root, { recursive: true })
      .map(String)
      .filter((file) => statSync(resolve(root, file)).isFile())
    expect(files.every((file) => /\.(png|glb|json)$/.test(file) || file === 'README.md')).toBe(true)
    expect(files.reduce((sum, file) => sum + statSync(resolve(root, file)).size, 0)).toBeLessThan(
      12 * 1024 * 1024,
    )
    for (const file of files.filter((file) => file.endsWith('.json'))) {
      const value = readFileSync(resolve(root, file), 'utf8')
      expect(value).not.toMatch(/\/Users\/|\/home\/|PatientName|PatientID|\.wasm|\.raw/)
    }
  })
})
