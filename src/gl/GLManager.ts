import * as THREE from 'three';

interface Updatable extends THREE.Object3D {
  updateTime?(time: number): void;
}

export class GLManager {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  clock: THREE.Clock;

  private animationId: number | null = null;
  private container: HTMLElement;
  private boundResize = this.resize.bind(this);

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000000, 1);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.z = 24;

    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    container.appendChild(this.renderer.domElement);
    window.addEventListener('resize', this.boundResize);
    this.animate();
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const elapsed = this.clock.getElapsedTime();
    for (const child of this.scene.children) {
      const obj = child as Updatable;
      obj.updateTime?.(elapsed);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('resize', this.boundResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}