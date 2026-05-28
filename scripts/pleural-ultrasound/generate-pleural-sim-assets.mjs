import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const repoRoot = process.cwd()
const sourceDir = process.argv[2] ?? path.join(repoRoot, 'Pleural_effusion_simulation')
const outputDir =
  process.argv[3] ??
  path.join(
    repoRoot,
    'public',
    'module-assets',
    'v1',
    'pleural-ultrasound-simulator',
    'pleural-effusion-001',
  )

const sourceSegmentation = path.join(sourceDir, '19_CT_HR segmentation_final.seg.nrrd')
const sourceMesh = path.join(sourceDir, 'effusion_model.glb')

const labelCodes = {
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

const labelPriority = {
  [labelCodes.background]: 0,
  [labelCodes.subcutaneousTissue]: 5,
  [labelCodes.intercostalMuscle]: 10,
  [labelCodes.skin]: 20,
  [labelCodes.lung]: 30,
  [labelCodes.atelectaticLung]: 38,
  [labelCodes.liver]: 45,
  [labelCodes.spleen]: 45,
  [labelCodes.diaphragm]: 55,
  [labelCodes.pleuralFluid]: 65,
  [labelCodes.septation]: 75,
  [labelCodes.debris]: 75,
  [labelCodes.rib]: 90,
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

function targetLabelForName(rawName) {
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

function updateBounds(bounds, label, sourceIndex, origin, spacing) {
  if (label === labelCodes.background) {
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

function chooseOutputLabel(payload, header) {
  const [layerCount, sourceSizeX, sourceSizeY, sourceSizeZ] = header.sizes
  const segmentLookup = new Map()

  for (const segment of header.segments) {
    const label = targetLabelForName(segment.name)
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

function generateAssets() {
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

  const stride = [2, 2, 2]
  const outputSize = [
    Math.ceil(sourceSizeX / stride[0]),
    Math.ceil(sourceSizeY / stride[1]),
    Math.ceil(sourceSizeZ / stride[2]),
  ]
  const output = new Uint8Array(outputSize[0] * outputSize[1] * outputSize[2])
  const labelAt = chooseOutputLabel(payload, header)
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
        updateBounds(bounds, bestLabel, bestSource, header.originLpsMm, header.spacingMm)
      }
    }
  }

  const meshOutputPath = path.join(outputDir, 'pleural-effusion-001.glb')
  const labelmapOutputPath = path.join(outputDir, 'pleural-effusion-001.labelmap.uint8.bin')
  const manifestOutputPath = path.join(outputDir, 'case.json')
  fs.copyFileSync(sourceMesh, meshOutputPath)
  fs.writeFileSync(labelmapOutputPath, output)

  const labels = Object.fromEntries(
    Object.entries(labelCodes).map(([label, code]) => [code, label]),
  )
  const boundsByLabel = Object.fromEntries(
    Object.entries(bounds).map(([code, box]) => [labels[code] ?? code, box]),
  )
  const pleuralFluidBox = boundsByLabel.pleuralFluid
  const skinBox = boundsByLabel.skin
  const defaultProbe = {
    lateralMm: pleuralFluidBox ? lerp(pleuralFluidBox.min[0], pleuralFluidBox.max[0], 0.2) : 0,
    posteriorMm: skinBox
      ? skinBox.max[1] + 8
      : header.originLpsMm[1] + sourceSizeY * header.spacingMm[1],
    craniocaudalMm: pleuralFluidBox
      ? lerp(pleuralFluidBox.min[2], pleuralFluidBox.max[2], 0.06)
      : -430,
    tiltDeg: -2,
    rotationDeg: 0,
    depthCm: 12,
    gain: 1.05,
    dynamicRangeDb: 56,
    sectorAngleDeg: 62,
    needleAngleDeg: 0,
  }

  const manifest = {
    id: 'pleural-effusion-001',
    name: 'Patient-specific pleural effusion ultrasound simulator',
    description:
      'Derived educational case from a Slicer segmentation with skin, diaphragm, pleural effusion, lungs, chest wall, and upper abdominal structures.',
    safetyLabel:
      'Educational simulation only; not for diagnosis, treatment, or procedure guidance.',
    meshUrl:
      '/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001/pleural-effusion-001.glb',
    labelmapUrl:
      '/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001/pleural-effusion-001.labelmap.uint8.bin',
    labelmapFormat: 'uint8-single-label',
    labels,
    labelCounts: counts,
    labelBoundsLpsMm: boundsByLabel,
    source: {
      segmentationFileName: path.basename(sourceSegmentation),
      meshFileName: path.basename(sourceMesh),
      originalSegmentationFormat: 'Slicer 4D .seg.nrrd',
      sourceSizeXyz: [sourceSizeX, sourceSizeY, sourceSizeZ],
      sourceLayerCount: layerCount,
      sourceSpace: header.space,
      sourcePolicy:
        'Raw CT and Slicer segmentation stay local. This manifest references only derived educational browser assets.',
    },
    volume: {
      sizeXyz: outputSize,
      sourceSizeXyz: [sourceSizeX, sourceSizeY, sourceSizeZ],
      strideXyz: stride,
      spacingXyzMm: header.spacingMm.map((value, index) => value * stride[index]),
      originLpsMm: header.originLpsMm,
      coordinateSystem: 'LPS',
    },
    probeDefaults: defaultProbe,
    objectives: [
      'Find the largest dependent pleural fluid pocket.',
      'Avoid rib shadow, diaphragm, liver, and spleen in the access trajectory.',
      'Identify lung, atelectatic lung behavior, and pleural fluid boundaries.',
      'Classify the effusion pattern and connect the view to thoracentesis planning.',
    ],
    groundTruthPattern: 'simpleAnechoic',
  }

  fs.writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${path.relative(repoRoot, manifestOutputPath)}`)
  console.log(`Wrote ${path.relative(repoRoot, labelmapOutputPath)} (${output.length} bytes)`)
  console.log(`Wrote ${path.relative(repoRoot, meshOutputPath)}`)
  console.log('Output labels:', counts)
}

generateAssets()
