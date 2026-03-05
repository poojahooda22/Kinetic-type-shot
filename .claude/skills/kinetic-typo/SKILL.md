---
name: kinetic-typo
description: "Implement kinetic typography effect - animated text mapped onto 3D geometries using Three.js with custom GLSL shaders"
---

# Kinetic Typography Implementation

Implement the kinetic typography effect in this project based on the [codrops-kinetic-typo](https://github.com/marioecg/codrops-kinetic-typo) technique.

## Parse Arguments

`$ARGUMENTS`

Parse the arguments as follows:
- **Variant** (first word): `torus-knot` | `sphere` | `box` | `plane` | `all` (default: `torus-knot`)
- **Text** (second word or quoted string): The display text (default: `KINETIC`)
- **Flags** (any order):
  - `--color=#ffffff` — Text color hex (default: `#ffffff`)
  - `--bg=#000000` — Background fill color hex (default: `#000000`)

### Examples
- No args → torus-knot variant, "KINETIC" text, white on black
- `sphere SWIRL --color=#00ff00` → sphere variant, "SWIRL" in green
- `all PORTFOLIO` → all 4 variants with "PORTFOLIO" text
- `plane "HELLO WORLD"` → plane variant with custom text

---

## Architecture

The core technique is **render-to-texture**: BMFont text is rendered into an offscreen `WebGLRenderTarget`, then that texture is sampled by a custom GLSL shader on a 3D geometry.

```
BMFont (.fnt + .png) → Text Mesh → Offscreen Scene → WebGLRenderTarget
                                                          ↓
                                              rt.texture (uTexture uniform)
                                                          ↓
                              3D Geometry ← ShaderMaterial (vertex + fragment)
                                                          ↓
                                              Animated text on 3D surface
```

The `onBeforeRender` callback re-renders the text texture every frame before the main mesh draws.

---

## Implementation Steps

Follow these steps in order. Read the reference files first:
- `.claude/skills/kinetic-typo/reference/implementation-guide.md` — Full code walkthrough
- `.claude/skills/kinetic-typo/reference/Type.js` — Original core class
- `.claude/skills/kinetic-typo/reference/shaders.glsl` — All 4 shader pairs

### Step 1: Install Dependencies

```bash
npm install three three-bmfont-text load-bmfont gsap
npm install -D @types/three vite-plugin-glsl
```

### Step 2: Update vite.config.ts

Add the GLSL plugin to the existing Vite config:

```typescript
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [react(), tailwindcss(), glsl()],
});
```

### Step 3: Create TypeScript Declarations

Create `src/types/glsl.d.ts`:
```typescript
declare module '*.glsl' { const value: string; export default value; }
declare module '*.vert' { const value: string; export default value; }
declare module '*.frag' { const value: string; export default value; }
```

Create `src/types/three-bmfont-text.d.ts`:
```typescript
declare module 'three-bmfont-text' {
  import { BufferGeometry } from 'three';
  interface CreateTextOptions {
    font: any;
    text?: string;
    width?: number;
    align?: string;
    letterSpacing?: number;
    lineHeight?: number;
  }
  export default function createText(options: CreateTextOptions): BufferGeometry;
}

declare module 'three-bmfont-text/shaders/msdf' {
  interface MSDFShaderOptions {
    map: any;
    side?: any;
    transparent?: boolean;
    negate?: boolean;
    color?: string | number;
  }
  export default function MSDFShader(options: MSDFShaderOptions): any;
}

declare module 'load-bmfont' {
  export default function loadFont(
    uri: string,
    callback: (err: Error | null, font: any) => void
  ): void;
}
```

### Step 4: Create GL Manager

Create `src/gl/GLManager.ts` — A class (NOT a singleton) that manages the Three.js renderer, camera, scene, and animation loop. It should:
- Accept a container HTML element in the constructor
- Create `WebGLRenderer` with `alpha: true`
- Create `PerspectiveCamera` (fov: 45, near: 1, far: 1000, z: 1)
- Create `Scene` and `Clock`
- Run an animation loop that calls `updateTime(elapsed)` on all scene children
- Handle window resize events
- Provide a `dispose()` method that stops the loop, removes event listeners, and disposes the renderer

Refer to the GL Singleton in `reference/implementation-guide.md` Step 1, but adapt it as a class with proper cleanup.

### Step 5: Create KineticType Class

Create `src/gl/KineticType.ts` — TypeScript adaptation of `reference/Type.js`. The class should:
- Extend `THREE.Object3D`
- Accept an options object with: word, color, fill, geometry, position, scale, shaders, font paths
- Load BMFont via `load-bmfont` and create text geometry via `three-bmfont-text`
- Create an offscreen `WebGLRenderTarget` with a scene containing the text mesh
- Create the main mesh with a `ShaderMaterial` using the provided vertex/fragment shaders
- Set up `onBeforeRender` to render the text scene to the render target each frame
- Provide `updateTime(time: number)` method to update the `uTime` uniform
- Provide a `dispose()` method to clean up geometries, materials, textures, and render targets

Refer to `reference/Type.js` for the exact implementation pattern.

### Step 6: Create Shader Files

Based on the requested variant(s), create shader files in `src/gl/shaders/`:

**If variant is `torus-knot` or `all`:**
- `torus-knot.vert` — Passthrough with vUv and vPosition varyings
- `torus-knot.frag` — Scrolling text (`fract(vUv * repeat - vec2(time, 0.))`) with depth fog

**If variant is `sphere` or `all`:**
- `sphere.vert` — Same passthrough
- `sphere.frag` — Swirling text with `sin(vUv.y) * 5.` offset and blue depth fog

**If variant is `box` or `all`:**
- `box.vert` — Twist deformation using rotation matrix on x-axis
- `box.frag` — Simple 3x tiling with horizontal scroll

**If variant is `plane` or `all`:**
- `plane.vert` — Wave displacement (`sin((pos.x - pos.y) * freq - time) * amp`)
- `plane.frag` — 4x16 tiling with wave-based shadow

Refer to `reference/shaders.glsl` for the exact shader code for each variant.

### Step 7: Create Options Config

Create `src/gl/options.ts` — Configuration for each variant:

| Variant | Geometry | Key Parameters |
|---------|----------|---------------|
| torus-knot | `TorusKnotGeometry(9, 3, 768, 3, 4, 3)` | repeat: [-12, 3], speed: 0.4, fog depth |
| sphere | `SphereGeometry(12, 64, 64)` | repeat: [12, 12], speed: 1.5, blue fog |
| box | `BoxGeometry(100, 10, 10, 64, 64, 64)` | repeat: 3, speed: 0.25, twist: 0.1 |
| plane | `PlaneGeometry(27, 27, 64, 64)` | repeat: [4, 16], wave freq: 0.5, amp: 1 |

Use the text, color, and bg values from the parsed arguments. Import the shader files.

### Step 8: Create React Component

Create `src/components/KineticTypography.tsx`:
- Accept props: `variant`, `text`, `color`, `bgColor`, `className`
- Use `useRef` for the container div
- Use `useEffect` to:
  - Create `GLManager` instance with the container ref
  - Create `KineticType` instance(s) based on variant
  - Return cleanup function that calls `dispose()` on everything
- Handle React StrictMode double-mount gracefully
- Render a `div` that fills its container (the Three.js canvas is appended inside)

### Step 9: Update App.tsx

Replace the boilerplate content with the `KineticTypography` component. If variant is `all`, implement a carousel with navigation (GSAP scene rotation on click, per the original). If a single variant, just display it.

### Step 10: Set Up Font Assets

BMFont requires `.fnt` + `.png` files in `public/fonts/`. Add instructions as a comment in the options file:

```
// Generate BMFont assets:
// npx msdf-bmfont-xml -f json -o public/fonts/MyFont MyFont.ttf
// This creates MyFont.fnt and MyFont.png
```

For development, you can use a placeholder approach: create the render target scene but with a simple `THREE.Mesh` using `TextGeometry` from three/addons if font files aren't available yet, OR provide a default font (if you find one bundled).

### Step 11: Verify

Run `npm run build` to check for TypeScript and build errors. Then `npm run dev` to preview.

---

## Variant Details

### Torus Knot ("Endless")
- Geometry: `TorusKnotGeometry(9, 3, 768, 3, 4, 3)`
- Effect: Text scrolls horizontally across the knot surface with depth-based fog
- Fragment key: `fract(vUv * vec2(-12., -3.) - vec2(time * 0.4, 0.))`

### Sphere ("Swirl")
- Geometry: `SphereGeometry(12, 64, 64)`
- Effect: Text swirls with sin-wave UV distortion, blue depth fog
- Fragment key: `fract(vUv * vec2(12.) + vec2(sin(vUv.y) * 5., time * 1.5))`

### Box ("Twisted")
- Geometry: `BoxGeometry(100, 10, 10, 64, 64, 64)`
- Effect: Geometry twisted along x-axis, text scrolls across surfaces
- Vertex key: `rotate(pos, vec3(1,0,0), pos.x * 0.1)`

### Plane ("Relax")
- Geometry: `PlaneGeometry(27, 27, 64, 64)`
- Effect: Wave displacement with shadow mapping from wave height
- Vertex key: `pos.z += sin((pos.x - pos.y) * 0.5 - time * 3.5)`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Text not visible | Check `wordPosition` and `wordScale` — text must be visible to RT camera at z=2.4 |
| Text upside down | BMFont y-axis is inverted; apply `rotation.x = Math.PI` to text mesh |
| Jagged text | Use MSDF fonts for crisp rendering at any scale |
| Black texture | Ensure `onBeforeRender` renders the RT scene before the main render |
| Performance issues | Reduce RT resolution, lower geometry subdivision, or cap `devicePixelRatio` |
| Seams in tiling | Use `fract()` and ensure UV coordinates wrap correctly |
| React double-mount | Ensure `dispose()` fully cleans up; GLManager should handle being created/destroyed twice |

---

## File Structure Created

```
src/
├── types/
│   ├── glsl.d.ts
│   └── three-bmfont-text.d.ts
├── gl/
│   ├── GLManager.ts
│   ├── KineticType.ts
│   ├── options.ts
│   └── shaders/
│       ├── torus-knot.vert / .frag
│       ├── sphere.vert / .frag
│       ├── box.vert / .frag
│       └── plane.vert / .frag
├── components/
│   └── KineticTypography.tsx
└── App.tsx (updated)
```
