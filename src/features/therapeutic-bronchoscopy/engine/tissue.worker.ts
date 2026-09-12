import { TissueVolume, type MeshData, type TissueCut } from './tissue'

type Request = { revision: number; request: number } & (
  | { kind: 'init'; mesh: MeshData }
  | { kind: 'cut'; cut: TissueCut }
)
let volume: TissueVolume | null = null
let revision = -1
const port = self as unknown as {
  onmessage: (event: MessageEvent<Request>) => void
  postMessage: (data: unknown, transfer?: Transferable[]) => void
}
port.onmessage = ({ data }) => {
  try {
    if (data.kind === 'init') {
      revision = data.revision
      volume = new TissueVolume(data.mesh)
      port.postMessage({ kind: 'ready', revision, request: data.request })
    } else if (volume && data.revision === revision) {
      const result = volume.cut(data.cut)
      port.postMessage({ kind: 'result', revision, request: data.request, result }, [
        result.positions.buffer,
        result.colors.buffer,
        ...(result.indices ? [result.indices.buffer] : []),
      ])
    }
  } catch (error) {
    port.postMessage({
      kind: 'error',
      revision: data.revision,
      request: data.request,
      message: error instanceof Error ? error.message : 'Tissue calculation failed',
    })
  }
}
