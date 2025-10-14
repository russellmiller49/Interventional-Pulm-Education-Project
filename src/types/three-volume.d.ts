declare module 'three/examples/jsm/loaders/NRRDLoader.js' {
  import { Loader, LoadingManager } from 'three'
  import type Volume from 'three/examples/jsm/misc/Volume.js'

  export class NRRDLoader extends Loader {
    constructor(manager?: LoadingManager)
    loadAsync(
      url: string,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
    ): Promise<Volume>
  }
}

declare module 'three/examples/jsm/misc/Volume.js' {
  import type { Matrix3, Matrix4 } from 'three'
  import type { VolumeSlice } from 'three/examples/jsm/misc/VolumeSlice.js'

  export type VolumeDataArray =
    | Uint8Array
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | Float32Array
    | Float64Array

  export class Volume {
    constructor(
      xLength?: number,
      yLength?: number,
      zLength?: number,
      type?: string,
      arrayBuffer?: ArrayBuffer,
    )

    xLength: number
    yLength: number
    zLength: number
    axisOrder: string[]
    data: VolumeDataArray
    spacing: [number, number, number]
    RASSpacing: [number, number, number]
    dimensions: [number, number, number]
    RASDimensions: [number, number, number]
    offset: [number, number, number]
    matrix: Matrix3
    inverseMatrix: Matrix3
    sliceList: VolumeSlice[]
    lowerThreshold: number
    upperThreshold: number
    windowLow: number
    windowHigh: number

    extractSlice(axis: 'x' | 'y' | 'z', index: number): VolumeSlice
    extractPerpendicularPlane(
      axis: 'x' | 'y' | 'z',
      index: number,
    ): {
      sliceAccess: (i: number, j: number) => number
      iLength: number
      jLength: number
      planeWidth: number
      planeHeight: number
      matrix: Matrix4
    }
  }

  export default Volume
}

declare module 'three/examples/jsm/misc/VolumeSlice.js' {
  import type { Mesh } from 'three'
  import type Volume from 'three/examples/jsm/misc/Volume.js'

  export type VolumeSliceAxis = 'x' | 'y' | 'z'

  export class VolumeSlice {
    constructor(volume: Volume, index?: number, axis?: VolumeSliceAxis)
    readonly volume: Volume
    index: number
    axis: VolumeSliceAxis
    canvas: HTMLCanvasElement
    mesh: Mesh
    repaint(): void
  }

  export default VolumeSlice
}
