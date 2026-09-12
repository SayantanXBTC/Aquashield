import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Ambient fluid backdrop for the landing + gateway routes — a raw WebGL2
 * fullscreen quad (no three.js: the landing page is the initial bundle and
 * three/ stays lazy, CLAUDE.md §27). Layered domain-warped fbm read as slow
 * deep-water motion in the console's cyan-on-void palette; the pointer adds
 * a light parallax drift. Renders at 0.6x resolution — the effect is soft by
 * design and the saving is worth it on integrated GPUs.
 *
 * Purely decorative and entirely synthetic: not a sea state, not data.
 */

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for(int i = 0; i < 5; i++){ v += a * noise(p); p = r * p * 2.03 + 3.1; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * 0.06;
  uv += (u_mouse - 0.5) * 0.08;

  // Domain warp: two fbm passes feed a third, which is what makes the
  // motion read as fluid rather than scrolling texture.
  vec2 q = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 - t * 0.7 + 5.2));
  vec2 r = vec2(fbm(uv * 2.2 + 1.7 * q + vec2(1.7, 9.2) + t * 0.5), fbm(uv * 2.2 + 1.7 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(uv * 2.4 + 2.2 * r);

  vec3 deep   = vec3(0.020, 0.031, 0.043);
  vec3 body   = vec3(0.035, 0.110, 0.150);
  vec3 crest  = vec3(0.133, 0.722, 0.812);
  vec3 col = mix(deep, body, smoothstep(0.25, 0.75, f));
  float veins = smoothstep(0.55, 0.9, f) * smoothstep(0.9, 0.55, length(r - 0.5) * 1.6);
  col = mix(col, crest, veins * 0.35);

  // Fine caustic sparkle, lightly animated.
  float sparkle = pow(noise(uv * 40.0 + vec2(t * 8.0, -t * 6.0)), 18.0) * veins;
  col += crest * sparkle * 0.6;

  // Vignette to keep the centre (where the card sits) calm and dark.
  float vig = smoothstep(1.25, 0.25, length(uv));
  col *= 0.35 + 0.65 * vig;
  col = mix(col, deep, smoothstep(0.55, 0.0, length(uv)) * 0.35);

  fragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function FluidBackdrop({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const SCALE = 0.6;
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * SCALE));
      const h = Math.max(1, Math.floor(canvas.clientHeight * SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reducedMotion ? 0 : (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedMotion) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block h-full w-full ${className}`} />;
}
