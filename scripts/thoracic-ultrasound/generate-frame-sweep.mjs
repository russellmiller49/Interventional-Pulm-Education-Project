/**
 * Offline pose-sweep index generator.
 *
 * Sweeps a probe-pose grid over a generated case package and writes
 * frames/frames.json next to case.json: one entry per pose with the probe
 * transform, imaging settings, geometry metrics (computed here from the
 * labelmap, matching the runtime engine's metrics-only pass), the expected
 * image filename, generator provenance, review status, and an educational-use
 * note.
 *
 * IMPORTANT: this script does NOT run the native offline simulation pipeline
 * and does NOT create images. Every entry is written with
 * reviewStatus: 'needs-review', so the runtime provider stack ignores the set
 * until (a) the offline pipeline renders frames/<id>.png for each entry and
 * (b) a reviewer flips reviewStatus to 'reviewed'. Learners never see an
 * unreviewed frame.
 *
 * Usage:
 *   node scripts/thoracic-ultrasound/generate-frame-sweep.mjs <caseDir> [--lateral-step=20] [--cc-step=20] [--tilts=-6,0,6]
 */
import fs from 'node:fs'
import path from 'node:path'

const degreesToRadians = Math.PI / 180

/* --- geometry (mirrors src/features/thoracic-ultrasound-simulator/engine) --- */

function probeOrigin(probe) {
  return [probe.lateralMm, probe.posteriorMm, probe.craniocaudalMm]
}

function beamDirection(probe, sectorAngleDeg) {
  const markerRad = probe.rotationDeg * degreesToRadians
  const tiltRad = probe.tiltDeg * degreesToRadians
  const sectorRad = sectorAngleDeg * degreesToRadians

  const lateralAxis = [Math.cos(markerRad), 0, Math.sin(markerRad)]
  const depthAxis = [0, -Math.cos(tiltRad), Math.sin(tiltRad)]
  const lateralWeight = Math.sin(sectorRad)
  const depthWeight = Math.cos(sectorRad)

  const direction = [
    lateralAxis[0] * lateralWeight + depthAxis[0] * depthWeight,
    lateralAxis[1] * lateralWeight + depthAxis[1] * depthWeight,
    lateralAxis[2] * lateralWeight + depthAxis[2] * depthWeight,
  ]
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1

  return [direction[0] / length, direction[1] / length, direction[2] / length]
}

function projectBeamToWorld(probe, sectorAngleDeg, depthMm) {
  const origin = probeOrigin(probe)
  const direction = beamDirection(probe, sectorAngleDeg)
  return [
    origin[0] + direction[0] * depthMm,
    origin[1] + direction[1] * depthMm,
    origin[2] + direction[2] * depthMm,
  ]
}

function makeSampler(volume) {
  const { data, geometry } = volume
  const [sizeX, sizeY, sizeZ] = geometry.sizeXyz
  const [spacingX, spacingY, spacingZ] = geometry.spacingXyzMm
  const [originX, originY, originZ] = geometry.originLpsMm

  return function sampleCode(world) {
    const x = Math.round((world[0] - originX) / spacingX)
    const y = Math.round((world[1] - originY) / spacingY)
    const z = Math.round((world[2] - originZ) / spacingZ)
    if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) {
      return 0
    }
    return data[x + sizeX * (y + sizeY * z)] ?? 0
  }
}

/* --- metrics (mirrors simulateBMode renderImage:false + assessNeedlePath) --- */

function assessNeedlePath(sampleCode, labelFor, isSolidOrgan, fluidLabel, probe, stepMm = 2) {
  const maxDepthMm = probe.depthCm * 10
  let ribHit = false
  let diaphragmHit = false
  let solidOrganHit = false
  let lungHit = false
  let currentFluidRun = 0
  let bestFluidRun = 0
  let firstFluidDepthMm = null

  for (let depthMm = 0; depthMm <= maxDepthMm; depthMm += stepMm) {
    const label = labelFor(sampleCode(projectBeamToWorld(probe, probe.needleAngleDeg, depthMm)))

    if (label === 'rib') ribHit = true
    if (label === 'diaphragm') diaphragmHit = true
    if (isSolidOrgan(label)) solidOrganHit = true
    if (label === 'lung' || label === 'atelectaticLung' || label === 'consolidation') lungHit = true

    if (label === fluidLabel) {
      firstFluidDepthMm ??= depthMm
      currentFluidRun += stepMm
      bestFluidRun = Math.max(bestFluidRun, currentFluidRun)
    } else {
      currentFluidRun = 0
    }
  }

  return {
    ribHit,
    diaphragmHit,
    solidOrganHit,
    lungHit,
    fluidRunMm: bestFluidRun,
    firstFluidDepthMm,
    safeWindow: bestFluidRun >= 25 && !ribHit && !diaphragmHit && !solidOrganHit,
  }
}

