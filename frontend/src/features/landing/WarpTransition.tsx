import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface WarpTransitionProps {
  /** Called once the warp has fully whited-out — the moment to swap routes. */
  onComplete: () => void;
  durationMs?: number;
}

/**
 * Post-login "warp": radial light streaks accelerate outward from the
 * centre while the page beneath is scaled by the caller, ending on a hard
 * flash to void so the command center's own camera dolly-in picks up the
 * motion (three/core/CameraController.tsx `entrance`). Canvas 2D, no
 * three.js — this runs before the 3D bundle has loaded. Under
 * prefers-reduced-motion it resolves after a short fade.
 */
export function WarpTransition({ onComplete, durationMs = 1100 }: WarpTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const done = useRef(onComplete);
  useEffect(() => {
    done.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.scale(dpr, dpr);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W / 2;
    const cy = H / 2;

    if (reducedMotion) {
      const id = window.setTimeout(() => done.current(), 260);
      return () => window.clearTimeout(id);
    }

    const COUNT = 220;
    const streaks = Array.from({ length: COUNT }, (_, i) => {
      const angle = (i / COUNT) * Math.PI * 2 + Math.sin(i * 7.31) * 0.2;
      return { angle, offset: Math.random(), speed: 0.6 + Math.random() * 0.9, width: 0.6 + Math.random() * 1.4 };
    });

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const ease = t * t * t;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = `rgba(5, 8, 11, ${0.15 + ease * 0.85})`;
      ctx.fillRect(0, 0, W, H);

      const maxR = Math.hypot(W, H) * 0.6;
      ctx.lineCap = "round";
      for (const s of streaks) {
        const head = ((s.offset + ease * s.speed * 2.2) % 1) * maxR;
        const len = 8 + ease * 260 * s.speed;
        const tail = Math.max(0, head - len);
        const alpha = Math.min(1, ease * 1.6) * (0.25 + 0.75 * (head / maxR));
        ctx.strokeStyle = `rgba(95, 216, 228, ${alpha})`;
        ctx.lineWidth = s.width * (0.5 + ease * 1.5);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(s.angle) * tail, cy + Math.sin(s.angle) * tail);
        ctx.lineTo(cx + Math.cos(s.angle) * head, cy + Math.sin(s.angle) * head);
        ctx.stroke();
      }

      // Core bloom that swells into the final flash.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 + ease * maxR);
      glow.addColorStop(0, `rgba(232, 238, 244, ${ease * ease})`);
      glow.addColorStop(0.35, `rgba(95, 216, 228, ${ease * 0.35})`);
      glow.addColorStop(1, "rgba(5, 8, 11, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      if (t < 1) raf = requestAnimationFrame(frame);
      else done.current();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, reducedMotion]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-screen w-screen" />;
}
