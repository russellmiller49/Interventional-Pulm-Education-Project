import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

interface SplitComponentRecord {
  filename: string
  sha256: string
  top_level_component_id: string
}

interface ToolAssetRecord {
  filename: string
  root_node: string
  sha256: string
}

const assemblyDirectory = path.join(process.cwd(), 'public/models/rigid-bronchoscopy/assembly')
const componentDirectory = path.join(assemblyDirectory, 'components')

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function parseGlbJson(filePath: string) {
  const bytes = readFileSync(filePath)
  expect(bytes.toString('utf8', 0, 4)).toBe('glTF')

  let offset = 12
  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset)
    const chunkType = bytes.readUInt32LE(offset + 4)
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(
        bytes
          .subarray(offset + 8, offset + 8 + chunkLength)
          .toString('utf8')
          .trim(),
      ) as {
        nodes: Array<{ name?: string }>
        buffers?: Array<{ uri?: string }>
        images?: Array<{ uri?: string }>
      }
    }
    offset += 8 + chunkLength
  }

  throw new Error(`No JSON chunk found in ${filePath}`)
}

describe('rigid bronchoscopy assembly assets', () => {
  it('keeps every segmented and generated part as a verified individual GLB', () => {
    const splitInventory = JSON.parse(
      readFileSync(path.join(assemblyDirectory, 'efer-component-inventory.json'), 'utf8'),
    ) as { component_count: number; components: SplitComponentRecord[] }
    const toolInventory = JSON.parse(
      readFileSync(path.join(assemblyDirectory, 'tool-asset-inventory.json'), 'utf8'),
    ) as { assets: ToolAssetRecord[] }

    expect(splitInventory.component_count).toBe(18)
    expect(toolInventory.assets).toHaveLength(8)
    expect(
      readdirSync(componentDirectory).filter((filename) => filename.endsWith('.glb')),
    ).toHaveLength(26)

    for (const component of [...splitInventory.components, ...toolInventory.assets]) {
      const filePath = path.join(componentDirectory, component.filename)
      expect(existsSync(filePath)).toBe(true)
      expect(sha256(filePath)).toBe(component.sha256)
    }
  })

  it('packages all semantic roots into one self-contained runtime GLB', () => {
    const toolInventory = JSON.parse(
      readFileSync(path.join(assemblyDirectory, 'tool-asset-inventory.json'), 'utf8'),
    ) as {
      assembly_pack: {
        filename: string
        root_node: string
        component_file_count: number
        sha256: string
      }
      assets: ToolAssetRecord[]
    }
    const splitInventory = JSON.parse(
      readFileSync(path.join(assemblyDirectory, 'efer-component-inventory.json'), 'utf8'),
    ) as { components: SplitComponentRecord[] }

    const packPath = path.join(assemblyDirectory, toolInventory.assembly_pack.filename)
    const gltf = parseGlbJson(packPath)
    const nodeNames = new Set(gltf.nodes.map((node) => node.name))

    expect(toolInventory.assembly_pack.component_file_count).toBe(26)
    expect(sha256(packPath)).toBe(toolInventory.assembly_pack.sha256)
    expect(nodeNames).toContain(toolInventory.assembly_pack.root_node)
    for (const root of [
      ...splitInventory.components.map((component) => component.top_level_component_id),
      ...toolInventory.assets.map((asset) => asset.root_node),
    ]) {
      expect(nodeNames).toContain(root)
    }
    expect(gltf.buffers?.some((buffer) => buffer.uri) ?? false).toBe(false)
    expect(gltf.images?.some((image) => image.uri) ?? false).toBe(false)
  })

  it('keeps the camera round and packages C1/C2 as separate semantic pieces', () => {
    const camera = parseGlbJson(path.join(componentDirectory, 'generic-endoscopic-camera-head.glb'))
    const cameraNodes = new Set(camera.nodes.map((node) => node.name))
    const pack = parseGlbJson(path.join(assemblyDirectory, 'rigid-bronchoscopy-assembly-kit.glb'))
    const packNodes = new Set(pack.nodes.map((node) => node.name))

    expect(cameraNodes).toContain('Camera_Round_Main_Housing')
    expect(cameraNodes).toContain('Camera_Round_Front_Grip_Collar')
    expect(cameraNodes).not.toContain('Camera_Main_Housing')
    expect(packNodes).toContain('Generic_Light_Guide_Adapter_C1')
    expect(packNodes).toContain('Generic_Light_Guide_Adapter_C2')
  })
})
