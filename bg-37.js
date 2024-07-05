import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js";

const shader = {
    vertex: `void main() {
	gl_Position = vec4( position, 1.0 );
    }`,
    fragment: `uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;
  uniform sampler2D u_noise;
  uniform sampler2D u_env;
  
    const int octaves = 2;
    const float seed = 43758.5453123;
    const float seed2 = 73156.8473192;
    // Epsilon value
    const float eps = 0.005;
  
    const vec3 ambientLight = 0.99 * vec3(1.0, 1.0, 1.0);
    const vec3 light1Pos = vec3(10., 5.0, -25.0);
    const vec3 light1Intensity = vec3(0.35);
    const vec3 light2Pos = vec3(-20., -25.0, 85.0);
    const vec3 light2Intensity = vec3(0.2);
  
    // movement variables
    vec3 movement = vec3(.0);

    // Gloable variables for the raymarching algorithm.
    const int maxIterations = 256;
    const int maxIterationsShad = 16;
    const float stepScale = .7;
    const float stopThreshold = 0.001;
  
  

  vec3 hash33(vec3 p){ 
    return texture2D(u_noise, p.xy * p.z * 256.).rgb;
  }

  float pn( in vec3 p ) {
    vec3 i = floor(p); p -= i; p *= p*(3. - 2.*p);
    p.xy = texture2D(u_noise, (p.xy + i.xy + vec2(37, 17)*i.z + .5)/256., -100.).yx;
    return mix(p.x, p.y, p.z);
  }
  
  // Thanks to Shane for this one.
  // Basic low quality noise consisting of three layers of rotated, mutated 
  // trigonometric functions. Needs work, but sufficient for this example.
  float trigNoise3D(in vec3 p){


      float res = 0., sum = 0.;

      // IQ's cheap, texture-lookup noise function. Very efficient, but still 
      // a little too processor intensive for multiple layer usage in a largish 
      // "for loop" setup. Therefore, just one layer is being used here.
      float n = pn(p*8. + u_time*.5);


      // Two sinusoidal layers. I'm pretty sure you could get rid of one of 
      // the swizzles (I have a feeling the GPU doesn't like them as much), 
      // which I'll try to do later.

      vec3 t = sin(p.yzx*3.14159265 + cos(p.zxy*3.14159265+1.57/2.))*0.5 + 0.5;
      p = p*1.5 + (t - 1.5); //  + u_time*0.1
      res += (dot(t, vec3(0.333)));

      t = sin(p.yzx*3.14159265 + cos(p.zxy*3.14159265+1.57/2.))*0.5 + 0.5;
      res += (dot(t, vec3(0.333)))*0.7071;    

    return ((res/1.7071))*0.85 + n*0.15;
  }
  
  
  mat4 rotationMatrix(vec3 axis, float angle)
  {
      axis = normalize(axis);
      float s = sin(angle);
      float c = cos(angle);
      float oc = 1.0 - c;

      return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                  oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                  oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                  0.0,                                0.0,                                0.0,                                1.0);
  }
  
  
  float length2( vec2 p )
  {
    return sqrt( p.x*p.x + p.y*p.y );
  }

  float length6( vec2 p )
  {
    p = p*p*p; p = p*p;
    return pow( p.x + p.y, 1.0/6.0 );
  }

  float length8( vec2 p )
  {
    p = p*p; p = p*p; p = p*p;
    return pow( p.x + p.y, 1.0/8.0 );
  }
  
  // Distance function primitives
  // Reference: http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
  float sdBox( vec3 p, vec3 b )
  {
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
  }
  float udBox( vec3 p, vec3 b )
  {
    return length(max(abs(p)-b,0.0));
  }
  float udRoundBox( vec3 p, vec3 b, float r )
  {
    return length(max(abs(p)-b,0.0))-r;
  }
  float sdSphere( vec3 p, float s )
  {
    return length(p)-s;
  }
  float sdCylinder( vec3 p, vec3 c )
  {
    return length(p.xz-c.xy)-c.z;
  }
  float sdCappedCylinder( vec3 p, vec2 h )
  {
    vec2 d = abs(vec2(length(p.xz),p.y)) - h;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
  }
  float sdTorus82( vec3 p, vec2 t )
  {
    vec2 q = vec2(length2(p.xz)-t.x,p.y);
    return length8(q)-t.y;
  }
  float sdPlane( vec3 p)
  {
    return p.y;
  }
  
  // smooth min
  // reference: http://iquilezles.org/www/articles/smin/smin.htm
  float smin(float a, float b, float k) {
      float res = exp(-k*a) + exp(-k*b);
      return -log(res)/k;
  }
  
  vec3 random3( vec3 p ) {
      return fract(sin(vec3(dot(p,vec3(127.1,311.7,319.8)),dot(p,vec3(269.5,183.3, 415.2)),dot(p,vec3(362.9,201.5,134.7))))*43758.5453);
  }
  vec2 random2( vec2 p ) {
      return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
  }
  float tri( float x ){ 
  return abs( fract(x) - .5 );
}

vec3 tri3( vec3 p ){
 
  return vec3( 
      tri( p.z + tri( p.y * 1. ) ), 
      tri( p.z + tri( p.x * 1. ) ), 
      tri( p.y + tri( p.x * 1. ) )
  );

}
                                 

float triNoise3D( vec3 p, float spd , float time){
  
  float z  = 1.4;
	float rz =  0.;
  vec3  bp =   p;

	for( float i = 0.; i <= 3.; i++ ){
   
    vec3 dg = tri3( bp * 2. );
    p += ( dg + time * .1 * spd );

    bp *= 1.8;
		z  *= 1.5;
		p  *= 1.2; 
      
    float t = tri( p.z + tri( p.x + tri( p.y )));
    rz += t / z;
    bp += 0.14;

	}

	return rz;

}
  
  struct Obj {
    float distance;
    float innerDistance;
    vec4 colour;
  };
  
  mat4 rotmat;
  
  // The world!
  Obj world_sdf(in vec3 p) {
    float world = 10.;
    
    // p += 1.;
    // p = mod(p, 2.) -1.;
    
    p = (vec4(p, 1.) * rotmat).xyz;
    
    world = length(p) - .5;
    float innerDist = 0.;
    vec4 colour = vec4(1.);
    
    if(world < 0.) {
      
      float r = length(p);
      vec3 spherical = vec3(r, atan(p.y, p.x), acos(p.z / r));
      
      innerDist = .9 - length(mod(spherical * 3. + .5, 1.) - .5);
      
      // float multi = smoothstep(0., 1.5, length(p*6.)); // a fade at the centre of the ball
      // innerDist *= multi*.8;
      innerDist *= smoothstep(.6, .45, length(p)); // a little fade near the edge of the ball
      
      colour.r = sin(length(spherical * 3.) * 3.);
      colour.g = sin(length(spherical * 3.05) * 3.);
      colour.b = sin(length(spherical * 3.1) * 3.);
      colour *= .4;
      colour += .2;
    }
    
    return Obj(world, innerDist, colour);
  }
  float world_normals(in vec3 p) {
    float world = 10.;
    
    p = (vec4(p, 1.) * rotmat).xyz;
    
    world = length(p) - .5;
    
    return world;
  }
  
  // Fuck yeah, normals!
  vec3 calculate_normal(in vec3 p)
  {
    const vec3 small_step = vec3(0.0001, 0.0, 0.0);
    
    float gradient_x = world_normals(vec3(p.x + eps, p.y, p.z)) - world_normals(vec3(p.x - eps, p.y, p.z));
    float gradient_y = world_normals(vec3(p.x, p.y + eps, p.z)) - world_normals(vec3(p.x, p.y - eps, p.z));
    float gradient_z = world_normals(vec3(p.x, p.y, p.z  + eps)) - world_normals(vec3(p.x, p.y, p.z - eps));
    
    vec3 normal = vec3(gradient_x, gradient_y, gradient_z);

    return normalize(normal);
  }

  // Raymarching.
  float rayMarching( vec3 origin, vec3 dir, float start, float end, inout vec3 field, inout float accum ) {
    
    float sceneDist = 1e4;
    float rayDepth = start;
    float surfaceDepth = 0.;
    Obj rtn;
    Obj model;
    for ( int i = 0; i < maxIterations; i++ ) {
      vec3 ray = origin + dir * rayDepth;
      model = world_sdf( ray );
      sceneDist = model.distance; // Distance from the point along the ray to the nearest surface point in the scene.

      if (( field.y >= 1. )) {
        break;
      }
      if ((rayDepth >= end)) {
        if(surfaceDepth == 0.) {
          surfaceDepth = end;
        }
        break;
      }
      
      if(sceneDist <= 0.001) {
        if(surfaceDepth == 0.) {
          surfaceDepth = rayDepth + sceneDist;
        }
        // field.x += abs(model.innerDistance) * .04 * abs(ray.z*5.);
        // field.y += abs(model.innerDistance) * .05 * length(ray*2.);
        field += model.innerDistance * .038 * model.colour.xyz;
        rayDepth += (1. - model.innerDistance) * .01;
      } else {
        rayDepth += sceneDist * stepScale;
      }
      accum += .01;
    }
  
    if ( sceneDist >= stopThreshold ) rayDepth = end;
    else rayDepth += sceneDist;
      
    // We've used up our maximum iterations. Return the maximum distance.
    return surfaceDepth;
  }
  
  /**
   * Lighting
   * This stuff is way way better than the model I was using.
   * Courtesy Shane Warne
   * Reference: http://raymarching.com/
   * -------------------------------------
   * */
  
  // Lighting.
  vec3 lighting( vec3 sp, vec3 camPos, int reflectionPass, float dist, vec3 field, vec3 rd) {
    
    // Start with black.
    vec3 sceneColor = vec3(0.0);

    vec3 objColor = vec3(.95, .9, 1.) * (field+.5);
    // objColor = mix(objColor, vec3(1.1, .8, .5), (1. - sin(field*2.)));

    // Obtain the surface normal at the scene position "sp."
    vec3 surfNormal = calculate_normal(sp);
    
    // objColor = mix(objColor, vec3(1.1, .8, .5), (1. - sin(field * surfNormal.z)) * .5);

    // Lighting.

    // lp - Light position. Keeping it in the vacinity of the camera, but away from the objects in the scene.
    // vec3 lp = vec3(sin(u_time+.8)*-1., 1., cos(u_time+.8)*-1.0) + movement;
    vec3 lp = vec3(-1.5, 1.5, -1.0) + movement;
    // ld - Light direction.
    vec3 ld = lp-sp;
    // lcolor - Light color.
    vec3 lcolor = vec3(1.,0.97,0.92) * .8;
    
     // Light falloff (attenuation).
    float len = length( ld ); // Distance from the light to the surface point.
    ld /= len; // Normalizing the light-to-surface, aka light-direction, vector.
    // float lightAtten = min( 1.0 / ( 0.15*len*len ), 1.0 ); // Removed light attenuation for this because I want the fade to white
    
    float sceneLen = length(camPos - sp); // Distance of the camera to the surface point
    float sceneAtten = min( 1.0 / ( 0.015*sceneLen*sceneLen ), 1.0 ); // Keeps things between 0 and 1.   

    // Obtain the reflected vector at the scene position "sp."
    vec3 ref = reflect(-ld, surfNormal);
    
    float ao = 1.0; // Ambient occlusion.

    float ambient = .5; //The object's ambient property.
    float specularPower = 200.; // The power of the specularity. Higher numbers can give the object a harder, shinier look.
    float diffuse = max( 0.0, dot(surfNormal, ld) ); //The object's diffuse value.
    float specular = max( 0.0, dot( ref, normalize(camPos-sp)) ); //The object's specular value.
    specular = pow(specular, specularPower); // Ramping up the specular value to the specular power for a bit of shininess.
    	
    // Bringing all the lighting components togethr to color the screen pixel.
    sceneColor += (objColor*(diffuse*0.8+ambient)+specular*0.5)*lcolor*1.3;
    sceneColor = mix(sceneColor, vec3(1.), 1.-sceneAtten*sceneAtten); // fog
    
    sceneColor += texture2D(u_env, surfNormal.xz * 2.).rgb * .3 * clamp(dist, 0., 1.);
    
    return sceneColor;

  }

    void main() {
      
      rotmat = rotationMatrix(vec3(0., 1., 0.), u_time);
      
      // Setting up our screen coordinates.
      vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0); //
      vec2 uv = (2.0*gl_FragCoord.xy/u_resolution.xy - 1.0)*aspect;
      
      // This just gives us a touch of fisheye
      // uv *= 1. + dot(uv, uv) * 0.4;
      
      // movement
      movement = vec3(0.);
      
      // The sin in here is to make it look like a walk.
      vec3 lookAt = vec3(-0., -.0, 0.);  // This is the point you look towards, or at, if you prefer.
      vec3 camera_position = vec3(sin(u_time)*-1., 0., cos(u_time)*-2.0); // This is the point you look from, or camera you look at the scene through. Whichever way you wish to look at it.
      camera_position = vec3(0., 1., -2.);
      float zoomSet = sin(u_time*.5) * .5 + .6;
      camera_position *= zoomSet;
      
      lookAt += movement;
      // lookAt.z += sin(u_time / 10.) * .5;
      // lookAt.x += cos(u_time / 10.) * .5;
      camera_position += movement;
      
      vec3 forward = normalize(lookAt-camera_position); // Forward vector.
      vec3 right = normalize(vec3(forward.z, 0., -forward.x )); // Right vector... or is it left? Either way, so long as the correct-facing up-vector is produced.
      vec3 up = normalize(cross(forward,right)); // Cross product the two vectors above to get the up vector.

      // FOV - Field of view.
      float FOV = 0.2 + (1. - zoomSet * .9);

      // ro - Ray origin.
      vec3 ro = camera_position; 
      // rd - Ray direction.
      vec3 rd = normalize(forward + FOV*uv.x*right + FOV*uv.y*up);
      
      // Ray marching.
      const float clipNear = 0.0;
      const float clipFar = 16.0;
      vec3 field = vec3(0.);
      float accum;
      float dist = rayMarching(ro, rd, clipNear, clipFar, field, accum );
      gl_FragColor = vec4(accum*accum*.45) * vec4(field, 0.);


    }`
};
/*
Most of the stuff in here is just bootstrapping. Essentially it's just
setting ThreeJS up so that it renders a flat surface upon which to draw
the shader. The only thing to see here really is the uniforms sent to
the shader. Apart from that all of the magic happens in the HTML view
under the fragment shader.
*/


    let container;
    let camera, scene, renderer;
    let uniforms;
    let material;

    let loader=new THREE.TextureLoader();
    let texture, environment;
    loader.setCrossOrigin("anonymous");
    loader.load('./noise.png', (tex) => {
        environment = tex;
        environment.wrapS = THREE.RepeatWrapping;
        environment.wrapT = THREE.RepeatWrapping;
        init();
    });

    function init() {
        container = document.getElementById('animation-container');

        camera = new THREE.Camera();
        camera.position.z = 1;

        scene = new THREE.Scene();

        var geometry = new THREE.PlaneBufferGeometry( 2, 2 );

        uniforms = {
            u_time: { type: "f", value: 1.0 },
            u_resolution: { type: "v2", value: new THREE.Vector2() },
            u_noise: { type: "t", value: texture },
            u_env: { type: "t", value: environment },
            u_mouse: { type: "v2", value: new THREE.Vector2() }
        };

         material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: shader.vertex,
            fragmentShader: shader.fragment
        } );
        material.extensions.derivatives = true;


        var mesh = new THREE.Mesh( geometry, material );
        scene.add( mesh );
        renderer = new THREE.WebGLRenderer();
        container.appendChild( renderer.domElement );
        onWindowResize();
        window.addEventListener( 'resize', onWindowResize, false );
    }

    function onWindowResize( event ) {
        renderer.setSize( container.offsetWidth, container.offsetHeight );
        uniforms.u_resolution.value.x = renderer.domElement.width;
        uniforms.u_resolution.value.y = renderer.domElement.height;
    }

    export function animate(delta) {
        requestAnimationFrame( animate );
        render(delta);
    }

    function render(delta) {
        uniforms.u_time.value = -10000 + delta * 0.0005;
        renderer.render( scene, camera );
    }

