import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js";

const shader = {
    vertex: `void main() {
	gl_Position = vec4( position, 1.0 );
    }`,
    fragment: ` uniform vec2 u_resolution;
	uniform vec2 u_mouse;
	uniform float u_time;
	uniform sampler2D u_noise;

	#define PI 3.141592653589793
	#define TAU 6.

	const float multiplier = 25.5;

	const float zoomSpeed = 10.;
	const int layers = 10;

	const int octaves = 5;

	vec2 hash2(vec2 p)
	{
    vec2 o = texture2D( u_noise, (p+0.5)/256.0, -100.0 ).xy;
    return o;
	}

	mat2 rotate2d(float _angle){
	return mat2(cos(_angle),sin(_angle),
	-sin(_angle),cos(_angle));
	}

	vec3 hsb2rgb( in vec3 c ){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
	6.0)-3.0)-1.0,
	0.0,
	1.0 );
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix( vec3(1.0), rgb, c.y);
	}

	float hash(vec2 p)
	{
    float o = texture2D( u_noise, (p+0.5)/256.0, -100.0 ).x;
    return o;
	}
	float noise(vec2 uv) {
    vec2 id = floor(uv);
    vec2 subuv = fract(uv);
    vec2 u = subuv * subuv * (3. - 2. * subuv);
    float a = hash(id);
    float b = hash(id + vec2(1., 0.));
    float c = hash(id + vec2(0., 1.));
    float d = hash(id + vec2(1., 1.));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
	}
	float fbm(in vec2 uv) {
    float s = .0;
    float m = .0;
    float a = .5;
    for(int i = 0; i < octaves; i++) {
	s += a * noise(uv);
	m += a;
	a *= .5;
	uv *= 2.;
    }
    return s / m;
	}

	vec3 domain(vec2 z){
    return vec3(hsb2rgb(vec3(atan(z.y,z.x)/TAU,1.,1.)));
	}
	vec3 colour(vec2 z) {
	return domain(z);
	}

	// The render function is where we render the pattern to be added to the layer
	vec3 render(vec2 uv, float scale, vec3 colour) {
    vec2 id = floor(uv);
    vec2 subuv = fract(uv);
    vec2 rand = hash2(id);
    float bokeh = abs(scale) * 1.;

    float particle = 0.;

    if(length(rand) > 1.3) {
	vec2 pos = subuv-.5;
	float field = length(pos);
	particle = smoothstep(.3, 0., field);
	particle += smoothstep(.4, 0.34 * bokeh, field);
    }
    return vec3(particle*2.);
	}

	vec3 renderLayer(int layer, int layers, vec2 uv, inout float opacity, vec3 colour, float n) {
    vec2 _uv = uv;
    // Scale
    // Generating a scale value between zero and 1 based on a mod of u_time
    // A frequency of 10 dixided by the layer index (10 / layers * layer)
    float scale = mod((u_time + zoomSpeed / float(layers) * float(layer)) / zoomSpeed, -1.);
    uv *= 20.; // The initial scale. Increasing this makes the cells smaller and the "speed" apepar faster
    uv *= scale*scale; // then modifying the overall scale by the generated amount
    // uv *= 1. + ( ( n*.5 ) * ( length(_uv) ) );
    // uv += .5*float(layer);
    uv = rotate2d(u_time / 10.) * uv; // rotarting
    uv += vec2(25. + sin(u_time*.1)) * float(layer); // ofsetting the UV by an arbitrary amount to make the layer appear different

    // render
    vec3 pass = render(uv * multiplier, scale, colour) * .2; // render the pass

	// this is the opacity of the layer fading in from the "bottom"
    opacity = 1. + scale;
    float _opacity = opacity;

    // pass += n * .5 * mix(vec3(0., .5, 1.5), vec3(1., .5, 0.), opacity);

    // This is the opacity of the layer fading out at the top (we want this minimal, hence the smoothstep)
    float endOpacity = smoothstep(0., 0.4, scale * -1.);
    opacity += endOpacity;

    return pass * _opacity * endOpacity;
	}
	uniform float accum; // Add this line to declare accum as a uniform
    uniform float field; // Add this line to declare field as a uniform
	void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy);

        if(u_resolution.y < u_resolution.x) {
            uv /= u_resolution.y;
        } else {
            uv /= u_resolution.x;
        }

        float n = fbm((uv + vec2(sin(u_time*.1), u_time*.1)) * 2. - 2.);
        vec3 color = vec3(accum*accum*.45, 0., 0.) * vec3(field, 0., 0.);
        color = n * mix(vec3(0., .5, 1.5), clamp(vec3(1., .5, .25)*2., 0., 1.), n);

        // Calculate initial brightness
        float brightness = dot(color, vec3(0.299, 0.587, 0.114));

        // Time-based factor for adjusting brightness, stronger effect on brighter colors
        float timeFactor = mix(0.0, 1.0, brightness) * sin(u_time * 0.5);

        // Adjust color towards white based on timeFactor
        vec3 adjustedColor = mix(color, vec3(1.0), timeFactor);

        float opacity = 1.;
        float opacity_sum = 1.;

        for(int i = 1; i <= layers; i++) {
            adjustedColor += renderLayer(i, layers, uv, opacity, adjustedColor, n);
            opacity_sum += opacity;
        }

        adjustedColor /= opacity_sum;

        gl_FragColor = vec4(clamp(adjustedColor * 20., 0., 1.), 1.0);
    }`
};


