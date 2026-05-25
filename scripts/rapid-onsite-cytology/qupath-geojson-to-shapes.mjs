#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const [geojsonPath, imageWidthArg, imageHeightArg] = process.argv.slice(2)

if (!geojsonPath || !imageWidthArg || !imageHeightArg) {
  console.error(
    'Usage: node scripts/rapid-onsite-cytology/qupath-geojson-to-shapes.mjs annotations.geojson <imageWidthPx> <imageHeightPx>',
  )
  process.exit(1)
}

const imageWidth = Number(imageWidthArg)
const imageHeight = Number(imageHeightArg)

if (
  !Number.isFinite(imageWidth) ||
  !Number.isFinite(imageHeight) ||
  imageWidth <= 0 ||
  imageHeight <= 0
) {
  console.error('Image width and height must be positive numbers.')
  process.exit(1)
}

const geojson = JSON.parse(readFileSync(geojsonPath, 'utf8'))
const features = Array.isArray(geojson.features) ? geojson.features : []

const shapes = features
  .map((feature, index) => {
    const points = pointsFromGeometry(feature.geometry)

    if (points.length === 0) {
      return null
    }

    const bbox = bounds(points)
    const label =
      feature.properties?.name ??
      feature.properties?.classification?.name ??
      feature.properties?.objectType ??
      `annotation-${index + 1}`

    return {
      sourceLabel: label,
      shape: {
        type: 'ellipse',
        xPct: pct((bbox.minX + bbox.maxX) / 2, imageWidth),
        yPct: pct((bbox.minY + bbox.maxY) / 2, imageHeight),
        radiusXPct: pct((bbox.maxX - bbox.minX) / 2, imageWidth),
        radiusYPct: pct((bbox.maxY - bbox.minY) / 2, imageHeight),
      },
    }
  })
  .filter(Boolean)

console.log(
  JSON.stringify(
    {
      source: basename(geojsonPath),
      imageWidth,
      imageHeight,
      count: shapes.length,
      shapes,
    },
    null,
    2,
  ),
)

function pointsFromGeometry(geometry) {
  if (!geometry) {
    return []
  }

  if (geometry.type === 'Point') {
    return [geometry.coordinates]
  }

  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    return geometry.coordinates
  }

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat()
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2)
  }

  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap(pointsFromGeometry)
  }

  return []
}

function bounds(points) {
  return points.reduce(
    (current, [x, y]) => ({
      minX: Math.min(current.minX, x),
      minY: Math.min(current.minY, y),
      maxX: Math.max(current.maxX, x),
      maxY: Math.max(current.maxY, y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  )
}

function pct(value, denominator) {
  return Number(((value / denominator) * 100).toFixed(1))
}
