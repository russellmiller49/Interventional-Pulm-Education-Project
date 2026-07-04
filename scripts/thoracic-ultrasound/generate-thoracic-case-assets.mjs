/**
 * Generic thoracic ultrasound simulator case packager.
 *
 * Converts a local 3D Slicer export (multi-layer .seg.nrrd + GLB surface
 * model) into a browser case package under
 * public/module-assets/v1/thoracic-ultrasound-simulator/<case-id>/:
 *   - <case-id>.glb                       surface meshes
 *   - ultrasound-probe.glb                optional probe model
 *   - <case-id>.labelmap.uint8.bin        downsampled single-label volume
 *   - case.json                           manifest (schemaVersion 2)
 *
 * `schema: 'pleural-v1'` reproduces the legacy pleural manifest exactly, so
 * scripts/pleural-ultrasound/generate-pleural-sim-assets.mjs can stay a thin
 * compatibility wrapper. Raw CT/segmentation sources never leave the machine;
 * only derived educational assets are written.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

export const defaultLabelCodes = {
  background: 0,
  skin: 1,
  subcutaneousTissue: 2,
  intercostalMuscle: 3,
  rib: 4,
  lung: 5,
  atelectaticLung: 6,
  pleuralFluid: 7,
  septation: 8,
  debris: 9,
  diaphragm: 10,
  liver: 11,
  spleen: 12,
}

export const defaultLabelPriority = {
  [defaultLabelCodes.background]: 0,
  [defaultLabelCodes.subcutaneousTissue]: 5,
  [defaultLabelCodes.intercostalMuscle]: 10,
  [defaultLabelCodes.skin]: 20,
  [defaultLabelCodes.lung]: 30,
  [defaultLabelCodes.atelectaticLung]: 38,
  [defaultLabelCodes.liver]: 45,
  [defaultLabelCodes.spleen]: 45,
  [defaultLabelCodes.diaphragm]: 55,
  [defaultLabelCodes.pleuralFluid]: 65,
  [defaultLabelCodes.septation]: 75,
  [defaultLabelCodes.debris]: 75,
  [defaultLabelCodes.rib]: 90,
}

export function defaultTargetLabelForName(rawName, labelCodes = defaultLabelCodes) {
  const name = rawName.trim().toLowerCase()

  if (name.includes('skin')) return labelCodes.skin
  if (name.includes('diaphragm')) return labelCodes.diaphragm
  if (name.includes('pleural effusion')) return labelCodes.pleuralFluid
  if (name.includes('atelectatic')) return labelCodes.atelectaticLung
  if (name.includes('lung')) return labelCodes.lung
  if (name.includes('rib') || name.includes('bone') || name.includes('spine')) return labelCodes.rib
  if (name.includes('intercostal') || name.includes('muscle')) return labelCodes.intercostalMuscle
  if (name.includes('liver')) return labelCodes.liver
  if (name.includes('spleen')) return labelCodes.spleen

  return labelCodes.background
}

function splitNrrd(filePath) {
  const buffer = fs.readFileSync(filePath)
  const lfLf = buffer.indexOf(Buffer.from('\n\n'))
  const crlfCrlf = buffer.indexOf(Buffer.from('\r\n\r\n'))
  const headerEnd = lfLf === -1 ? crlfCrlf : crlfCrlf === -1 ? lfLf : Math.min(lfLf, crlfCrlf)

  if (headerEnd === -1) {
    throw new Error(`Could not find NRRD header terminator in ${filePath}`)
  }

  const terminatorLength =
    buffer[headerEnd] === 13 && buffer[headerEnd + 1] === 10 && buffer[headerEnd + 2] === 13 ? 4 : 2

  return {
    header: buffer.subarray(0, headerEnd).toString('utf8'),
    payload: buffer.subarray(headerEnd + terminatorLength),
  }
}

function parseVector(text) {
  return text
    .replace(/[()]/g, '')
    .split(',')
    .map((value) => Number(value.trim()))
}

function parseHeader(header) {
  const lines = header.split(/\r?\n/)
  const fields = new Map()
  const segments = new Map()

  for (const line of lines) {
    const segmentValue = line.match(/^Segment(\d+)_(\w+):=(.*)$/)
    if (segmentValue) {
      const [, indexText, key, value] = segmentValue
      const index = Number(indexText)
      const current = segments.get(index) ?? { index }
      current[key] = value
      segments.set(index, current)
      continue
    }

    const keyValue = line.match(/^([^:#][^:]*):\s*(.*)$/)
    if (keyValue) {
      fields.set(keyValue[1].trim(), keyValue[2].trim())
      continue
    }
  }

  const sizes = fields
    .get('sizes')
    ?.split(/\s+/)
    .map((value) => Number(value))

  if (!sizes || sizes.length !== 4) {
    throw new Error(`Expected a 4D Slicer segmentation, received sizes: ${fields.get('sizes')}`)
  }

  const directions = fields
    .get('space directions')
    ?.split(/\s+(?=\(|none)/)
    .filter(Boolean)

  if (!directions || directions.length !== 4) {
    throw new Error('Missing or unsupported NRRD space directions.')
  }

  return {
    sizes,
    encoding: fields.get('encoding') ?? 'raw',
    space: fields.get('space') ?? 'left-posterior-superior',
    spacingMm: directions.slice(1).map((direction) => {
      const vector = parseVector(direction)
      return Math.hypot(...vector)
    }),
    originLpsMm: parseVector(fields.get('space origin') ?? '(0,0,0)'),
    segments: [...segments.values()].map((segment) => ({
      index: segment.index,
      name: String(segment.Name ?? '').trim(),
      layer: Number(segment.Layer),
      labelValue: Number(segment.LabelValue),
      extent: String(segment.Extent ?? '')
        .split(/\s+/)
        .map((value) => Number(value)),
    })),
  }
}

function sourceOffset({ sourceX, sourceY, sourceZ, layer, sourceSizeX, sourceSizeY, layerCount }) {
  return layer + layerCount * (sourceX + sourceSizeX * (sourceY + sourceSizeY * sourceZ))
}

function worldFromVoxel(index, origin, spacing) {
  return [
    origin[0] + index[0] * spacing[0],
    origin[1] + index[1] * spacing[1],
    origin[2] + index[2] * spacing[2],
  ]
}

function updateBounds(bounds, label, backgroundCode, sourceIndex, origin, spacing) {
  if (label === backgroundCode) {
    return
  }

  const world = worldFromVoxel(sourceIndex, origin, spacing)
  const current = bounds[label] ?? {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    voxels: 0,
  }

  for (let axis = 0; axis < 3; axis += 1) {
    current.min[axis] = Math.min(current.min[axis], world[axis])
    current.max[axis] = Math.max(current.max[axis], world[axis])
  }
  current.voxels += 1
  bounds[label] = current
}

function lerp(min, max, fraction) {
  return min + (max - min) * fraction
}

function chooseOutputLabel(payload, header, labelCodes, labelPriority, targetLabelForName) {
  const [layerCount, sourceSizeX, sourceSizeY] = header.sizes
  const segmentLookup = new Map()

  for (const segment of header.segments) {
    const label = targetLabelForName(segment.name, labelCodes)
    if (label === labelCodes.background) {
      continue
    }
    segmentLookup.set(`${segment.layer}:${segment.labelValue}`, label)
  }

  return function labelAt(sourceX, sourceY, sourceZ) {
    let bestLabel = labelCodes.background
    let bestPriority = 0

    for (let layer = 0; layer < layerCount; layer += 1) {
      const value =
        payload[
          sourceOffset({ sourceX, sourceY, sourceZ, layer, sourceSizeX, sourceSizeY, layerCount })
        ]
      if (!value) {
        continue
      }

      const label = segmentLookup.get(`${layer}:${value}`) ?? labelCodes.background
      const priority = labelPriority[label] ?? 0
      if (priority > bestPriority) {
        bestLabel = label
        bestPriority = priority
      }
    }

    return bestLabel
  }
}

const structureCategoryByLabel = {
  skin: 'chest-wall',
  subcutaneousTissue: 'chest-wall',
  intercostalMuscle: 'chest-wall',
  muscle: 'chest-wall',
  rib: 'chest-wall',
  lung: 'lung',
  atelectaticLung: 'lung',
  consolidation: 'lung',
  pleuralFluid: 'fluid',
  septation: 'fluid',
  debris: 'fluid',
  diaphragm: 'diaphragm',
  liver: 'solid-organ',
  spleen: 'solid-organ',
  kidney: 'solid-organ',
  greatVessel: 'vessel',
  heart: 'cardiac',
  pericardium: 'cardiac',
  airway: 'airway',
}

const hazardLabels = new Set(['rib', 'diaphragm', 'liver', 'spleen', 'kidney', 'heart', 'greatVessel'])

const structureColorByLabel = {
  skin: '#d4a373',
  subcutaneousTissue: '#e9c46a',
  intercostalMuscle: '#bc4749',
  rib: '#e5e7eb',
  lung: '#94a3b8',
  atelectaticLung: '#64748b',
  pleuralFluid: '#2563eb',
  septation: '#93c5fd',
  debris: '#a8a29e',
  diaphragm: '#f59e0b',
  liver: '#b45309',
  spleen: '#7c3aed',
}

function humanizeLabel(label) {
  const spaced = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const defaultSafetyLabel =
  'Educational simulation only; not for diagnosis, treatment, or procedure guidance.'

const defaultEducationalUse =
  'Synthetic educational frame index for simulation training only; not for diagnosis or clinical use.'

export function generateCasePackage(options) {
  const {
    sourceDir,
    outputDir,
    caseId,
    baseUrl,
    schema = 'v2',
    segmentationFileName,
    meshFileName,
    probeFileName = 'ultrasound probe.glb',
    name,
    description,
    safetyLabel = defaultSafetyLabel,
    anatomicRegion = 'thoracic',
    supportedApplications = ['pleural-effusion'],
    objectives,
    groundTruthPattern = 'simpleAnechoic',
    labelCodes = defaultLabelCodes,
    labelPriority = defaultLabelPriority,
    targetLabelForName = defaultTargetLabelForName,
    strideXyz = [2, 2, 2],
    plusToolkit,
    log = console.log,
  } = options

  const sourceSegmentation = path.join(sourceDir, segmentationFileName)
  const sourceMesh = path.join(sourceDir, meshFileName)
  const sourceProbeModel = path.join(sourceDir, probeFileName)

  if (!fs.existsSync(sourceSegmentation)) {
    throw new Error(`Missing segmentation: ${sourceSegmentation}`)
  }
  if (!fs.existsSync(sourceMesh)) {
    throw new Error(`Missing mesh: ${sourceMesh}`)
  }

  fs.mkdirSync(outputDir, { recursive: true })

  const { header: headerText, payload: compressedPayload } = splitNrrd(sourceSegmentation)
  const header = parseHeader(headerText)
  const payload =
    header.encoding.toLowerCase() === 'gzip' || header.encoding.toLowerCase() === 'gz'
      ? zlib.gunzipSync(compressedPayload)
      : compressedPayload

  const [layerCount, sourceSizeX, sourceSizeY, sourceSizeZ] = header.sizes
  const expectedLength = layerCount * sourceSizeX * sourceSizeY * sourceSizeZ
  if (payload.length < expectedLength) {
    throw new Error(
      `Segmentation payload is shorter than expected: ${payload.length}/${expectedLength}`,
    )
  }

  const stride = strideXyz
  const outputSize = [
    Math.ceil(sourceSizeX / stride[0]),
    Math.ceil(sourceSizeY / stride[1]),
    Math.ceil(sourceSizeZ / stride[2]),
  ]
  const output = new Uint8Array(outputSize[0] * outputSize[1] * outputSize[2])
  const labelAt = chooseOutputLabel(payload, header, labelCodes, labelPriority, targetLabelForName)
  const bounds = {}
  const counts = Object.fromEntries(Object.values(labelCodes).map((code) => [code, 0]))

  for (let outZ = 0; outZ < outputSize[2]; outZ += 1) {
    const sourceZStart = outZ * stride[2]
    const sourceZEnd = Math.min(sourceSizeZ, sourceZStart + stride[2])

    for (let outY = 0; outY < outputSize[1]; outY += 1) {
      const sourceYStart = outY * stride[1]
      const sourceYEnd = Math.min(sourceSizeY, sourceYStart + stride[1])

      for (let outX = 0; outX < outputSize[0]; outX += 1) {
        const sourceXStart = outX * stride[0]
        const sourceXEnd = Math.min(sourceSizeX, sourceXStart + stride[0])
        let bestLabel = labelCodes.background
        let bestPriority = 0
        let bestSource = [
          Math.min(sourceSizeX - 1, sourceXStart + Math.floor(stride[0] / 2)),
          Math.min(sourceSizeY - 1, sourceYStart + Math.floor(stride[1] / 2)),
          Math.min(sourceSizeZ - 1, sourceZStart + Math.floor(stride[2] / 2)),
        ]

        for (let sourceZ = sourceZStart; sourceZ < sourceZEnd; sourceZ += 1) {
          for (let sourceY = sourceYStart; sourceY < sourceYEnd; sourceY += 1) {
            for (let sourceX = sourceXStart; sourceX < sourceXEnd; sourceX += 1) {
              const label = labelAt(sourceX, sourceY, sourceZ)
              const priority = labelPriority[label] ?? 0
              if (priority > bestPriority) {
                bestLabel = label
                bestPriority = priority
                bestSource = [sourceX, sourceY, sourceZ]
              }
            }
          }
        }

        const outputIndex = outX + outputSize[0] * (outY + outputSize[1] * outZ)
        output[outputIndex] = bestLabel
        counts[bestLabel] += 1
        updateBounds(bounds, bestLabel, labelCodes.background, bestSource, header.originLpsMm, header.spacingMm)
      }
    }
  }

  const meshOutputPath = path.join(outputDir, `${caseId}.glb`)
  const probeModelOutputPath = path.join(outputDir, 'ultrasound-probe.glb')
  const labelmapOutputPath = path.join(outputDir, `${caseId}.labelmap.uint8.bin`)
  const manifestOutputPath = path.join(outputDir, 'case.json')
  fs.copyFileSync(sourceMesh, meshOutputPath)
  const hasProbeModel = fs.existsSync(sourceProbeModel)
  if (hasProbeModel) {
    fs.copyFileSync(sourceProbeModel, probeModelOutputPath)
  }
  fs.writeFileSync(labelmapOutputPath, output)

  const labels = Object.fromEntries(
    Object.entries(labelCodes).map(([label, code]) => [code, label]),
  )
  const boundsByLabel = Object.fromEntries(
    Object.entries(bounds).map(([code, box]) => [labels[code] ?? code, box]),
  )
  const fluidBox = boundsByLabel.pleuralFluid
  const skinBox = boundsByLabel.skin
  const probeDefaults = {
    lateralMm: fluidBox ? lerp(fluidBox.min[0], fluidBox.max[0], 0.2) : 0,
    posteriorMm: skinBox
      ? skinBox.max[1] + 8
      : header.originLpsMm[1] + sourceSizeY * header.spacingMm[1],
    craniocaudalMm: fluidBox ? lerp(fluidBox.min[2], fluidBox.max[2], 0.06) : -430,
    tiltDeg: -2,
    rotationDeg: 0,
    depthCm: 12,
    gain: 1.05,
    dynamicRangeDb: 56,
    sectorAngleDeg: 62,
    needleAngleDeg: 0,
  }

  const volume = {
    sizeXyz: outputSize,
    sourceSizeXyz: [sourceSizeX, sourceSizeY, sourceSizeZ],
    strideXyz: stride,
    spacingXyzMm: header.spacingMm.map((value, index) => value * stride[index]),
    originLpsMm: header.originLpsMm,
    coordinateSystem: 'LPS',
  }

  const source = {
    segmentationFileName: path.basename(sourceSegmentation),
    meshFileName: path.basename(sourceMesh),
    originalSegmentationFormat: 'Slicer 4D .seg.nrrd',
    sourceSizeXyz: [sourceSizeX, sourceSizeY, sourceSizeZ],
    sourceLayerCount: layerCount,
    sourceSpace: header.space,
    sourcePolicy:
      'Raw CT and Slicer segmentation stay local. This manifest references only derived educational browser assets.',
  }

  const resolvedObjectives = objectives ?? [
    'Find the largest dependent pleural fluid pocket.',
    'Avoid rib shadow, diaphragm, liver, and spleen in the access trajectory.',
    'Identify lung, atelectatic lung behavior, and pleural fluid boundaries.',
    'Classify the effusion pattern and connect the view to thoracentesis planning.',
  ]

  let manifest
  if (schema === 'pleural-v1') {
    manifest = {
      id: caseId,
      name:
        name ?? 'Patient-specific pleural effusion ultrasound simulator',
      description:
        description ??
        'Derived educational case from a Slicer segmentation with skin, diaphragm, pleural effusion, lungs, chest wall, and upper abdominal structures.',
      safetyLabel,
      meshUrl: `${baseUrl}${caseId}.glb`,
      ...(hasProbeModel ? { probeModelUrl: `${baseUrl}ultrasound-probe.glb` } : {}),
      labelmapUrl: `${baseUrl}${caseId}.labelmap.uint8.bin`,
      labelmapFormat: 'uint8-single-label',
      labels,
      labelCounts: counts,
      labelBoundsLpsMm: boundsByLabel,
      ...(plusToolkit ? { plusToolkit } : {}),
      source,
      volume,
      probeDefaults,
      objectives: resolvedObjectives,
      groundTruthPattern,
    }
  } else {
    const structures = Object.entries(labels)
      .filter(([, label]) => label !== 'background')
      .map(([code, label]) => ({
        label,
        displayName: humanizeLabel(label),
        category: structureCategoryByLabel[label] ?? 'other',
        code: Number(code),
        ...(boundsByLabel[label] ? { boundsLpsMm: boundsByLabel[label] } : {}),
        ...(structureColorByLabel[label] ? { color: structureColorByLabel[label] } : {}),
        defaultVisible: true,
        ...(hazardLabels.has(label) ? { hazard: true } : {}),
      }))

    manifest = {
      schemaVersion: 2,
      id: caseId,
      name: name ?? 'Thoracic ultrasound simulator case',
      description:
        description ??
        'Derived educational case package generated from a local Slicer segmentation and surface model.',
      safetyLabel,
      anatomicRegion,
      supportedApplications,
      meshUrl: `${baseUrl}${caseId}.glb`,
      ...(hasProbeModel ? { probeModelUrl: `${baseUrl}ultrasound-probe.glb` } : {}),
      primaryLabelVolume: {
        id: `${caseId}-labelmap`,
        url: `${baseUrl}${caseId}.labelmap.uint8.bin`,
        format: 'uint8-single-label',
        geometry: volume,
        labelCodes: labels,
      },
      labelVolumeUrl: `${baseUrl}${caseId}.labelmap.uint8.bin`,
      structures,
      probePresets: [
        {
          id: 'curvilinear-default',
          label: 'Curvilinear (case default)',
          probeType: 'curvilinear',
          description: 'Default transducer position derived from the segmented fluid bounds.',
          defaults: probeDefaults,
          ranges: {
            lateralMm: {
              min: fluidBox ? Math.floor(fluidBox.min[0] - 50) : -160,
              max: fluidBox ? Math.ceil(fluidBox.max[0] + 50) : 170,
              step: 2,
            },
            posteriorMm: {
              min: skinBox ? Math.floor(skinBox.max[1] - 60) : -110,
              max: skinBox ? Math.ceil(skinBox.max[1] + 18) : -15,
              step: 2,
            },
            craniocaudalMm: {
              min: fluidBox ? Math.floor(fluidBox.min[2] - 45) : -500,
              max: fluidBox ? Math.ceil(fluidBox.max[2] + 45) : -180,
              step: 2,
            },
            tiltDeg: { min: -28, max: 28, step: 1 },
            rotationDeg: { min: -55, max: 55, step: 1 },
            needleAngleDeg: { min: -25, max: 25, step: 1 },
            depthCm: { min: 6, max: 18, step: 0.5 },
            gain: { min: 0.7, max: 2.4, step: 0.05 },
            dynamicRangeDb: { min: 40, max: 80, step: 2 },
            sectorAngleDeg: { min: 40, max: 80, step: 1 },
          },
        },
      ],
      defaultProbePresetId: 'curvilinear-default',
      frameSources: [
        {
          id: 'browser-raymarch',
          kind: 'browser-raymarch',
          status: 'acceptable',
          priority: 0,
          notes:
            'Live browser-generated render: updates with every probe move. Synthetic educational imagery only; set qualityStatus.browserRaymarch to "prototype" to hide it for this case.',
        },
        {
          id: 'plus-atlas',
          kind: 'plus-atlas',
          status: 'reviewed',
          priority: 1,
          indexUrl: `${baseUrl}frames/frames.json`,
          notes: 'Pose-indexed offline frame set; entries stay hidden until reviewed.',
        },
        { id: 'placeholder', kind: 'placeholder', status: 'placeholder', priority: 3 },
      ],
      qualityStatus: {
        overall: 'mixed',
        browserRaymarch: 'acceptable',
        atlas: 'none',
        notes: [
          'Freshly generated case package; live browser render is displayed, no reviewed frames yet.',
        ],
      },
      learningTasks: resolvedObjectives.map((objective, index) => {
        const lower = objective.toLowerCase()
        const kind = lower.includes('classif')
          ? 'classify-pattern'
          : lower.includes('avoid')
            ? 'avoid-hazard'
            : lower.includes('identify')
              ? 'identify-structure'
              : lower.includes('find') || lower.includes('locate')
                ? 'find-window'
                : 'free-explore'
        return {
          id: `objective-${index + 1}`,
          kind,
          prompt: objective,
          ...(kind === 'classify-pattern' && groundTruthPattern
            ? { hiddenGroundTruth: groundTruthPattern }
            : {}),
        }
      }),
      source,
    }
  }

  fs.writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`)
  log(`Wrote ${manifestOutputPath}`)
  log(`Wrote ${labelmapOutputPath} (${output.length} bytes)`)
  log(`Wrote ${meshOutputPath}`)
  if (hasProbeModel) {
    log(`Wrote ${probeModelOutputPath}`)
  }
  log('Output labels:', counts)

  return { manifest, manifestOutputPath, labelmapOutputPath, meshOutputPath }
}

function parseCliArgs(argv) {
  const positional = []
  const flags = {}
  for (const arg of argv) {
    const match = arg.match(/^--([a-z-]+)=(.*)$/)
    if (match) {
      flags[match[1]] = match[2]
    } else {
      positional.push(arg)
    }
  }
  return { positional, flags }
}

function main() {
  const repoRoot = process.cwd()
  const { positional, flags } = parseCliArgs(process.argv.slice(2))
  const caseId = flags['case-id'] ?? 'thoracic-case-001'
  const moduleDir = flags.module ?? 'thoracic-ultrasound-simulator'
  const sourceDir = positional[0] ?? path.join(repoRoot, 'Pleural_effusion_simulation')
  const outputDir =
    positional[1] ?? path.join(repoRoot, 'public', 'module-assets', 'v1', moduleDir, caseId)

  generateCasePackage({
    sourceDir,
    outputDir,
    caseId,
    baseUrl: `/module-assets/v1/${moduleDir}/${caseId}/`,
    schema: flags.schema ?? 'v2',
    segmentationFileName: flags.segmentation ?? '19_CT_HR segmentation_final.seg.nrrd',
    meshFileName: flags.mesh ?? 'effusion_model.glb',
    probeFileName: flags.probe ?? 'ultrasound probe.glb',
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main()
}
