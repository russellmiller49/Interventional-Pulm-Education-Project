/** Rebuild the authored sampling-window GLB. CT and gantry assets have a separate Slicer pipeline. */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Group } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { createSamplingModel } from '../../src/features/peripheral-imaging/lib/models'

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
  const models = new Map<string, Group>([['sampling-window', createSamplingModel()]])
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
