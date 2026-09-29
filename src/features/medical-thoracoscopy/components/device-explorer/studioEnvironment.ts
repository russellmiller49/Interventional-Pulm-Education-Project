import * as THREE from 'three'

/**
 * The studio the models are lit by, built here so nothing is fetched: a dark room with a floor,
 * a large key softbox above left, a fill strip to the right, a strip overhead and a rim panel
 * behind. Polished steel then shows the dark cards and bright edges of a product studio, as the
 * showcase stills do, instead of reflecting a white room.
 */
export function createStudioEnvironment(): { scene: THREE.Scene; dispose: () => void } {
  const scene = new THREE.Scene()
  const disposables: { dispose: () => void }[] = []
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    disposables.push(geometry, material)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    return mesh
  }
  const walls = add(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x33363b, side: THREE.BackSide }),
  )
  walls.scale.set(24, 14, 24)
  walls.position.y = 4
  const floor = add(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: 0x6b6f76 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.95
  const panel = (
    width: number,
    height: number,
    intensity: number,
    position: [number, number, number],
  ) => {
    const mesh = add(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setScalar(intensity),
        side: THREE.DoubleSide,
      }),
    )
    mesh.position.set(...position)
    mesh.lookAt(0, 0, 0)
  }
  panel(7, 4.5, 9, [-6, 7, 6])
  panel(2.2, 7, 4, [8, 1.5, 3])
  panel(10, 1.4, 6, [0, 10.5, -1])
  panel(5, 5, 5, [3, 4, -9])
  return {
    scene,
    dispose: () => {
      for (const item of disposables) item.dispose()
    },
  }
}
