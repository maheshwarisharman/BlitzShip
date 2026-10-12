"use client";

import { useEffect, useRef } from "react";
import { BOLT_POINTS } from "./logo";

const CELL_W = 9;
const CELL_H = 15;
const FONT_SIZE = 12;

const CORE_CHARS = "@%#&8BWM$";
const EDGE_CHARS = "XO0+=*";
const WAVE_CHARS = "+=-:*";
const SCRAMBLE_CHARS = "!@#$%&*+=?/\\<>{}[]01";

const BOLT = "#2d6bff";
const ICE = "#dbe7ff";
const WHITE = "#ffffff";
// Flat, stepped opacities of the same soft blue (no smooth gradients).
const SOFT = [
  "rgba(143,176,255,0.10)",
  "rgba(143,176,255,0.20)",
  "rgba(143,176,255,0.34)",
  "rgba(143,176,255,0.52)",
];

function hash(x: number, y: number) {
  let h = Math.imul(x ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(y + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967295;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function pointInPoly(px: number, py: number, poly: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A field of monospace characters that forms the BlitzShip bolt.
 * - a charge pulse travels down the bolt
 * - ripples radiate outward from its outline
 * - characters near the cursor scramble
 */
export function AsciiBolt({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Canvas can't resolve CSS variables, so read the real next/font family name.
    const monoFamily =
      getComputedStyle(host).getPropertyValue("--font-geist-mono").trim() || "ui-monospace";
    const fontSpec = `${FONT_SIZE}px ${monoFamily}, ui-monospace, Menlo, monospace`;

    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let inside: Uint8Array = new Uint8Array(0);
    let dist: Float32Array = new Float32Array(0);
    let ny: Float32Array = new Float32Array(0);
    let boltSize = 1;
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    let running = false;
    let last = 0;

    const layout = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(width / CELL_W);
      rows = Math.ceil(height / CELL_H);

      // Project the logo polygon into canvas space.
      boltSize = Math.min(width * 1.25, height * 0.98);
      const s = boltSize / 100;
      const cx = width * 0.56;
      const cy = height * 0.5;
      const poly = BOLT_POINTS.map(
        ([x, y]) => [cx + (x - 48) * s, cy + (y - 50) * s] as [number, number],
      );
      const top = cy + (2 - 50) * s;
      const bottom = cy + (98 - 50) * s;

      inside = new Uint8Array(cols * rows);
      dist = new Float32Array(cols * rows);
      ny = new Float32Array(cols * rows);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const px = c * CELL_W + CELL_W / 2;
          const py = r * CELL_H + CELL_H / 2;
          inside[i] = pointInPoly(px, py, poly) ? 1 : 0;
          let d = Infinity;
          for (let k = 0; k < poly.length; k++) {
            const a = poly[k];
            const b = poly[(k + 1) % poly.length];
            d = Math.min(d, segDist(px, py, a[0], a[1], b[0], b[1]));
          }
          dist[i] = d;
          ny[i] = (py - top) / (bottom - top);
        }
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = fontSpec;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      const tick = Math.floor(t * 9);
      const band = ((t * 0.42) % 1.5) - 0.25; // charge pulse position (0..1 along bolt)
      const reach = boltSize * 0.52;
      const mouseR = 96;
      let lastFill = "";

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x = c * CELL_W + CELL_W / 2;
          const y = r * CELL_H + CELL_H / 2;
          const d = dist[i];
          const rnd = hash(c, r);
          const flick = hash(c * 7 + tick, r * 13 + tick);

          let ch = "";
          let fill = "";

          const md = Math.hypot(x - mouse.x, y - mouse.y);
          if (md < mouseR && (md < mouseR * 0.45 || flick > 0.35)) {
            ch = SCRAMBLE_CHARS[Math.floor(flick * SCRAMBLE_CHARS.length)];
            fill = md < mouseR * 0.45 ? WHITE : ICE;
          } else if (inside[i]) {
            const onBand = Math.abs(ny[i] - band) < 0.045;
            if (onBand) {
              ch = CORE_CHARS[Math.floor(flick * CORE_CHARS.length)];
              fill = WHITE;
            } else if (d < CELL_W * 1.6) {
              ch = EDGE_CHARS[Math.floor(flick * EDGE_CHARS.length)];
              fill = ICE;
            } else if (flick > 0.985) {
              ch = "*";
              fill = WHITE;
            } else {
              ch = CORE_CHARS[Math.floor(rnd * CORE_CHARS.length)];
              fill = BOLT;
            }
          } else if (d < reach) {
            const wave = 0.5 + 0.5 * Math.sin(d * 0.055 - t * 2.4);
            const falloff = 1 - d / reach;
            const energy = falloff * (0.35 + 0.65 * wave);
            if (rnd < energy * 0.95) {
              const level = Math.min(3, Math.floor(energy * 4.4));
              ch = WAVE_CHARS[Math.min(WAVE_CHARS.length - 1, Math.floor(energy * WAVE_CHARS.length * 1.2))];
              fill = SOFT[level];
            } else if (rnd > 0.965) {
              ch = ".";
              fill = SOFT[0];
            }
          } else if (rnd > 0.975) {
            ch = flick > 0.5 ? "·" : ".";
            fill = SOFT[0];
          }

          if (!ch) continue;
          if (fill !== lastFill) {
            ctx.fillStyle = fill;
            lastFill = fill;
          }
          ctx.fillText(ch, x, y);
        }
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30fps is plenty for ASCII
      last = now;
      draw(now / 1000);
    };

    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    layout();
    draw(reduceMotion ? 2.4 : 0);

    const ro = new ResizeObserver(() => {
      layout();
      if (!running) draw(reduceMotion ? 2.4 : 0);
    });
    ro.observe(host);

    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.05 },
    );
    io.observe(host);

    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
