import { describe, expect, it } from "vitest";
import { landDepthKm, terrainHeightKm } from "@/three/world/demoWorld";
import { buildPlacements } from "./forestPlacement";
import { forestDensity, tfbm } from "./worldNoise";

/** The forest is deterministic, so its shape is assertable without a GPU. */
describe("forest placement", () => {
  const stands = buildPlacements();
  const all = [...stands.conifer, ...stands.broadleaf, ...stands.palm];

  it("matches the terrain shader's noise distribution", () => {
    // Regression guard. The GLSL hash fracts only the FINAL product; an
    // earlier JS twin also fract'ed the intermediate, which collapsed the
    // mean from ~0.5 to ~0.25 and left the world with 93 trees on it. The
    // shader's forest mask keys off smoothstep(0.5, 0.74), so a low mean is
    // indistinguishable from "no forest anywhere".
    const values: number[] = [];
    for (let y = 0; y < 300; y += 3) for (let x = 150; x < 260; x += 3) values.push(tfbm(x * 0.11 + 4.2, y * 0.11 + 4.2));
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    expect(median).toBeGreaterThan(0.4);
    expect(median).toBeLessThan(0.6);
    expect(values.filter((v) => v > 0.5).length / values.length).toBeGreaterThan(0.2);
  });

  it("plants a forest rather than a scattering", () => {
    expect(all.length).toBeGreaterThan(2000);
    expect(stands.conifer.length).toBeGreaterThan(500);
    expect(stands.broadleaf.length).toBeGreaterThan(500);
    expect(stands.palm.length).toBeGreaterThan(100);
    // Dense enough to read where the scenarios actually happen.
    const nearLandfall = all.filter((t) => Math.abs(t.yKm - 150) < 30 && landDepthKm(t.xKm, t.yKm) < 40);
    expect(nearLandfall.length).toBeGreaterThan(100);
  });

  it("keeps the beach and the sea bare", () => {
    for (const tree of all) {
      expect(landDepthKm(tree.xKm, tree.yKm)).toBeGreaterThan(0.5);
    }
    // Palms hug the shoreline; the inland species stay behind the dunes.
    const inland = [...stands.conifer, ...stands.broadleaf];
    expect(Math.min(...inland.map((t) => landDepthKm(t.xKm, t.yKm)))).toBeGreaterThan(0.8);
  });

  it("stands every tree on the terrain surface, not above it", () => {
    for (const tree of all.slice(0, 400)) {
      const ground = terrainHeightKm(tree.xKm, tree.yKm);
      expect(tree.y).toBeLessThanOrEqual(ground);
      expect(ground - tree.y).toBeLessThan(0.2);
    }
  });

  it("only grows where the terrain paints forest", () => {
    // Every inland tree sits somewhere the density function is non-zero —
    // trees and the green the shader paints cannot drift apart.
    for (const tree of [...stands.conifer, ...stands.broadleaf].slice(0, 500)) {
      expect(forestDensity(tree.xKm, tree.yKm, landDepthKm(tree.xKm, tree.yKm))).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    const again = buildPlacements();
    expect(again.conifer.length).toBe(stands.conifer.length);
    expect(again.conifer[10].xKm).toBeCloseTo(stands.conifer[10].xKm, 10);
    expect(again.palm[5].rotY).toBeCloseTo(stands.palm[5].rotY, 10);
  });
});
