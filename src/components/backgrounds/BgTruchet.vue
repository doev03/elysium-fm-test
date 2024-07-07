<script setup>
import { onMounted } from 'vue'
import { FragmentShader, Uniform, DollyCamera } from 'wtc-gl'
import { Vec3 } from 'wtc-math'

const fragment = `#version 300 es
  precision highp float;
  
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform sampler2D s_noise;
  uniform vec3 u_cp;
  
  in vec2 v_uv;
  out vec4 c;
  
  /* Shading constants */
  /* --------------------- */
  const vec3 LP = vec3(-0.6, 0.7, -0.3);  // light position
  const vec3 LC = vec3(0.85,0.10,0.07);    // light colour
  const vec3 HC1 = vec3(.5, .4, .3);      // hemisphere light colour 1
  const vec3 HC2 = vec3(0.1,.1,.6)*.5;    // hemisphere light colour 2
  const vec3 HLD = vec3(0,1,0)*.5+.5;     // hemisphere light direction
  const vec3 BC = vec3(0.25,0.25,0.25);   // back light colour
  const vec3 FC = vec3(1.30,1.20,1.00);   // fresnel colour
  const float AS = .5;                     // ambient light strength
  const float DS = 1.;                     // diffuse light strength
  const float BS = .3;                     // back light strength
  const float FS = .3;                     // fresnel strength
  /* Raymarching constants */
  /* --------------------- */
  const float MAX_TRACE_DISTANCE = 20.;             // max trace distance
  const float INTERSECTION_PRECISION = 0.001;       // precision of the intersection
  const int NUM_OF_TRACE_STEPS = 32;               // max number of trace steps
  const float STEP_MULTIPLIER = .9;                 // the step mutliplier - ie, how much further to progress on each step
  
  /* Structures */
  /* ---------- */
  struct Camera {
    vec3 ro;
    vec3 rd;
    vec3 forward;
    vec3 right;
    vec3 up;
    float FOV;
  };
  struct Surface {
    float len;
    vec3 position;
    vec3 colour;
    float id;
    float steps;
    float AO;
  };
  struct Model {
    float dist;
    vec3 colour;
    float id;
  };
  
  /* Utilities */
  /* ---------- */
  vec2 toScreenspace(in vec2 p) {
    vec2 uv = (p - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    return uv;
  }
  mat2 R(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }
  Camera getCamera(in vec2 uv, in vec3 pos, in vec3 target) {
    vec3 f = normalize(target - pos);
    vec3 r = normalize(vec3(f.z, 0., -f.x));
    vec3 u = normalize(cross(f, r));
    
    float FOV = .6;
    
    return Camera(
      pos,
      normalize(f + FOV * uv.x * r + FOV * uv.y * u),
      f,
      r,
      u,
      FOV
    );
  }
  float hash13(vec3 p3) {
    p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  
  //--------------------------------
  // Modelling
  //--------------------------------
  float sdBoxFrame( vec3 p, vec3 b, float e ) {
       p = abs(p  )-b;
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
  }
  float sdTorus( vec3 p, vec2 t ) {
    vec2 q = vec2(length(p.xz)-t.x,p.y);
    return length(q)-t.y;
  }
  
  #define demo
  #define RX mat3(1, 0, 0, 0, 0, -1, 0, 1,  0 )
  #define RY mat3(0, 0, 1, 0, 1, 0, -1, 0, 0)
  #define RZ mat3(0, -1, 0, 1,  0, 0, 0,  0, 1)
  
  Model model(vec3 p) {
    
    #ifdef demo
    vec3 i = floor(p);
    p = fract(p)-.5;
    #endif
    
    p *= 2.;
    
    
    float d = sdBoxFrame(p, vec3(1), .05);
    #ifdef demo
    float rn = floor(hash13(i*2048.)*6.);
    d=2e5;
    if(rn == 0.) {
      p*=RX;
    } else if(rn == 1.) {
      p*=RY;
    } else if(rn == 2.) {
      p*=RZ;
    } else if(rn == 3.) {
      p*=-RZ;
    } else if(rn == 4.) {
      p*=-RY;
    } else if(rn == 5.) {
      p*=-RX;
    }
    #endif
    
    d = min(d, sdTorus(p+vec3(1.,0,1.), vec2(1,.05)));
    d = min(d, sdTorus(p.zxy+vec3(-1.,0,1.), vec2(1,.05)));
    d = min(d, sdTorus(p.yzx+vec3(-1.,0,-1.), vec2(1,.05)));
    
    d /=2.;
    
    vec3 colour = vec3(.8,.3,.6);
    return Model(d, colour, 1.);
  }
  Model map( vec3 p ){
    return model(p);
  }
  
  /* Modelling utilities */
  /* ---------- */
  // Calculates the normal by taking a very small distance,
  // remapping the function, and getting normal for that
  vec3 calcNormal( in vec3 pos ){
    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
      map(pos+eps.xyy).dist - map(pos-eps.xyy).dist,
      map(pos+eps.yxy).dist - map(pos-eps.yxy).dist,
      map(pos+eps.yyx).dist - map(pos-eps.yyx).dist );
    return normalize(nor);
  }
  
  //--------------------------------
  // Raymarcher
  //--------------------------------
  Surface march( in Camera cam ){
    float h = 1e4; // local distance
    float d = 0.; // ray depth
    float id = -1.; // surace id
    float s = 0.; // number of steps
    float ao = 0.; // march space AO. Simple weighted accumulator
    vec3 p; // ray position
    vec3 c; // surface colour

    for( int i=0; i< NUM_OF_TRACE_STEPS ; i++ ) {
      if( abs(h) < INTERSECTION_PRECISION || d > MAX_TRACE_DISTANCE ) break;
      p = cam.ro+cam.rd*d;
      Model m = map( p );
      h = m.dist;
      d += h * STEP_MULTIPLIER;
      id = m.id;
      s += 1.;
      ao += max(h, 0.);
      c = m.colour;
    }

    if( d >= MAX_TRACE_DISTANCE ) id = -1.0;

    return Surface( d, p, c, id, s, ao );
  }
  
  //--------------------------------
  // Shading
  //--------------------------------
  /*
   * Soft shadows curtesy of Inigo Quilez
   * https://iquilezles.org/articles/rmshadows
  */
  float softshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax ) {
    float res = 1.0;
    float t = mint;
    for( int i=0; i<16; i++ ) {
      float h = map( ro + rd*t ).dist;
      res = min( res, 8.0*h/t );
      t += clamp( h, 0.02, 0.10 );
      if( h<0.001 || t>tmax ) break;
    }
    return clamp( res, 0.0, 1.0 );
  }
  float AO( in vec3 pos, in vec3 nor ) {
    float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
      float hr = 0.01 + 0.12*float(i)/4.0;
      vec3 aopos =  nor * hr + pos;
      float dd = map( aopos ).dist;
      occ += -(dd-hr)*sca;
      sca *= 0.95;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );    
  }
  vec3 shade(vec3 col, vec3 pos, vec3 nor, vec3 ref, Camera cam) {
    
    vec3 plp = LP - pos; // point light
    
    float o = AO( pos, nor );                 // Ambient occlusion
    vec3  l = normalize( plp );                    // light direction
    
    float d = clamp( dot( nor, l ), 0.0, 1.0 )*DS;   // diffuse component
    float b = clamp( dot( nor, normalize(vec3(-l.x,0,-l.z))), 0.0, 1.0 )*clamp( 1.0-pos.y,0.0,1.0)*BS; // back light component
    float f = pow( clamp(1.0+dot(nor,cam.rd),0.0,1.0), 2.0 )*FS; // fresnel component
    // float spe = pow(clamp( dot( ref, l ), 0.0, 1.0 ),16.0); // specular component

    vec3 c = normalize(cam.ro);
    c += d*LC;                           // diffuse light integration
    c += mix(HC1,HC2,dot(nor, HLD))*AS;        // hemisphere light integration (ambient)
    c += b*BC*o;       // back light component
    c += f*FC*o;       // fresnel component
    
    return col*c;
  }
  vec3 render(Surface surface, Camera cam, vec2 uv) {
    vec3 colour = vec3(.04,.045,.05);
    colour = vec3(.35, .5, .75);
    vec3 colourB = vec3(.9, .85, .8);
    
    vec2 pp = uv;
    
    colour = mix(colourB, colour, pow(length(pp), 2.)/1.5);

    if (surface.id > -1.){
      vec3 surfaceNormal = calcNormal( surface.position );
      vec3 ref = reflect(cam.rd, surfaceNormal);
      colour = surfaceNormal;
      vec3 pos = surface.position;
      
      vec3 col = surface.colour;
      
      colour = shade(col, pos, surfaceNormal, ref, cam);
    }

    return colour;
  }
  
  
  void main() {
    vec2 uv = toScreenspace(gl_FragCoord.xy);
    
    Camera cam = getCamera(uv, u_cp * .01, vec3(0));
    
    Surface surface = march(cam);
    
    c = vec4(render(surface, cam, uv), 1.);
  }`

const vertex = `#version 300 es
in vec3 position;
in vec2 uv;
out vec2 v_uv;
void main() {
gl_Position = vec4(position, 1.0);
v_uv = uv;
}`

function init() {
  const camera = new DollyCamera(
    { enabled: true, autoRotate: true, rotateSpeed: 0.1, panSpeed: 0.1, enableZoom: false },
    { far: 1000 }
  )

  const cp = new Uniform({
    name: 'cp',
    value: [50, 50, 100],
    kind: 'vec3'
  })

  const container = document.getElementById('bg-truchet')

  new FragmentShader({
    fragment,
    vertex,
    container,
    uniforms: {
      u_cp: cp
    },
    onBeforeRender: (t) => {
      camera.update()

      cp.value = camera.position.multiplyNew(new Vec3(-1, 1, 5)).add(new Vec3(10, 10, 10)).array
    }
  })

  camera.setPosition(100, 100, 200)
}

onMounted(() => {
  init()
})
</script>

<template>
  <div class="radio-background" id="bg-truchet" />
</template>
