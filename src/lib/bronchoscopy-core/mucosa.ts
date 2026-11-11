/**
 * Renderer-independent shader source shared by all three scope viewers.
 *
 * `MUCOSA_ANATOMY` is an opt-in define. Without it the shader is the shared one, unchanged: every
 * line it adds sits inside an `#ifdef MUCOSA_ANATOMY` block. With it the wall shows its anatomy
 * (cartilage rings on the anterior arc, a membranous strip behind, faint vessels), read from the
 * per-vertex attribute named below, which the viewer that opts in must supply.
 */

/**
 * The per-vertex attribute the anatomy blocks read, four numbers:
 * `cos * cue`, `sin * cue`, ring strength, ring count.
 *
 * The angle is taken around the airway from anatomical posterior; `cue` (0 to 1) is how much wall
 * anatomy this airway shows at all, and is read back as the length of the first two numbers. Ring
 * strength is the cue again, faded where rings should not be drawn; ring count is the distance
 * along the airway measured in rings. A mesh without the attribute reads as no cue at all.
 */
export const MUCOSA_ANATOMY_ATTRIBUTE = 'aAirwayWall'
export const MUCOSA_ANATOMY_DEFINE = 'MUCOSA_ANATOMY'

export const mucosaVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;
#ifdef MUCOSA_ANATOMY
attribute vec4 aAirwayWall;
varying vec4 vAirwayWall;
#endif
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
#ifdef MUCOSA_ANATOMY
  vAirwayWall = aAirwayWall;
#endif
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
#ifdef MUCOSA_ANATOMY
varying vec4 vAirwayWall;
// The wall's anatomy at this point: relief height, paleness (cartilage, and the fine lines of the
// membranous wall), the groove between two rings, and vessel. Everything fades with its own size
// on screen, so far wall never shimmers.
vec4 airwayWallAnatomy(vec3 p, float mmPerPixel) {
  float cue=length(vAirwayWall.xy);
  if(cue<0.002) return vec4(0.0);
  vec2 around=vAirwayWall.xy/cue;
  // Rings: a paler raised band, uneven in spacing and in how far each one stands out, open
  // behind where the wall is membranous. The C's two ends are not cut on one straight line.
  float ringsPerPixel=fwidth(vAirwayWall.w);
  float ringCue=vAirwayWall.z*(1.0-smoothstep(0.1,0.34,ringsPerPixel));
  float count=vAirwayWall.w+(tissueNoise(p*0.11+19.0)-0.5)*0.6;
  float crest=0.5-0.5*cos(6.2831853*count);
  float band=smoothstep(0.02,0.5,crest)*(0.62+0.38*tissueNoise(p*0.21+53.0));
  float behind=around.x+(tissueNoise(p*0.3+41.0)-0.5)*0.12;
  float membrane=smoothstep(0.68,0.88,behind);
  float cartilage=band*(1.0-membrane)*ringCue;
  float groove=(1.0-band)*(1.0-membrane)*ringCue;
  // Membranous wall: smooth, with fine pale lines running the length of the airway.
  float angle=atan(around.y,around.x);
  float ridgePhase=angle*32.0+2.4*tissueNoise(p*0.22+7.0);
  float ridgeCue=membrane*vAirwayWall.z*(1.0-smoothstep(0.25,0.8,fwidth(ridgePhase)));
  float ridge=pow(0.5+0.5*cos(ridgePhase),3.0)*smoothstep(0.25,0.8,tissueNoise(p*0.45+83.0))*ridgeCue;
  // Submucosal vessels: two families of thin lines that wander but never close on themselves,
  // each showing only in patches, so they read as short runs that meet and part.
  vec3 q=p+5.0*(vec3(tissueNoise(p*0.16+3.1),tissueNoise(p*0.16+11.7),tissueNoise(p*0.16+23.3))-0.5);
  float width=max(0.03,mmPerPixel*0.3);
  float first=abs(fract(dot(q,vec3(0.29,0.11,0.05)))-0.5);
  float second=abs(fract(dot(q,vec3(0.07,-0.17,0.21))+0.37)-0.5);
  float vessel=max(
    (1.0-smoothstep(width*0.3,width,first))*smoothstep(0.5,0.7,tissueNoise(p*0.13+31.0)),
    (1.0-smoothstep(width*0.3,width,second))*smoothstep(0.52,0.72,tissueNoise(p*0.13+67.0))*0.8);
  vessel*=cue*(1.0-smoothstep(0.07,0.2,mmPerPixel))*(1.0-0.6*cartilage);
  return vec4(cartilage,cartilage+0.4*ridge,groove,vessel);
}
#endif
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
#ifdef MUCOSA_ANATOMY
  vec4 wall=airwayWallAnatomy(vWorldPosition,max(length(dx),length(dy)));
  // The rings stand a fraction of a millimetre proud: the same bump field, a taller step.
  // Held to a gentle slope, so a ring seen edge-on far down the airway cannot turn to a hard line.
  vec3 relief=8.0*sign(determinant)*(dFdx(wall.x)*rx+dFdy(wall.x)*ry);
  gradient+=relief*min(1.0,22.0*abs(determinant)/max(length(relief),0.0000001));
#endif
  if(abs(determinant)>0.0000001) normal=normalize(abs(determinant)*normal-0.012*gradient);
  // Continuous tissue coordinates; no voxel-shaped highlights or repeating bands.
  vec3 base=mix(vec3(0.51,0.205,0.19),vec3(0.76,0.395,0.36),broad);
  base*=0.96+fine*0.08;
#ifdef MUCOSA_ANATOMY
  base+=(vec3(0.93,0.78,0.7)-base)*0.17*wall.y;
  base*=mix(vec3(1.0),vec3(0.96,0.9,0.9),wall.z);
  base*=mix(vec3(1.0),vec3(0.9,0.56,0.56),0.36*wall.w);
#endif
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
