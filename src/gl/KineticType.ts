import * as THREE from 'three';

export interface KineticTypeOptions {
  word: string;
  color: string;
  fill: string;
  geometry: THREE.BufferGeometry;
  meshPosition: [number, number, number];
  shaders: {
    vertex: string;
    fragment: string;
  };
}

export class KineticType extends THREE.Object3D {
  private textTexture!: THREE.CanvasTexture;
  private shaderMaterial!: THREE.ShaderMaterial;
  private mainMesh!: THREE.Mesh;
  private mainGeometry: THREE.BufferGeometry;

  private opts: KineticTypeOptions;

  constructor(options: KineticTypeOptions, renderer?: THREE.WebGLRenderer) {
    super();
    this.opts = options;
    this.mainGeometry = options.geometry;
    this.createTextTexture(renderer);
    this.createMesh();
  }

  private createTextTexture(renderer?: THREE.WebGLRenderer) {
    const canvas = document.createElement('canvas');
    const height = 512;
    const fontSize = height * 0.75;
    const font = `bold ${fontSize}px Arial, sans-serif`;
    const gap = 200; // consistent spacing between text repetitions

    // Measure text to determine canvas width
    canvas.height = height;
    canvas.width = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.font = font;
    const textWidth = ctx.measureText(this.opts.word).width;

    // Resize canvas to fit text + gap (resizing resets context state)
    canvas.width = Math.ceil(textWidth + gap);

    // Re-apply context settings after resize
    ctx.fillStyle = this.opts.fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this.opts.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    ctx.fillText(this.opts.word, canvas.width / 2, canvas.height / 2);

    this.textTexture = new THREE.CanvasTexture(canvas);
    this.textTexture.wrapS = THREE.RepeatWrapping;
    this.textTexture.wrapT = THREE.RepeatWrapping;
    this.textTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.textTexture.magFilter = THREE.LinearFilter;
    this.textTexture.anisotropy = renderer
      ? renderer.capabilities.getMaxAnisotropy()
      : 16;
  }

  private createMesh() {
    this.shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: this.opts.shaders.vertex,
      fragmentShader: this.opts.shaders.fragment,
      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: this.textTexture },
      },
      defines: {
        PI: Math.PI,
      },
      side: THREE.FrontSide,
    });

    this.mainMesh = new THREE.Mesh(this.mainGeometry, this.shaderMaterial);
    this.mainMesh.position.set(...this.opts.meshPosition);

    this.add(this.mainMesh);
  }

  updateTime(time: number) {
    if (this.shaderMaterial) {
      this.shaderMaterial.uniforms.uTime.value = time;
    }
  }

  dispose() {
    this.textTexture?.dispose();
    this.shaderMaterial?.dispose();
    this.mainGeometry?.dispose();

    if (this.mainMesh) {
      this.remove(this.mainMesh);
    }
  }
}