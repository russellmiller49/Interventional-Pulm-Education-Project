import {
  Data3DTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three'

import { detectorFrameForAngles, detectorFrameForSlicerProjection } from './geometry'
import type { FluoroSettings } from './knobology'
import type { FluoroConfig, Vec3, VolumeDrrAsset } from './types'

const VERTEX_SHADER = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 outColor;

uniform sampler3D uVolume;
uniform vec3 uVolumeMinLps;
uniform vec3 uVolumeMaxLps;
uniform vec3 uVolumeSizeLps;

uniform vec3 uSourceLps;
uniform vec3 uDetectorCenterLps;
uniform vec3 uDetectorRightLps;
uniform vec3 uDetectorUpLps;
uniform vec2 uDetectorHalfMm;

uniform float uHuLow;
uniform float uHuHigh;
uniform float uKvp;
uniform float uMaTimeGain;
uniform float uMuScale;
uniform float uNoiseSigma;
uniform float uContrastBoost;
uniform int uMaxSteps;
uniform float uTime;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 intersectBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
  vec3 invD = 1.0 / rd;
  vec3 t0 = (boxMin - ro) * invD;
  vec3 t1 = (boxMax - ro) * invD;
  vec3 tsmaller = min(t0, t1);
  vec3 tbigger = max(t0, t1);
  float tmin = max(max(tsmaller.x, tsmaller.y), tsmaller.z);
  float tmax = min(min(tbigger.x, tbigger.y), tbigger.z);
  return vec2(tmin, tmax);
}

