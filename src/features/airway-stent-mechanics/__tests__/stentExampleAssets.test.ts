import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

interface ManifestModel {
  id: string
  url: string
  outputSha256: string
  outputBytes: number
  morphTargets: string[]
  normalizedMaxDimension: number
  outputLongAxis: string
  triangles: { optimized: number; target: number }
}

interface ModelManifest {
  schemaVersion: number
  models: ManifestModel[]
}

function readGlbJson(buffer: Buffer) {
  expect(buffer.toString('ascii', 0, 4)).toBe('glTF')
  expect(buffer.readUInt32LE(4)).toBe(2)
  const jsonLength = buffer.readUInt32LE(12)
  expect(buffer.toString('ascii', 16, 20)).toBe('JSON')
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim()) as {
    accessors?: Array<{ count?: number }>
    buffers?: Array<{ uri?: string }>
    images?: Array<{ uri?: string }>
    meshes?: Array<{
      extras?: { targetNames?: string[] }
      primitives?: Array<{
        indices?: number
        targets?: Array<Record<string, number>>
        extensions?: Record<string, unknown>
      }>
    }>
  }
}

describe('optimized airway stent GLB derivatives', () => {
  const modelDir = path.join(process.cwd(), 'public', 'airway-stent-mechanics', 'models', 'v1')
  const manifest = JSON.parse(
    readFileSync(path.join(modelDir, 'model-manifest.json'), 'utf8'),
  ) as ModelManifest

  it('ships a complete versioned manifest within conservative web budgets', () => {
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.models).toHaveLength(9)
    for (const model of manifest.models) {
      expect(model.url).toBe(`/airway-stent-mechanics/models/v1/${model.id}.glb`)
      expect(model.outputBytes).toBeLessThan(6 * 1024 * 1024)
      expect(model.triangles.optimized).toBeLessThanOrEqual(model.triangles.target)
      expect(model.normalizedMaxDimension).toBe(2)
      expect(model.outputLongAxis).toContain('Y')
    }
  })

  it.each(manifest.models)(
    '$id is self-contained, hashed, Draco-compressed, and animated by morphs',
    (model) => {
      const output = readFileSync(path.join(modelDir, `${model.id}.glb`))
      const json = readGlbJson(output)
      const primitives = (json.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
      const targetNames = (json.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? [])
      const targetCount = primitives.reduce(
        (sum, primitive) => sum + (primitive.targets?.length ?? 0),
        0,
      )

      expect(output).toHaveLength(model.outputBytes)
      expect(createHash('sha256').update(output).digest('hex')).toBe(model.outputSha256)
      expect(primitives).toHaveLength(1)
      expect(primitives[0].extensions).toHaveProperty('KHR_draco_mesh_compression')
      expect(targetCount).toBe(model.morphTargets.length)
      expect(new Set(targetNames)).toEqual(new Set(model.morphTargets))
      expect((json.buffers ?? []).every((entry) => !entry.uri)).toBe(true)
      expect(
        (json.images ?? []).every((entry) => !entry.uri || entry.uri.startsWith('data:image/')),
      ).toBe(true)
    },
  )
})
