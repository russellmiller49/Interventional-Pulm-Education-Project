/** Renderer-independent shader source shared by all three scope viewers. */
export const mucosaVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}`

export const mucosaFragmentShader = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;
uniform float uWallAlpha;
uniform vec3 uHeadlightAxis;
uniform float uHeadlightFalloff;
float hash3(vec3 p) {
  p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float tissueNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
                 mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                 mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main() {
  vec3 towardLens = normalize(cameraPosition-vWorldPosition);
  vec3 normal = normalize(vNormalWorld);
  if(dot(normal,towardLens)<0.0) normal=-normal;
  float distanceMm=length(cameraPosition-vWorldPosition);
  float broad=tissueNoise(vWorldPosition*0.17);
  float fine=tissueNoise(vWorldPosition*2.2);
  vec3 dx=dFdx(vWorldPosition), dy=dFdy(vWorldPosition);
  vec3 rx=cross(dy,normal), ry=cross(normal,dx);
  float determinant=dot(dx,rx);
  vec3 gradient=sign(determinant)*(dFdx(fine)*rx+dFdy(fine)*ry);
  if(abs(determinant)>0.0000001) normal=normalize(abs(determinant)*normal-0.012*gradient);
  // Continuous tissue coordinates; no voxel-shaped highlights or repeating bands.
  vec3 base=mix(vec3(0.51,0.205,0.19),vec3(0.76,0.395,0.36),broad);
  base*=0.96+fine*0.08;
  float facing=max(dot(normal,towardLens),0.0);
  float diffuse=0.19+0.81*pow(facing,0.68);
  float falloff=1.0/(1.0+pow(distanceMm/23.0,1.65));
  float roughness=mix(0.18,0.32,tissueNoise(vWorldPosition*0.6));
  // A small off-axis illuminator travels with the optical lens. Its smooth lobe
  // produces wet sheen without adding geometric folds or disconnected sparkles.
  vec3 cameraRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
  vec3 lightDirection=normalize(cameraPosition+cameraRight*1.1-vWorldPosition);
  vec3 halfVector=normalize(lightDirection+towardLens);
  float wet=pow(max(dot(normal,halfVector),0.0),2.0/(roughness*roughness))*0.32;
  float cone=smoothstep(0.5,0.94,dot(-towardLens,normalize(uHeadlightAxis)));
  float light=mix(1.0,0.22+0.78*cone,uHeadlightFalloff);
  vec3 color=(base*diffuse*1.65+vec3(0.92,0.84,0.77)*wet)*falloff*light;
  color=mix(vec3(0.012,0.004,0.004),color,1.0-smoothstep(80.0,180.0,distanceMm));
  // Explicit display transfer; the wrapper uses toneMapped:false in every app.
  color=pow(max(color,vec3(0.0)),vec3(1.0/2.0));
  gl_FragColor=vec4(color,uWallAlpha);
}`
