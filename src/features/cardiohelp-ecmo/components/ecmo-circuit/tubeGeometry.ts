import * as THREE from 'three'

// Tube geometry with an aCenter attribute: each vertex carries its ring's
// centerline point so the flow shader can crimp toward it at the clamp
// station. Segment count adapts to curve length (pattern: AirwayXRScene).

export function buildFlowTubeGeometry(
  curve: THREE.CatmullRomCurve3,
  radius: number,
  radialSegments = 12,
): THREE.TubeGeometry {
  const length = curve.getLength()
  const tubularSegments = Math.min(220, Math.max(48, Math.round(length * 56)))
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)

  const vertexCount = geometry.attributes.position.count
  const centers = new Float32Array(vertexCount * 3)
  const ringSize = radialSegments + 1
  const point = new THREE.Vector3()
  for (let ring = 0; ring <= tubularSegments; ring += 1) {
    curve.getPointAt(Math.min(1, ring / tubularSegments), point)
    for (let spoke = 0; spoke < ringSize; spoke += 1) {
      const index = (ring * ringSize + spoke) * 3
      centers[index] = point.x
      centers[index + 1] = point.y
      centers[index + 2] = point.z
    }
  }
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3))
  return geometry
}
