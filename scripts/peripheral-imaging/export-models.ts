/** Rebuild original educational GLB models. No external models or patient data. */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Group } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import {
  createCArm,
  createSamplingModel,
  createSupport,
  createTable,
  createThorax,
} from '../../src/features/peripheral-imaging/lib/models'

class ExportFileReader {
  result: string | ArrayBuffer | null = null
  onloadend: (() => void) | null = null
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.()
    })
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((result) => {
      this.result = 'data:' + blob.type + ';base64,' + Buffer.from(result).toString('base64')
      this.onloadend?.()
    })
  }
}
Object.defineProperty(globalThis, 'FileReader', { value: ExportFileReader, configurable: true })
async function main() {
  const out = resolve('public/peripheral-imaging')
  await mkdir(out, { recursive: true })
  const models = new Map<string, Group>([
    ['thorax-airways', createThorax()],
    ['sampling-window', createSamplingModel()],
  ])
  for (const kind of ['fixed', 'mobile'] as const) {
    const group = new Group()
    group.name = kind + ' teaching suite'
    group.add(createThorax(), createCArm(), createSupport(kind), createTable())
    models.set(kind + '-cbct-suite', group)
  }
  for (const [name, model] of models) {
    // Authored scene coordinates use mm; glTF uses meters.
    model.scale.setScalar(0.001)
    const glb = await new GLTFExporter().parseAsync(model, { binary: true })
    if (!(glb instanceof ArrayBuffer)) throw new Error('Expected a binary glTF asset')
    await writeFile(resolve(out, name + '.glb'), Buffer.from(glb))
    process.stdout.write(name + '.glb: ' + glb.byteLength + ' bytes\n')
  }
}
void main()
