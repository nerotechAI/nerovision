import { useLayoutEffect, useRef } from 'react';
import { hexToRgb } from '../math';

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * Canvas that is fully redrawn from scratch whenever `deps` change. Drawing happens in a layout
 * effect, i.e. synchronously before Remotion captures the frame, so no delayRender is needed.
 */
export function useCanvas(draw: Draw, deps: React.DependencyList) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, canvas.width, canvas.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

const sprites = new Map<string, HTMLCanvasElement>();

/** Soft radial glow with a hot core, cached per colour. Drawn additively it reads as emitted light. */
export function glowSprite(color: string): HTMLCanvasElement {
  const cached = sprites.get(color);
  if (cached) return cached;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const [r, g, b] = hexToRgb(color);
  const hot = (v: number) => Math.round(v + (255 - v) * 0.7);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${hot(r)},${hot(g)},${hot(b)},1)`);
  grad.addColorStop(0.12, `rgba(${r},${g},${b},0.6)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.13)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  sprites.set(color, c);
  return c;
}

/** Draw a glow of the given radius centred on (x, y). */
export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, radius: number, alpha: number): void {
  if (alpha <= 0.003 || radius <= 0.2) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
}
