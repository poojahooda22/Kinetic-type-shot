# Kinetic Typography — Implementation Guide

> Detailed reference extracted from [codrops-kinetic-typo](https://github.com/marioecg/codrops-kinetic-typo) by marioecg.

---

## Step 1: Three.js Renderer (GL Manager)

The GL manager controls the renderer, camera, scene, and animation loop.

```javascript
import * as THREE from 'three';

export default new class {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    this.camera.position.z = 1;

    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    this.init();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    for (let i = 0; i < this.scene.children.length; i++) {
      const obj = this.scene.children[i];
      obj.updateTime(this.clock.getElapsedTime());
    }

    this.render();
  }

  addEvents() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  init() {
    this.addToDom();
    this.animate();
    this.addEvents();
  }

  addToDom() {
    const canvas = this.renderer.domElement;
    const container = document.querySelector('#webgl');
    container.appendChild(canvas);
  }

  resize() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
```

**Key points:**
- `alpha: true` — transparent background so HTML shows through
- Camera at `z = 1` — very close; geometries are small-scale
- `animate()` calls `updateTime()` on every scene child (each Type instance)

---

## Step 2: Type Class (The Core Effect)

This is the heart of the technique. See `Type.js` for the full reference implementation.

The class:
1. Loads a BMFont (.fnt descriptor + .png atlas)
2. Creates text geometry using `three-bmfont-text`
3. Creates an MSDF material using `three-bmfont-text/shaders/msdf`
4. Renders text into an offscreen `WebGLRenderTarget`
5. Creates a 3D mesh with a `ShaderMaterial` that samples the render target texture
6. Uses `onBeforeRender` to re-render the text texture before each frame

### Critical Implementation Details

**Offscreen Render Target:**
```javascript
this.rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
this.rtCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
this.rtCamera.position.z = 2.4;
this.rtScene = new THREE.Scene();
this.rtScene.background = new THREE.Color(this.opts.fill);
```

**Text Mesh in RT Scene:**
```javascript
this.text = new THREE.Mesh(this.fontGeometry, this.fontMaterial);
this.text.position.set(...this.opts.wordPosition);
this.text.rotation.set(Math.PI, 0, 0);  // Flip text (BMFont y is inverted)
this.text.scale.set(...this.opts.wordScale);
this.rtScene.add(this.text);
```

**Main Mesh with ShaderMaterial:**
```javascript
this.material = new THREE.ShaderMaterial({
  vertexShader: this.opts.vertex,
  fragmentShader: this.opts.fragment,
  uniforms: {
    uTime: { value: 0 },
    uTexture: { value: this.rt.texture },  // ← THE TEXT TEXTURE
  },
  defines: { PI: Math.PI },
  side: THREE.DoubleSide
});
```

**The onBeforeRender Hook (Critical):**
```javascript
this.mesh.onBeforeRender = (renderer) => {
  renderer.setRenderTarget(this.rt);
  renderer.render(this.rtScene, this.rtCamera);
  renderer.setRenderTarget(null);
};
```

---

## Step 3: GLSL Shaders

### Demo 1: Torus Knot — "Endless" (Scrolling + Fog)

**Vertex:**
```glsl
varying vec2 vUv;
varying vec3 vPosition;
uniform float uTime;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
```

**Fragment:**
```glsl
varying vec2 vUv;
varying vec3 vPosition;
uniform float uTime;
uniform sampler2D uTexture;

void main() {
  float time = uTime * 0.4;
  vec2 repeat = -vec2(12., 3.);
  vec2 uv = fract(vUv * repeat - vec2(time, 0.));
  vec3 texture = texture2D(uTexture, uv).rgb;
  float fog = clamp(vPosition.z / 6., 0., 1.);
  vec3 fragColor = mix(vec3(0.), texture, fog);
  gl_FragColor = vec4(fragColor, 1.);
}
```

**Technique:** `fract(vUv * repeat - vec2(time, 0.))` tiles and scrolls the text texture. Fog fades the back to black.

### Demo 2: Sphere — "Swirl" (Sin-wave Distortion)

**Vertex:** Same passthrough as Demo 1.

**Fragment:**
```glsl
varying vec2 vUv;
varying vec3 vPosition;
uniform float uTime;
uniform sampler2D uTexture;

void main() {
  float time = uTime * 1.5;
  vec2 repeat = vec2(12., 12.);
  vec2 uv = fract(vUv * repeat + vec2(sin(vUv.y * 1.) * 5., time));
  vec3 texture = texture2D(uTexture, uv).rgb;
  float depth = vPosition.z / 10.;
  vec3 fragColor = mix(vec3(0., 0., .8), texture, depth);
  gl_FragColor = vec4(fragColor, 1.);
}
```

**Technique:** `sin(vUv.y) * 5.` offsets x-coordinate creating a swirl. Blue fog at depth.

### Demo 3: Box — "Twisted" (Vertex Twist)

**Vertex:**
```glsl
varying vec2 vUv;
uniform float uTime;

mat4 rotation3d(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat4(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
    0.0,                                0.0,                                0.0,                                1.0
  );
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
  return (rotation3d(axis, angle) * vec4(v, 1.0)).xyz;
}

void main() {
  vUv = uv;
  vec3 pos = position;
  vec3 axis = vec3(1., 0., 0.);
  float twist = 0.1;
  float angle = pos.x * twist;
  vec3 transformed = rotate(pos, axis, angle);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.);
}
```

**Fragment:**
```glsl
varying vec2 vUv;
uniform float uTime;
uniform sampler2D uTexture;

void main() {
  float time = uTime * 0.25;
  vec2 uv = fract(vUv * 3. - vec2(time, 0.));
  vec3 texture = texture2D(uTexture, uv).rgb;
  gl_FragColor = vec4(texture, 1.);
}
```

**Technique:** Vertex shader twists via rotation matrix; amount varies along x-axis.

### Demo 4: Plane — "Relax" (Wave Deformation + Shadow)

**Vertex:**
```glsl
varying vec2 vUv;
varying float vWave;
uniform float uTime;

void main() {
  vUv = uv;
  vec3 pos = position;
  float freq = 0.5;
  float amp = 1.;
  float time = uTime * 3.5;
  pos.z += sin((pos.x - pos.y) * freq - time) * amp;
  vWave = pos.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
}
```

**Fragment:**
```glsl
varying vec2 vUv;
varying float vWave;
uniform float uTime;
uniform sampler2D uTexture;

float map(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

void main() {
  float time = uTime * 0.25;
  vec2 repeat = vec2(4., 16.);
  vec2 uv = fract(vUv * repeat);
  vec3 texture = texture2D(uTexture, uv).rgb;
  float wave = vWave;
  wave = map(wave, -1., 1., 0., 0.1);
  float shadow = 1. - wave;
  vec3 fragColor = texture * shadow;
  gl_FragColor = vec4(fragColor, 1.);
}
```

**Technique:** Vertex displaces z with traveling sine wave; fragment uses wave height for shadow.

---

## Step 4: Options Configuration

Each variant needs a configuration object:

```javascript
const options = [
  {
    word: 'ENDLESS',
    color: '#ffffff',
    fill: '#000000',
    geometry: new THREE.TorusKnotGeometry(9, 3, 768, 3, 4, 3),
    position: {
      texture: [-0.965, -0.4, 0],
      mesh: [0, 0, 0]
    },
    scale: [0.008, 0.04, 1],
    shaders: { vertex: shaders.vertex.demo1, fragment: shaders.fragment.demo1 },
    font: { file: 'path/to/font.fnt', atlas: 'path/to/font.png' },
    class: 'demo-1'
  },
  // ... more variants
];
```

### Geometry Parameters per Variant

| Variant | Geometry Constructor | Notes |
|---------|---------------------|-------|
| torus-knot | `TorusKnotGeometry(9, 3, 768, 3, 4, 3)` | High tubular segments for smooth text |
| sphere | `SphereGeometry(12, 64, 64)` | 64x64 segments for deformation |
| box | `BoxGeometry(100, 10, 10, 64, 64, 64)` | Long bar, high subdivision |
| plane | `PlaneGeometry(27, 27, 64, 64)` | Square plane, 64x64 for wave |

---

## Step 5: App Controller (Carousel)

For the "all variants" mode, position geometries in a circle and rotate the scene on navigation:

```javascript
import gsap from 'gsap';

// Position demos in a circle
for (let i = 0; i < options.length; i++) {
  let angle = (i / options.length) * (Math.PI * 2) + Math.PI * 1.5;
  let radius = 50;
  let x = radius * Math.cos(angle);
  let z = radius * Math.sin(angle);
  options[i].position.mesh = [x, 0, z];
}

// Navigate between demos
function navigateTo(index, scene) {
  gsap.to(scene.rotation, {
    duration: 1.5,
    ease: "expo.inOut",
    y: `+=${turn}`,
  });
}
```

The camera stays at origin. Scene rotation brings different geometries into view.

---

## Key Concepts

### Render-to-Texture Pattern
```
BMFont Text → Offscreen Scene → WebGLRenderTarget → rt.texture → ShaderMaterial
```

### UV Tiling & Scrolling
```glsl
vec2 uv = fract(vUv * repeat - vec2(time, 0.));
```
- `vUv * repeat` — tiles the texture
- `- vec2(time, 0.)` — scrolls horizontally
- `fract()` — wraps to [0,1] for seamless repetition

### Depth-Based Fog
```glsl
float fog = clamp(vPosition.z / 6., 0., 1.);
vec3 fragColor = mix(vec3(0.), texture, fog);
```

### BMFont Text Position Tuning
- `wordPosition` controls where text sits in the RT scene (camera is at z=2.4)
- `wordScale` controls text size — needs fine-tuning per font
- `rotation.x = Math.PI` flips text right-side up (BMFont y is inverted)

---

## HTML Structure

The Three.js canvas needs a container element:
```html
<div id="webgl"></div>
```

The canvas should be positioned fixed to fill the viewport:
```css
canvas {
  position: fixed;
  top: 0;
  left: 0;
}
```

---

## Font Asset Generation

BMFont requires two files per font:
- **`.fnt`** — XML/text descriptor with glyph metrics
- **`.png`** — Texture atlas with all glyphs

Generate using [msdf-bmfont-xml](https://github.com/nicholasgasior/msdf-bmfont-xml):
```bash
npx msdf-bmfont-xml -f json -o public/fonts/MyFont.fnt MyFont.ttf
```

Or use [Hiero](https://libgdx.com/wiki/tools/hiero) for a GUI approach.

Place generated files in `public/fonts/` so they're served as static assets.