float huToMu(float hu, float kvp) {
  float kvpFactor = pow(80.0 / max(kvp, 30.0), 1.35);
  float tissueDensity = max(0.0, (hu + 1000.0) / 1000.0);
  float softTissue = smoothstep(-850.0, 80.0, hu);
  float bone = smoothstep(160.0, 1250.0, hu);
  return kvpFactor * (0.00013 * tissueDensity + 0.00009 * softTissue + 0.00038 * bone);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 detectorPoint = uDetectorCenterLps
    + uDetectorRightLps * (ndc.x * uDetectorHalfMm.x)
    + uDetectorUpLps * (ndc.y * uDetectorHalfMm.y);
  vec3 dir = normalize(detectorPoint - uSourceLps);

  vec2 tHits = intersectBox(uSourceLps, dir, uVolumeMinLps, uVolumeMaxLps);
  float tStart = max(tHits.x, 0.0);
  float tEnd = tHits.y;
  if (tEnd <= tStart) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  int steps = max(uMaxSteps, 16);
  float pathLength = tEnd - tStart;
  float stepMm = pathLength / float(steps);
  float jitter = hash21(gl_FragCoord.xy + vec2(uTime, 0.0)) * stepMm;
  float t = tStart + jitter;
  float lineIntegral = 0.0;

  for (int i = 0; i < 1024; i++) {
    if (i >= steps) break;
    vec3 samplePos = uSourceLps + dir * t;
    vec3 uvw = (samplePos - uVolumeMinLps) / uVolumeSizeLps;
    if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) {
      t += stepMm;
      continue;
    }
    float normalizedSample = texture(uVolume, uvw).r;
    float hu = normalizedSample * (uHuHigh - uHuLow) + uHuLow;
    float mu = huToMu(hu, uKvp);
    lineIntegral += mu * stepMm * uMuScale;
    t += stepMm;
  }

  float intensity = smoothstep(0.035, 0.92, lineIntegral) * uMaTimeGain;
  float noise = (hash21(gl_FragCoord.xy * 0.917 + uTime) - 0.5) * uNoiseSigma;
  intensity = clamp(intensity + noise, 0.0, 1.0);
  intensity = pow(intensity, max(0.45, uContrastBoost));

  outColor = vec4(vec3(intensity), 1.0);
}
`

export interface DrrFrameMetrics {
  thicknessProxy: number
  renderMs: number
  sampleSteps: number
  renderScale: number
}

export class VolumeDRRRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly config: FluoroConfig
  private readonly asset: VolumeDrrAsset
  private readonly timeStart = typeof performance !== 'undefined' ? performance.now() : Date.now()
  private renderer: WebGLRenderer | null = null
  private scene: Scene = new Scene()
  private camera: OrthographicCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private material: ShaderMaterial | null = null
  private quad: Mesh | null = null
  private volumeTexture: Data3DTexture | null = null
  private roiCenterLps: Vec3 | null = null
  private destroyed = false
  private ready = false
  private lastWidth = 0
  private lastHeight = 0
  private lastPixelRatio = 0
  private lastMetrics: DrrFrameMetrics = {
    thicknessProxy: 1,
    renderMs: 0,
    sampleSteps: 0,
    renderScale: 1,
  }

  constructor(options: { canvas: HTMLCanvasElement; config: FluoroConfig; asset: VolumeDrrAsset }) {
    this.canvas = options.canvas
    this.config = options.config
    this.asset = options.asset
  }

  async load(): Promise<void> {
    if (this.destroyed) return
    const gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext | null
    if (!gl) {
      throw new Error('WebGL2 is required for real-time FluoroView volume DRR rendering.')
    }

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      context: gl,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
    })
    this.renderer.setClearColor(0x05070c, 1)

    const data = await this.fetchVolume()
    if (this.destroyed) return

    const [sx, sy, sz] = this.asset.sizeXyz
    const expectedBytes = sx * sy * sz
    if (data.byteLength !== expectedBytes) {
      throw new Error(
        `CT volume byte length mismatch: expected ${expectedBytes}, got ${data.byteLength}.`,
      )
    }

    const texture = new Data3DTexture(data, sx, sy, sz)
    texture.format = RedFormat
    texture.type = UnsignedByteType
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.unpackAlignment = 1
    texture.needsUpdate = true
    this.volumeTexture = texture

    const spacing = this.asset.spacingXyzMm
    const origin = this.asset.originLps
    const sizeLps: Vec3 = [spacing[0] * sx, spacing[1] * sy, spacing[2] * sz]
    const maxLps: Vec3 = [origin[0] + sizeLps[0], origin[1] + sizeLps[1], origin[2] + sizeLps[2]]
    const detectorSizeMm = this.asset.calibrationProjection?.detectorSizeMm ?? [
      this.config.detector_pixels[0] * this.config.pixel_pitch_mm,
      this.config.detector_pixels[1] * this.config.pixel_pitch_mm,
    ]

    this.material = new ShaderMaterial({
      glslVersion: '300 es' as never,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uVolume: { value: texture as Texture },
        uVolumeMinLps: { value: new Vector3(origin[0], origin[1], origin[2]) },
        uVolumeMaxLps: { value: new Vector3(maxLps[0], maxLps[1], maxLps[2]) },
        uVolumeSizeLps: { value: new Vector3(sizeLps[0], sizeLps[1], sizeLps[2]) },
        uSourceLps: { value: new Vector3() },
        uDetectorCenterLps: { value: new Vector3() },
        uDetectorRightLps: { value: new Vector3() },
        uDetectorUpLps: { value: new Vector3() },
        uDetectorHalfMm: { value: { x: detectorSizeMm[0] / 2, y: detectorSizeMm[1] / 2 } },
        uHuLow: { value: this.asset.huRange[0] },
        uHuHigh: { value: this.asset.huRange[1] },
        uKvp: { value: 80 },
        uMaTimeGain: { value: 1 },
        uMuScale: { value: 1 },
        uNoiseSigma: { value: 0 },
        uContrastBoost: { value: 1 },
        uMaxSteps: { value: 192 },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    })

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material)
    this.scene = new Scene()
    this.scene.add(this.quad)
    this.ready = true
  }

  render(options: {
    raoLaoDeg: number
    cranialCaudalDeg: number
    settings: FluoroSettings
    lowRes: boolean
  }): DrrFrameMetrics {
    if (!this.ready || !this.material || !this.renderer) {
      return this.lastMetrics
    }

    const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const plan = resolveVolumeRenderPlan(this.asset, options.lowRes)
    this.resize(plan.renderScale)

    const frame = this.asset.calibrationProjection
      ? detectorFrameForSlicerProjection(
          this.config,
          this.asset.calibrationProjection,
          options.raoLaoDeg,
          options.cranialCaudalDeg,
        )
      : detectorFrameForAngles(this.config, options.raoLaoDeg, options.cranialCaudalDeg)
    this.material.uniforms.uSourceLps.value.set(
      frame.sourceLps[0],
      frame.sourceLps[1],
      frame.sourceLps[2],
    )
    this.material.uniforms.uDetectorCenterLps.value.set(
      frame.detectorCenterLps[0],
      frame.detectorCenterLps[1],
      frame.detectorCenterLps[2],
    )
    this.material.uniforms.uDetectorRightLps.value.set(
      frame.detectorUAxisLps[0],
      frame.detectorUAxisLps[1],
      frame.detectorUAxisLps[2],
    )
    this.material.uniforms.uDetectorUpLps.value.set(
      frame.detectorVAxisLps[0],
      frame.detectorVAxisLps[1],
      frame.detectorVAxisLps[2],
    )
    this.material.uniforms.uDetectorHalfMm.value.x = frame.detectorSizeMm[0] / 2
    this.material.uniforms.uDetectorHalfMm.value.y = frame.detectorSizeMm[1] / 2

    const settings = options.settings
    const baselineMas = this.asset.baselineMas ?? 16
    const mas = Math.max(settings.ma * settings.pulseWidthMs, 0.1)
    const exposureGain = Math.pow(mas / baselineMas, 0.6)
    const noiseSigma = settings.noiseEnabled
      ? Math.min(
          0.045,
          (1 / Math.sqrt(Math.max(mas, 0.5) * (settings.highDoseMode ? 2 : 1))) * 0.11,
        )
      : 0

    this.material.uniforms.uKvp.value = settings.kvp
    this.material.uniforms.uMaTimeGain.value = exposureGain
    this.material.uniforms.uMuScale.value = 7.5
    this.material.uniforms.uNoiseSigma.value = noiseSigma
    this.material.uniforms.uContrastBoost.value = settings.highDoseMode ? 1.08 : 1
    this.material.uniforms.uMaxSteps.value = plan.sampleSteps
    this.material.uniforms.uTime.value =
      ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.timeStart) /
      1000

    this.renderer.render(this.scene, this.camera)
    const finished = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.lastMetrics = {
      thicknessProxy: this.computeThicknessProxy(options.raoLaoDeg, options.cranialCaudalDeg),
      renderMs: finished - started,
      sampleSteps: plan.sampleSteps,
      renderScale: plan.renderScale,
    }
    return this.lastMetrics
  }

  setRoiCenter(lpsMm: Vec3 | null): void {
    this.roiCenterLps = lpsMm
  }

  resize(renderScale?: number): void {
    if (!this.renderer) return
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    const pixelRatio = Math.max(
      0.25,
      (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * (renderScale ?? 1),
    )
    if (
      width === this.lastWidth &&
      height === this.lastHeight &&
      Math.abs(pixelRatio - this.lastPixelRatio) < 0.001
    ) {
      return
    }
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.lastWidth = width
    this.lastHeight = height
    this.lastPixelRatio = pixelRatio
  }

  dispose(): void {
    this.destroyed = true
    this.ready = false
    if (this.quad) {
      this.quad.geometry.dispose()
      this.scene.remove(this.quad)
    }
    this.material?.dispose()
    this.volumeTexture?.dispose()
    this.renderer?.dispose()
    this.material = null
    this.quad = null
    this.volumeTexture = null
    this.renderer = null
  }

  isReady(): boolean {
    return this.ready
  }

  getLastMetrics(): DrrFrameMetrics {
    return this.lastMetrics
  }

  private async fetchVolume(): Promise<Uint8Array> {
    const response = await fetch(this.asset.volumeUri)
    if (!response.ok) throw new Error(`Failed to fetch CT volume: ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }

  private computeThicknessProxy(raoLaoDeg: number, cranialCaudalDeg: number): number {
    const frame = this.asset.calibrationProjection
      ? detectorFrameForSlicerProjection(
          this.config,
          this.asset.calibrationProjection,
          raoLaoDeg,
          cranialCaudalDeg,
        )
      : detectorFrameForAngles(this.config, raoLaoDeg, cranialCaudalDeg)
    const spacing = this.asset.spacingXyzMm
    const sizeLps: Vec3 = [
      spacing[0] * this.asset.sizeXyz[0],
      spacing[1] * this.asset.sizeXyz[1],
      spacing[2] * this.asset.sizeXyz[2],
    ]
    const n = frame.detectorNormalLps
    const projected =
      Math.abs(n[0] * sizeLps[0]) + Math.abs(n[1] * sizeLps[1]) + Math.abs(n[2] * sizeLps[2])
    const apReference = Math.max(sizeLps[1], 1)
    return Math.max(0.4, Math.min(1.6, projected / apReference))
  }
}

export function reconstructHuFromNormalizedSample(
  normalizedSample: number,
  huRange: [number, number],
): number {
  return normalizedSample * (huRange[1] - huRange[0]) + huRange[0]
}

export function resolveVolumeRenderPlan(
  asset: Pick<VolumeDrrAsset, 'recommendedSteps' | 'recommendedRenderScale'>,
  lowRes: boolean,
): { sampleSteps: number; renderScale: number } {
  return {
    sampleSteps: lowRes
      ? (asset.recommendedSteps?.interactive ?? 96)
      : (asset.recommendedSteps?.full ?? 224),
    renderScale: lowRes
      ? (asset.recommendedRenderScale?.interactive ?? 0.67)
      : (asset.recommendedRenderScale?.full ?? 1),
  }
}
