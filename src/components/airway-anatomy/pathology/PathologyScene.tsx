'use client'

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bleedingAmount, type BleedingLevel } from '@/lib/airway-anatomy/pathology/model'
import type { PathologyScene as Scene } from './usePathology'

const vertexShader = `
varying vec3 vPosition; varying vec3 vNormal; varying vec3 vTissue; varying vec2 vFilm;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosition=world.xyz; vNormal=normalize(mat3(modelMatrix)*normal);
  vTissue=color.rgb; vFilm=uv;
  gl_Position=projectionMatrix*viewMatrix*world;
}`
const fragmentShader = `
varying vec3 vPosition; varying vec3 vNormal; varying vec3 vTissue;
uniform float uBlood;
float hash3(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float tissueNoise(vec3 p) {
 vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main() {
  vec3 view=normalize(cameraPosition-vPosition);
  vec3 n=normalize(vNormal);
  float fine=tissueNoise(vPosition*3.5);
  vec3 dx=dFdx(vPosition), dy=dFdy(vPosition);
  vec3 rx=cross(dy,n), ry=cross(n,dx);
  float determinant=dot(dx,rx);
  vec3 gradient=sign(determinant)*(dFdx(fine)*rx+dFdy(fine)*ry);
  if(abs(determinant)>.0000001) n=normalize(abs(determinant)*n-.045*gradient);
  float facing=max(dot(n,view),0.0);
  float distanceMm=length(cameraPosition-vPosition);
  vec3 cameraRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
  vec3 light=normalize(cameraPosition+cameraRight*1.1-vPosition);
  vec3 halfVector=normalize(light+view);
  float wet=pow(max(dot(n,halfVector),0.0),mix(45.0,105.0,fine))*.42;
  float falloff=1.0/(1.0+pow(distanceMm/23.0,1.65));
  float coating=uBlood*smoothstep(.25,.65,tissueNoise(vPosition*.42));
  vec3 tissue=mix(vTissue*(.86+fine*.25),vec3(.22,.005,.012),coating*.92);
  vec3 c=(tissue*(.19+.81*pow(facing,.68))*1.65+vec3(.92,.84,.77)*wet)*falloff;
  gl_FragColor=vec4(pow(max(c,vec3(0)),vec3(.5)),1.0);
}`
const filmVertex = `
varying vec3 vPosition; varying vec3 vNormal; varying vec2 vFilm;
void main() {
 vec4 p=modelMatrix*vec4(position,1); vPosition=p.xyz;
 vNormal=normalize(mat3(modelMatrix)*normal); vFilm=uv;
 gl_Position=projectionMatrix*viewMatrix*p;
}`
const filmFragment = `
varying vec3 vPosition; varying vec3 vNormal; varying vec2 vFilm;
uniform float uTime; uniform float uAmount;
void main() {
 float spread=.045+uAmount*.44;
 float flow=sin(vFilm.y*23.0-uTime*1.8)*.018+sin(vFilm.y*43.0+uTime)*.008;
 float edge=abs(vFilm.x-.5+flow);
 float width=spread*(.48+.52*vFilm.y);
 float alpha=(1.0-smoothstep(width*.72,width,edge));
 alpha*=1.0-smoothstep(uAmount*.88+.1,uAmount+.16,vFilm.y);
 alpha*=smoothstep(0.0,.045,vFilm.y);
 if(alpha<.005) discard;
 vec3 view=normalize(cameraPosition-vPosition);
 float shine=pow(abs(dot(normalize(vNormal),view)),40.0)*.20;
 float streak=.75+.25*sin(vFilm.y*55.0-uTime*2.4+vFilm.x*18.0);
 float falloff=1.0/(1.0+pow(length(cameraPosition-vPosition)/25.0,1.65));
 vec3 blood=(vec3(.30,.004,.009)*streak+vec3(.8,.35,.30)*shine)*falloff;
 gl_FragColor=vec4(pow(blood,vec3(.5)),alpha*.93);
}`

export function PathologyMeshes({
  scene,
  bleeding,
  time,
  elapsed,
  external = false,
}: {
  scene: Scene
  bleeding: BleedingLevel
  time: RefObject<number>
  elapsed: number
  external?: boolean
}) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    invalidate()
  }, [invalidate, elapsed])
  const tissue = useMemo(
    () =>
      external
        ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28 })
        : new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            vertexColors: true,
            toneMapped: false,
            uniforms: { uBlood: { value: 0 } },
          }),
    [external],
  )
  const film = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: filmVertex,
        fragmentShader: filmFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  )
  useEffect(
    () => () => {
      tissue.dispose()
      film.dispose()
    },
    [tissue, film],
  )
  const filmRef = useRef<THREE.ShaderMaterial | null>(null)
  const tissueRef = useRef<THREE.Material | null>(null)
  useEffect(() => {
    filmRef.current = film
    tissueRef.current = tissue
  }, [film, tissue])
  useFrame(() => {
    const material = filmRef.current
    if (!material) return
    material.uniforms.uTime.value = time.current
    material.uniforms.uAmount.value = bleedingAmount(time.current, bleeding)
    if (tissueRef.current instanceof THREE.ShaderMaterial)
      tissueRef.current.uniforms.uBlood.value = bleedingAmount(time.current, bleeding)
  })
  return (
    <group dispose={null}>
      {scene.geometry && <mesh geometry={scene.geometry} material={tissue} />}
      {scene.film && bleeding !== 'off' && (
        <mesh geometry={scene.film} material={film} renderOrder={1} />
      )}
    </group>
  )
}

export function BloodVisibilityOverlay({
  amount,
  visibility,
}: {
  amount: number
  visibility: number
}) {
  const opacity = Math.max(0, amount - 0.18) * visibility * 0.86
  if (opacity <= 0) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        background:
          'radial-gradient(ellipse at 52% 75%, rgba(95,0,4,.96) 2%, rgba(132,5,10,.88) 35%, rgba(130,3,8,.52) 70%, rgba(84,0,5,.25) 100%)',
      }}
    />
  )
}
