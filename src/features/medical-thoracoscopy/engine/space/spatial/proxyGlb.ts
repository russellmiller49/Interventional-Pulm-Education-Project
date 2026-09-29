/**
 * The engine's own reader for the collision proxies, which the build writes uncompressed
 * (`build_lung_states.py`): the same in Node and in the browser, with no loader, no Draco and no
 * renderer object (plan, section 4.5). It reads exactly what the build writes: float positions,
 * unsigned indices, point primitives, node names and extras.
 */

export interface TriangleMesh {
  readonly positions: Float32Array
  readonly indices: Uint32Array
}

export interface ProxyNode {
  readonly name: string
  readonly extras: Readonly<Record<string, unknown>>
  readonly mesh: TriangleMesh | null
  readonly points: Float32Array | null
}

export interface ProxyFile {
  readonly rootName: string
  readonly rootExtras: Readonly<Record<string, unknown>>
  readonly nodes: readonly ProxyNode[]
}

interface GltfAccessor {
  readonly bufferView: number
  readonly byteOffset?: number
  readonly componentType: number
  readonly count: number
  readonly type: string
}

interface GltfDocument {
  readonly scene?: number
  readonly scenes: readonly { readonly nodes: readonly number[] }[]
  readonly nodes: readonly {
    readonly name?: string
    readonly mesh?: number
    readonly children?: readonly number[]
    readonly extras?: Record<string, unknown>
  }[]
  readonly meshes: readonly {
    readonly primitives: readonly {
      readonly attributes: Readonly<Record<string, number>>
      readonly indices?: number
      readonly mode?: number
    }[]
  }[]
  readonly accessors: readonly GltfAccessor[]
  readonly bufferViews: readonly {
    readonly byteOffset?: number
    readonly byteLength: number
    readonly byteStride?: number
  }[]
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

export function readProxyGlb(bytes: ArrayBuffer | Uint8Array): ProxyFile {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== 2) {
    throw new Error('Not a glTF 2 binary')
  }
  const jsonLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== CHUNK_JSON) throw new Error('The first chunk is not JSON')
  const document = JSON.parse(
    new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)),
  ) as GltfDocument
  const binStart = 20 + jsonLength
  const binLength = view.getUint32(binStart, true)
  if (view.getUint32(binStart + 4, true) !== CHUNK_BIN)
    throw new Error('The second chunk is not binary')
  const bin = buffer.subarray(binStart + 8, binStart + 8 + binLength)

  const accessor = (index: number): Float32Array | Uint32Array => {
    const entry = document.accessors[index]
    const bufferView = document.bufferViews[entry.bufferView]
    const width = entry.type === 'VEC3' ? 3 : entry.type === 'SCALAR' ? 1 : 0
    if (width === 0) throw new Error(`Unsupported accessor type ${entry.type}`)
    if (bufferView.byteStride !== undefined && bufferView.byteStride !== width * 4) {
      throw new Error('Interleaved or padded accessors are not proxies')
    }
    const offset = bin.byteOffset + (bufferView.byteOffset ?? 0) + (entry.byteOffset ?? 0)
    const count = entry.count * width
    const source = bin.buffer.slice(offset, offset + count * (entry.componentType === 5123 ? 2 : 4))
    switch (entry.componentType) {
      case 5126:
        return new Float32Array(source)
      case 5125:
        return new Uint32Array(source)
      case 5123:
        return Uint32Array.from(new Uint16Array(source))
      default:
        throw new Error(`Unsupported component type ${entry.componentType}`)
    }
  }

  const rootIndex = document.scenes[document.scene ?? 0].nodes[0]
  const root = document.nodes[rootIndex]
  const nodes: ProxyNode[] = (root.children ?? []).map((index) => {
    const node = document.nodes[index]
    let mesh: TriangleMesh | null = null
    let points: Float32Array | null = null
    if (node.mesh !== undefined) {
      const primitive = document.meshes[node.mesh].primitives[0]
      const positions = accessor(primitive.attributes.POSITION) as Float32Array
      if ((primitive.mode ?? 4) === 0) {
        points = positions
      } else if ((primitive.mode ?? 4) === 4 && primitive.indices !== undefined) {
        mesh = { positions, indices: accessor(primitive.indices) as Uint32Array }
      } else {
        throw new Error(`Node ${node.name}: only triangles and points are proxies`)
      }
    }
    return { name: node.name ?? '', extras: node.extras ?? {}, mesh, points }
  })
  return { rootName: root.name ?? '', rootExtras: root.extras ?? {}, nodes }
}