function computeMetrics(sampleCode, labelFor, probe, { width = 520, height = 620 } = {}) {
  const isSolidOrgan = (label) => label === 'liver' || label === 'spleen' || label === 'kidney'
  const fluidLabel = 'pleuralFluid'
  const maxDepthMm = probe.depthCm * 10
  const stepMm = maxDepthMm / Math.max(1, height - 1)
  const beamCount = Math.round(width * 1.25)
  const fluidRuns = []
  let ribShadowBeamCount = 0
  let fluidBeamCount = 0
  let diaphragmSeen = false
  let lungSeen = false
  let solidOrganSeen = false

  for (let beam = 0; beam < beamCount; beam += 1) {
    const beamFraction = beam / Math.max(1, beamCount - 1)
    const sectorAngleDeg = probe.sectorAngleDeg * (beamFraction - 0.5)
    let currentFluidRun = 0
    let bestFluidRun = 0
    let ribHitOnBeam = false

    for (let sample = 0; sample < height; sample += 1) {
      const depthMm = (sample / Math.max(1, height - 1)) * maxDepthMm
      const label = labelFor(sampleCode(projectBeamToWorld(probe, sectorAngleDeg, depthMm)))

      if (label === 'diaphragm') diaphragmSeen = true
      if (label === 'lung' || label === 'atelectaticLung' || label === 'consolidation') {
        lungSeen = true
      }
      if (isSolidOrgan(label)) solidOrganSeen = true
      if (label === 'rib' && depthMm < 52) ribHitOnBeam = true

      if (label === fluidLabel) {
        currentFluidRun += stepMm
        bestFluidRun = Math.max(bestFluidRun, currentFluidRun)
      } else {
        currentFluidRun = 0
      }
    }

    if (bestFluidRun > 0) fluidBeamCount += 1
    if (ribHitOnBeam) ribShadowBeamCount += 1
    fluidRuns.push(bestFluidRun)
  }

  const maxFluidPocketMm = Math.max(0, ...fluidRuns)
  const fluidRunsAboveNoise = fluidRuns.filter((run) => run > 2)
  const meanFluidPocketMm =
    fluidRunsAboveNoise.reduce((total, run) => total + run, 0) /
    Math.max(1, fluidRunsAboveNoise.length)

  return {
    maxFluidPocketMm,
    meanFluidPocketMm,
    fluidBeamFraction: fluidBeamCount / beamCount,
    ribShadowBeamFraction: ribShadowBeamCount / beamCount,
    diaphragmSeen,
    lungSeen,
    solidOrganSeen,
    centralNeedle: assessNeedlePath(sampleCode, labelFor, isSolidOrgan, fluidLabel, probe),
  }
}

/* --- manifest handling (accepts legacy v1 and schemaVersion-2 cases) --- */

