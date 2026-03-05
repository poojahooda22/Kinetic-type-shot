import { useEffect, useRef } from 'react';
import { GLManager } from '../gl/GLManager';
import { KineticType } from '../gl/KineticType';
import { createTorusKnotOptions } from '../gl/options';

interface KineticTypographyProps {
  variant?: 'torus-knot';
  text?: string;
  color?: string;
  bgColor?: string;
  className?: string;
}

export function KineticTypography({
  text = 'KINETIC',
  color = '#ffffff',
  bgColor = '#000000',
  className,
}: KineticTypographyProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const gl = new GLManager(container);
    const options = createTorusKnotOptions(text, color, bgColor);
    const kineticType = new KineticType(options, gl.renderer);
    gl.scene.add(kineticType);

    return () => {
      kineticType.dispose();
      gl.scene.remove(kineticType);
      gl.dispose();
    };
  }, [text, color, bgColor]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}