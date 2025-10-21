// Quick test to verify Three.js imports work
import { WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

console.log('✅ Three.js imports successful!')
console.log('  - WebGLRenderer:', typeof WebGLRenderer)
console.log('  - GLTFLoader:', typeof GLTFLoader)
console.log('  - DRACOLoader:', typeof DRACOLoader)