function readCase(caseDir) {
  const manifestPath = path.join(caseDir, 'case.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  const isV2 = manifest.schemaVersion === 2
  const labelCodes = isV2 ? manifest.primaryLabelVolume.labelCodes : manifest.labels
  const geometry = isV2 ? manifest.primaryLabelVolume.geometry : manifest.volume
  const labelmapUrl = isV2 ? manifest.primaryLabelVolume.url : manifest.labelmapUrl
  const labelmapPath = path.join(caseDir, path.basename(labelmapUrl))
  const data = new Uint8Array(fs.readFileSync(labelmapPath))

  const probeDefaults = isV2
    ? (manifest.probePresets.find((preset) => preset.id === manifest.defaultProbePresetId) ??
        manifest.probePresets[0]).defaults
    : manifest.probeDefaults

  const fluidBounds = isV2
    ? manifest.structures.find((structure) => structure.category === 'fluid' && structure.boundsLpsMm)
        ?.boundsLpsMm
    : manifest.labelBoundsLpsMm?.pleuralFluid

  const groundTruthKey = isV2
    ? (manifest.learningTasks.find((task) => task.kind === 'classify-pattern')?.hiddenGroundTruth ??
        'unknown')
    : (manifest.groundTruthPattern ?? 'unknown')

  return { manifest, labelCodes, geometry, data, probeDefaults, fluidBounds, groundTruthKey }
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
  const { positional, flags } = parseCliArgs(process.argv.slice(2))
  const caseDir = positional[0]
  if (!caseDir) {
    console.error(
      'Usage: node scripts/thoracic-ultrasound/generate-frame-sweep.mjs <caseDir> [--lateral-step=20] [--cc-step=20] [--tilts=-6,0,6] [--margin=30]',
    )
    process.exit(1)
  }

  const { labelCodes, geometry, data, probeDefaults, fluidBounds, groundTruthKey } =
    readCase(caseDir)

  const labelFor = (code) => labelCodes[String(code)] ?? 'background'
  const sampleCode = makeSampler({ data, geometry })

  const lateralStep = Number(flags['lateral-step'] ?? 20)
  const ccStep = Number(flags['cc-step'] ?? 20)
  const margin = Number(flags.margin ?? 30)
  const tilts = (flags.tilts ?? String(probeDefaults.tiltDeg))
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value))

  const lateralMin = fluidBounds ? fluidBounds.min[0] - margin : probeDefaults.lateralMm - 60
  const lateralMax = fluidBounds ? fluidBounds.max[0] + margin : probeDefaults.lateralMm + 60
  const ccMin = fluidBounds ? fluidBounds.min[2] - margin : probeDefaults.craniocaudalMm - 60
  const ccMax = fluidBounds ? fluidBounds.max[2] + margin : probeDefaults.craniocaudalMm + 60

  const entries = []
  for (let lateralMm = lateralMin; lateralMm <= lateralMax; lateralMm += lateralStep) {
    for (let ccMm = ccMin; ccMm <= ccMax; ccMm += ccStep) {
      for (const tiltDeg of tilts) {
        const probe = {
          ...probeDefaults,
          lateralMm: Math.round(lateralMm * 10) / 10,
          craniocaudalMm: Math.round(ccMm * 10) / 10,
          tiltDeg,
        }
        const metrics = computeMetrics(sampleCode, labelFor, probe)
        const id = `pose-lat${Math.round(lateralMm)}-cc${Math.round(ccMm)}-tilt${tiltDeg}`

        entries.push({
          id,
          label: `Sweep pose (${Math.round(lateralMm)}, ${Math.round(ccMm)}, tilt ${tiltDeg})`,
          description:
            'Pose-swept teaching frame slot; the image is produced by the offline simulation pipeline and reviewed before use.',
          imageUrl: `${id}.png`,
          probe,
          metrics,
          groundTruthKey,
          generator: {
            source: 'plus-offline',
            name: 'thoracic-ultrasound frame sweep',
            version: '1',
            notes: [
              'Metrics computed from the case labelmap by generate-frame-sweep.mjs.',
              'Image expected from the offline simulation pipeline; run it separately.',
            ],
          },
          reviewStatus: 'needs-review',
          educationalUse:
            'Synthetic educational frame for simulation training only; not for diagnosis or clinical use. Hidden from learners until reviewed.',
          tags: ['sweep'],
        })
      }
    }
  }

  const framesDir = path.join(caseDir, 'frames')
  fs.mkdirSync(framesDir, { recursive: true })
  const index = {
    selectionTolerance: {
      lateralMm: Math.max(8, lateralStep * 0.75),
      craniocaudalMm: Math.max(8, ccStep * 0.75),
      tiltDeg: 6,
      rotationDeg: 10,
      depthCm: 1.25,
      sectorAngleDeg: 8,
    },
    notes: [
      'Generated by scripts/thoracic-ultrasound/generate-frame-sweep.mjs.',
      'All entries start as needs-review and are ignored by the runtime until a reviewer flips reviewStatus to reviewed.',
      'Educational simulation assets only; not for diagnosis or clinical use.',
    ],
    entries,
  }

  const indexPath = path.join(framesDir, 'frames.json')
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)
  console.log(`Wrote ${indexPath} (${entries.length} pose entries, all needs-review)`)
}

main()
