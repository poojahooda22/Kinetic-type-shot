import * as THREE from 'three';
import torusKnotVert from './shaders/torus-knot.vert';
import torusKnotFrag from './shaders/torus-knot.frag';
import type { KineticTypeOptions } from './KineticType';

export function createTorusKnotOptions(
  word: string,
  color: string,
  fill: string,
): KineticTypeOptions {
  return {
    word,
    color,
    fill,
    geometry: new THREE.TorusKnotGeometry(5, 1.7, 768, 3, 4, 3),
    meshPosition: [0, 0, 0],
    shaders: {
      vertex: torusKnotVert,
      fragment: torusKnotFrag,
    },
  };
}