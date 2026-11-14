/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

import {
  DOLPHIN_MODEL_URL,
  DOLPHIN_STRUCTURES,
  ENVELOPE_OPACITY,
  HIDDEN_AT_START,
  STRUCTURE_NOTES,
  SYSTEMS,
  formatVolume,
} from './structures'

/** Node names from a binary glTF's JSON chunk. */
function glbNodeNames(file: string): string[] {
  const data = fs.readFileSync(file)
  expect(data.toString('ascii', 0, 4)).toBe('glTF')
  const jsonLength = data.readUInt32LE(12)
  const json = JSON.parse(data.toString('utf8', 20, 20 + jsonLength)) as {
    nodes: { name?: string; mesh?: number }[]
    extensionsUsed?: string[]
  }
  expect(json.extensionsUsed).toContain('KHR_draco_mesh_compression')
  return json.nodes.filter((node) => node.mesh !== undefined).map((node) => node.name ?? '')
}

describe('dolphin anatomy structures', () => {
  const ids = DOLPHIN_STRUCTURES.map((structure) => structure.id)

  it('has one teaching note for every structure in the model, and none for anything else', () => {
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(Object.keys(STRUCTURE_NOTES).sort())
    for (const structure of DOLPHIN_STRUCTURES) {
      expect(structure.note.length).toBeGreaterThan(40)
    }
  })

  it('puts every structure in a listed system, with a colour and a measured volume', () => {
    const systems = new Set(SYSTEMS.map((system) => system.id))
    for (const structure of DOLPHIN_STRUCTURES) {
      expect(systems.has(structure.system)).toBe(true)
      expect(structure.color).toHaveLength(3)
      expect(structure.volumeMl).toBeGreaterThan(0)
    }
    for (const system of SYSTEMS) {
      expect(DOLPHIN_STRUCTURES.some((structure) => structure.system === system.id)).toBe(true)
    }
  })

  it('names one mesh in the GLB for every structure', () => {
    const file = path.join(process.cwd(), 'public', DOLPHIN_MODEL_URL)
    expect([...glbNodeNames(file)].sort()).toEqual([...ids].sort())
  })

  it('draws only real structures see-through or hidden at start', () => {
    for (const id of [...Object.keys(ENVELOPE_OPACITY), ...HIDDEN_AT_START]) {
      expect(ids).toContain(id)
    }
  })

  it('formats volumes the way the panel shows them', () => {
    expect(formatVolume(12.2)).toBe('12 mL')
    expect(formatVolume(1246.7)).toBe('1.2 L')
    expect(formatVolume(19924.9)).toBe('20 L')
  })
})
