import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeOutCubic, fract, lerp, mixHex, progress, rgba, rng } from '../math';
import { palette } from '../theme';
import { useCamera } from './CameraRig';
import { drawGlow, useCanvas } from './canvas';

interface Node {
  x: number;
  y: number;
  z: number;
  layer: number;
  phase: number;
  rate: number;
  color: string;
}
interface Edge {
  a: number;
  b: number;
  revealAt: number;
  period: number;
  phase: number;
}

const LAYERS = [5, 7, 8, 7, 4];

function buildGraph(seed: number): { nodes: Node[]; edges: Edge[] } {
  const r = rng(seed);
  const nodes: Node[] = [];
  const first: number[] = [];
  LAYERS.forEach((n, layer) => {
    first.push(nodes.length);
    const color = mixHex(palette.violet, palette.electric, layer / (LAYERS.length - 1));
    for (let i = 0; i < n; i++) {
      nodes.push({
        x: (layer - (LAYERS.length - 1) / 2) * 290 + (r() - 0.5) * 50,
        y: (i - (n - 1) / 2) * 104 + (r() - 0.5) * 34,
        z: (r() - 0.5) * 420,
        layer,
        phase: r() * Math.PI * 2,
        rate: lerp(0.9, 2.1, r()),
        color,
      });
    }
  });
  const edges: Edge[] = [];
  for (let layer = 0; layer < LAYERS.length - 1; layer++) {
    for (let i = 0; i < LAYERS[layer]; i++) {
      // each neuron feeds its three nearest neighbours in the next layer: dense, but readable
      const a = first[layer] + i;
      const targets = Array.from({ length: LAYERS[layer + 1] }, (_, j) => first[layer + 1] + j)
        .sort((p, q) => Math.abs(nodes[p].y - nodes[a].y) - Math.abs(nodes[q].y - nodes[a].y))
        .slice(0, 3);
      for (const b of targets) edges.push({ a, b, revealAt: layer * 0.32 + r() * 0.4, period: lerp(1.5, 3.1, r()), phase: r() });
    }
  }
  return { nodes, edges };
}

/**
 * A layered network in real 3D space, projected with perspective. Synapses draw themselves in
 * layer by layer, then carry signal pulses; the camera's yaw orbits the whole structure.
 */
export const NeuralNetwork: React.FC<{ seed: number; glow?: number }> = ({ seed, glow = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const cam = useCamera();
  const graph = useMemo(() => buildGraph(seed), [seed]);

  const ref = useCanvas(
    (ctx, w, h) => {
      const t = frame / fps;
      const unit = h / 1080;
      const yaw = cam.yaw + Math.sin(t * 0.21) * 0.05;
      const pitch = 0.13;
      const focal = 1500;
      const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];

      const pts = graph.nodes.map((n) => {
        const x1 = n.x * cy + n.z * sy;
        const z1 = -n.x * sy + n.z * cy;
        const y2 = n.y * cp - z1 * sp;
        const z2 = n.y * sp + z1 * cp;
        const s = (focal / (focal + z2)) * unit;
        return { x: w / 2 + x1 * s, y: h / 2 + y2 * s, s, fog: clamp(lerp(1, 0.35, (z2 + 300) / 700)) };
      });

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (const e of graph.edges) {
        const drawn = easeOutCubic(progress(t, e.revealAt, e.revealAt + 0.7));
        if (drawn <= 0) continue;
        const [a, b] = [pts[e.a], pts[e.b]];
        const ex = lerp(a.x, b.x, drawn);
        const ey = lerp(a.y, b.y, drawn);
        const fog = (a.fog + b.fog) / 2;
        const color = graph.nodes[e.a].color;
        // wide faint stroke + thin bright stroke = a line that glows without a blur filter
        for (const [lw, alpha] of [
          [4.5, 0.045],
          [1.1, 0.3],
        ] as const) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = rgba(color, alpha * fog * glow);
          ctx.lineWidth = lw * ((a.s + b.s) / 2);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        if (drawn >= 1) {
          const u = fract((t - e.revealAt) / e.period + e.phase);
          const s = lerp(a.s, b.s, u);
          drawGlow(ctx, palette.electric, lerp(a.x, b.x, u), lerp(a.y, b.y, u), 13 * s, Math.sin(Math.PI * u) * 0.9 * fog * glow);
        }
      }

      graph.nodes.forEach((n, i) => {
        const born = easeOutCubic(progress(t, n.layer * 0.32 - 0.1, n.layer * 0.32 + 0.5));
        if (born <= 0) return;
        const p = pts[i];
        const act = Math.pow(0.5 + 0.5 * Math.sin(n.phase + t * n.rate), 3);
        drawGlow(ctx, n.color, p.x, p.y, (30 + act * 34) * p.s * born, (0.5 + act * 0.5) * p.fog * glow);
        ctx.globalAlpha = born * p.fog;
        ctx.strokeStyle = rgba(n.color, 0.85);
        ctx.lineWidth = 1.4 * p.s;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9.5 * p.s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = rgba('#ffffff', 0.55 + act * 0.45);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2 * p.s, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    [frame, graph, cam, glow, fps],
  );

  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};