// const shader = {
//     vertex: `void main() {
// 	gl_Position = vec4( position, 1.0 );
//     }`,
//     fragment: ` uniform vec2 u_resolution;
// 	uniform vec2 u_mouse;
// 	uniform float u_time;
// 	uniform sampler2D u_noise;
//
// 	#define PI 3.141592653589793
// 	#define TAU 6.
//
// 	const float multiplier = 25.5;
//
// 	const float zoomSpeed = 10.;
// 	const int layers = 10;
//
// 	const int octaves = 5;
//
// 	vec2 hash2(vec2 p)
// 	{
//     vec2 o = texture2D( u_noise, (p+0.5)/256.0, -100.0 ).xy;
//     return o;
// 	}
//
// 	mat2 rotate2d(float _angle){
// 	return mat2(cos(_angle),sin(_angle),
// 	-sin(_angle),cos(_angle));
// 	}
//
// 	vec3 hsb2rgb( in vec3 c ){
//     vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
// 	6.0)-3.0)-1.0,
// 	0.0,
// 	1.0 );
//     rgb = rgb*rgb*(3.0-2.0*rgb);
//     return c.z * mix( vec3(1.0), rgb, c.y);
// 	}
//
// 	float hash(vec2 p)
// 	{
//     float o = texture2D( u_noise, (p+0.5)/256.0, -100.0 ).x;
//     return o;
// 	}
// 	float noise(vec2 uv) {
//     vec2 id = floor(uv);
//     vec2 subuv = fract(uv);
//     vec2 u = subuv * subuv * (3. - 2. * subuv);
//     float a = hash(id);
//     float b = hash(id + vec2(1., 0.));
//     float c = hash(id + vec2(0., 1.));
//     float d = hash(id + vec2(1., 1.));
//     return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
// 	}
// 	float fbm(in vec2 uv) {
//     float s = .0;
//     float m = .0;
//     float a = .5;
//     for(int i = 0; i < octaves; i++) {
// 	s += a * noise(uv);
// 	m += a;
// 	a *= .5;
// 	uv *= 2.;
//     }
//     return s / m;
// 	}
//
// 	vec3 domain(vec2 z){
//     return vec3(hsb2rgb(vec3(atan(z.y,z.x)/TAU,1.,1.)));
// 	}
// 	vec3 colour(vec2 z) {
// 	return domain(z);
// 	}
//
// 	// The render function is where we render the pattern to be added to the layer
// 	vec3 render(vec2 uv, float scale, vec3 colour) {
//     vec2 id = floor(uv);
//     vec2 subuv = fract(uv);
//     vec2 rand = hash2(id);
//     float bokeh = abs(scale) * 1.;
//
//     float particle = 0.;
//
//     if(length(rand) > 1.3) {
// 	vec2 pos = subuv-.5;
// 	float field = length(pos);
// 	particle = smoothstep(.3, 0., field);
// 	particle += smoothstep(.4, 0.34 * bokeh, field);
//     }
//     return vec3(particle*2.);
// 	}
//
// 	vec3 renderLayer(int layer, int layers, vec2 uv, inout float opacity, vec3 colour, float n) {
//     vec2 _uv = uv;
//     // Scale
//     // Generating a scale value between zero and 1 based on a mod of u_time
//     // A frequency of 10 dixided by the layer index (10 / layers * layer)
//     float scale = mod((u_time + zoomSpeed / float(layers) * float(layer)) / zoomSpeed, -1.);
//     uv *= 20.; // The initial scale. Increasing this makes the cells smaller and the "speed" apepar faster
//     uv *= scale*scale; // then modifying the overall scale by the generated amount
//     // uv *= 1. + ( ( n*.5 ) * ( length(_uv) ) );
//     // uv += .5*float(layer);
//     uv = rotate2d(u_time / 10.) * uv; // rotarting
//     uv += vec2(25. + sin(u_time*.1)) * float(layer); // ofsetting the UV by an arbitrary amount to make the layer appear different
//
//     // render
//     vec3 pass = render(uv * multiplier, scale, colour) * .2; // render the pass
//
// 	// this is the opacity of the layer fading in from the "bottom"
//     opacity = 1. + scale;
//     float _opacity = opacity;
//
//     // pass += n * .5 * mix(vec3(0., .5, 1.5), vec3(1., .5, 0.), opacity);
//
//     // This is the opacity of the layer fading out at the top (we want this minimal, hence the smoothstep)
//     float endOpacity = smoothstep(0., 0.4, scale * -1.);
//     opacity += endOpacity;
//
//     return pass * _opacity * endOpacity;
// 	}
//
// 	void main() {
// 	vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy);
//
// 	if(u_resolution.y < u_resolution.x) {
// 	uv /= u_resolution.y;
// 	} else {
// 	uv /= u_resolution.x;
// 	}
//
// 	// uv.y += cos(u_time * .1) * .5;
// 	// uv.x += sin(u_time * .1) * .5;
//
// 	// float n = fbm(uv * 3. - 2.);
// 	float n = fbm((uv + vec2(sin(u_time*.1), u_time*.1)) * 2. - 2.);
//
// 	vec3 colour = vec3(0.);
// 	// colour = n * mix(vec3(0., .5, 1.5), vec3(1., .5, -.1), n);
// 	colour = n * mix(vec3(0., .5, 1.5), clamp(vec3(1., .5, .25)*2., 0., 1.), n);
// 	// colour -= n*n*n*n*.4;
// 	// colour += smoothstep(.8, 2.5, sin(n*n*n*8.))*.4;
//
// 	float opacity = 1.;
// 	float opacity_sum = 1.;
//
// 	for(int i = 1; i <= layers; i++) {
// 	colour += renderLayer(i, layers, uv, opacity, colour, n);
// 	opacity_sum += opacity;
// 	}
//
// 	colour /= opacity_sum;
//
// 	gl_FragColor = vec4(clamp(colour * 20., 0., 1.),1.0);
// 	}`
// };
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

let loader=new THREE.TextureLoader();
let texture;
loader.setCrossOrigin("anonymous");
loader.load(
    './noise2.png',
    function do_something_with_texture(tex) {
        texture = tex;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearFilter;
        init();
    }
);


function init() {
    container = document.getElementById( 'animation-container' );
    camera = new THREE.Camera();
    camera.position.z = 1;
    scene = new THREE.Scene();
    var geometry = new THREE.PlaneBufferGeometry( 2, 2 );
    uniforms = {
        u_time: { type: "f", value: 1.0 },
        u_resolution: { type: "v2", value: new THREE.Vector2() },
        u_noise: { type: "t", value: texture },
        u_mouse: { type: "v2", value: new THREE.Vector2() },
        accum: { type: "f", value: 1.0 },
        field: { type: "f", value: 0.5 }
    };

    var material = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: shader.vertex,
        fragmentShader: shader.fragment
    } );
    material.extensions.derivatives = true;

    var mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );

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