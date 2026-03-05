declare module 'three-bmfont-text' {
  import type { BufferGeometry } from 'three';
  interface CreateTextOptions {
    font: unknown;
    text?: string;
    width?: number;
    align?: string;
    letterSpacing?: number;
    lineHeight?: number;
  }
  export default function createText(options: CreateTextOptions): BufferGeometry;
}

declare module 'three-bmfont-text/shaders/msdf' {
  import type { Side } from 'three';
  interface MSDFShaderOptions {
    map: unknown;
    side?: Side;
    transparent?: boolean;
    negate?: boolean;
    color?: string | number;
  }
  export default function MSDFShader(options: MSDFShaderOptions): Record<string, unknown>;
}

declare module 'load-bmfont' {
  export default function loadFont(
    uri: string,
    callback: (err: Error | null, font: unknown) => void
  ): void;
}