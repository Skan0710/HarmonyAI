import React, { useRef, useEffect } from 'react';

interface NoiseProps {
  patternRefreshInterval?: number;
  patternAlpha?: number;
}

/** Lightweight animated film-grain overlay, drawn to a small canvas and stretched via CSS. */
const Noise: React.FC<NoiseProps> = ({ patternRefreshInterval = 4, patternAlpha = 6 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let frame = 0;
    let animationId = 0;
    const size = 256;
    canvas.width = size;
    canvas.height = size;

    const drawGrain = () => {
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = patternAlpha;
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const loop = () => {
      if (frame % patternRefreshInterval === 0) drawGrain();
      frame++;
      animationId = window.requestAnimationFrame(loop);
    };

    loop();

    return () => window.cancelAnimationFrame(animationId);
  }, [patternRefreshInterval, patternAlpha]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

/**
 * Ambient page background: warm-ink base with soft ember/gold radial glows and a
 * faint animated grain, so large flat surfaces don't read as a dead flat black.
 */
export const AmbientBackground: React.FC = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-surface-0">
    <div className="absolute inset-0 bg-[radial-gradient(circle_640px_at_15%_-10%,rgba(255,106,67,0.16),transparent)]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_580px_at_90%_15%,rgba(217,161,91,0.12),transparent)]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_720px_at_50%_115%,rgba(255,106,67,0.08),transparent)]" />
    <Noise />
  </div>
);
