import type { TriangleMesh } from './proxyGlb'

/**
 * A proxy is used only if it is closed, turned outward and finite, checked when it is loaded
 * (plan, section 4.5): inside and outside mean nothing for a surface that is not.
 */
export function proxyProblems(name: string, mesh: TriangleMesh): readonly string[] {
  const problems: string[] = []
  const { positions, indices } = mesh
  if (indices.length === 0 || indices.length % 3 !== 0) problems.push(`${name}: no whole triangles`)
  for (let i = 0; i < positions.length; i += 1) {
    if (!Number.isFinite(positions[i])) {
      problems.push(`${name}: a position is not a finite number`)
      break
    }
  }
  const vertexCount = positions.length / 3
  const edges = new Map<number, number>()
  for (let f = 0; f < indices.length; f += 3) {
    for (let k = 0; k < 3; k += 1) {
      const a = indices[f + k]
      const b = indices[f + ((k + 1) % 3)]
      if (a >= vertexCount || b >= vertexCount) {
        problems.push(`${name}: an index points past the positions`)
        return problems
      }
      const key = Math.min(a, b) * vertexCount + Math.max(a, b)
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  for (const count of edges.values()) {
    if (count !== 2) {
      problems.push(`${name}: not closed, an edge is shared by ${count} faces`)
      break
    }
  }
  if (signedVolume(mesh) <= 0) problems.push(`${name}: not turned outward`)
  return problems
}

export function signedVolume({ positions, indices }: TriangleMesh): number {
  let total = 0
  for (let f = 0; f < indices.length; f += 3) {
    const a = indices[f] * 3
    const b = indices[f + 1] * 3
    const c = indices[f + 2] * 3
    total +=
      positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
      positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])
  }
  return total / 6
}
