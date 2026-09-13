/**
 * Shared helpers for the procedural structure models. VISUAL DEMONSTRATION —
 * every structure is drawn at an exaggerated scale (a town block spans ~3 km
 * of a 300 km world) so it reads from the mission-control camera distance;
 * nothing here is to scale or a claim about real buildings.
 */
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from "three";
import type { StructureType } from "@shared/types";
import { shoreX } from "@/propagation/world";
import { terrainHeightKm } from "@/three/world/demoWorld";

/** Deterministic 0-1 hash of a string + salt — stable per structure id. */
export function hash01(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Shoreline tangent direction at northing yKm, in world km: (dx, dy),
 * unit length, pointing north-ish. */
export function shoreTangent(yKm: number): [number, number] {
  const dxdy = (shoreX(yKm + 0.5) - shoreX(yKm - 0.5)) / 1.0;
  const len = Math.hypot(dxdy, 1);
  return [dxdy / len, 1 / len];
}

/** Scene-space Y rotation that aligns a model's local +X with the shore
 * tangent (so quays run along the coast) and its local -Z toward the sea. */
export function shoreAlignedRotationY(yKm: number): number {
  const [tx, ty] = shoreTangent(yKm);
  // km (tx, ty) -> scene (tx, -ty); angle of that vector from +x toward +z.
  return -Math.atan2(-ty, tx);
}

export const COASTAL_TYPES: ReadonlySet<StructureType> = new Set(["port", "lighthouse", "fuel_terminal"]);

export interface FootprintGround {
  /** Where the model's base sits: the HIGHEST terrain under its footprint,
   * so no corner of the plate pokes up through the building. */
  baseY: number;
  /** Highest minus lowest terrain under the footprint — how deep the
   * foundation has to reach on the downhill side to close the gap. */
  reliefY: number;
}

/**
 * Fits a structure to uneven ground.
 *
 * Sampling the terrain at the structure's centre alone leaves a building
 * floating on its downhill corner (and buried on its uphill one) wherever
 * the plate is not flat. Sampling a ring around the footprint gives both
 * numbers needed to seat it: the base goes at the high point, and a
 * foundation skirt of `reliefY` (plus a margin) closes the gap underneath.
 *
 * Reads the same `terrainHeightKm` the land mesh is built from, so the seam
 * is exact rather than approximately right.
 */
export function footprintGround(xKm: number, yKm: number, radiusKm: number, flat = false): FootprintGround {
  let min = terrainHeightKm(xKm, yKm, flat);
  let max = min;
  const samples = 12;
  for (let ring = 0; ring < 2; ring++) {
    const r = radiusKm * (ring === 0 ? 0.6 : 1);
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const h = terrainHeightKm(xKm + Math.cos(a) * r, yKm + Math.sin(a) * r, flat);
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { baseY: Math.max(0.05, max), reliefY: Math.max(0, max - min) };
}

let windowTexture: CanvasTexture | null = null;

/** A shared lit-windows texture for building facades (emissive map). */
export function getWindowTexture(): CanvasTexture {
  if (windowTexture) return windowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) {
    for (let x = 4; x < 64; x += 8) {
      const lit = ((x * 7 + y * 13) % 17) / 17;
      if (lit > 0.45) {
        ctx.fillStyle = lit > 0.85 ? "#ffe2a8" : "#ffd27a";
        ctx.fillRect(x, y, 4, 5);
      }
    }
  }
  windowTexture = new CanvasTexture(canvas);
  windowTexture.wrapS = RepeatWrapping;
  windowTexture.wrapT = RepeatWrapping;
  windowTexture.colorSpace = SRGBColorSpace;
  return windowTexture;
}

export interface StructurePalette {
  wall: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  base: { wall: Color; roof: Color; accent: Color; metal: Color; glass: Color };
}

export function createPalette(type: StructureType, seed: string): StructurePalette {
  const v = hash01(seed, 3);
  const wallBase = type === "hospital" ? "#e8ecef" : type === "power_plant" ? "#b8bec4" : type === "fuel_terminal" ? "#dfe3e6" : type === "lighthouse" ? "#f4f1ea" : new Color().setHSL(0.08 + v * 0.05, 0.12, 0.62 + v * 0.15).getStyle();
  const roofBase = type === "hospital" ? "#c9d1d8" : type === "building" ? new Color().setHSL(0.02 + v * 0.06, 0.35, 0.32).getStyle() : "#8e969c";
  const accentBase = type === "hospital" ? "#d9363e" : type === "lighthouse" ? "#c8322e" : type === "port" ? "#e0a020" : type === "power_plant" ? "#4b5560" : "#2e7fb0";
  const mk = (c: string, roughness = 0.85, metalness = 0.05) => new MeshStandardMaterial({ color: c, roughness, metalness });
  const wall = mk(wallBase, 0.9);
  if (type === "building" || type === "hospital") {
    wall.emissiveMap = getWindowTexture();
    wall.emissive = new Color("#ffcf8a");
    wall.emissiveIntensity = 0.55;
  }
  const palette: StructurePalette = {
    wall,
    roof: mk(roofBase, 0.95),
    accent: mk(accentBase, 0.6, 0.2),
    metal: mk("#6b7580", 0.45, 0.7),
    glass: new MeshStandardMaterial({ color: "#9fd7ff", roughness: 0.15, metalness: 0.1, emissive: "#6fc2ff", emissiveIntensity: 0.6 }),
    base: {
      wall: new Color(wallBase),
      roof: new Color(roofBase),
      accent: new Color(accentBase),
      metal: new Color("#6b7580"),
      glass: new Color("#9fd7ff"),
    },
  };
  return palette;
}

const CHARRED = new Color("#2b2622");
const MUDDY = new Color("#4a4034");
const OILED = new Color("#1a1612");

/** Tints the palette toward damage as exposure rises — flooded/tsunami
 * structures go muddy, wind-battered ones charred-grey, oiled ones black. */
export function applyDamage(p: StructurePalette, exposure: number, kind: "tsunami" | "cyclone" | "oil_spill" | "coastal_flood" | null): void {
  const target = kind === "oil_spill" ? OILED : kind === "cyclone" ? CHARRED : MUDDY;
  const t = Math.min(1, Math.max(0, exposure)) * 0.85;
  p.wall.color.copy(p.base.wall).lerp(target, t);
  p.roof.color.copy(p.base.roof).lerp(target, t);
  p.accent.color.copy(p.base.accent).lerp(target, t * 0.6);
  p.metal.color.copy(p.base.metal).lerp(target, t * 0.5);
  if (p.wall.emissiveMap) p.wall.emissiveIntensity = 0.55 * (1 - t);
  p.glass.emissiveIntensity = 0.6 * (1 - t);
}

export function disposePalette(p: StructurePalette): void {
  p.wall.dispose();
  p.roof.dispose();
  p.accent.dispose();
  p.metal.dispose();
  p.glass.dispose();
}

export const STATUS_COLOR = { clear: "#3fbf8a", at_risk: "#d9b23d", impacted: "#e08a3c", severe: "#e2564c" } as const;
