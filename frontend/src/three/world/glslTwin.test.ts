/**
 * The GLSL twin is compiled by the GPU, not by Vitest, so what is testable
 * here is that the uniform contract is complete and consistent: every
 * uniform the shader source declares is produced by shoreUniformDefaults,
 * and the sign it carries matches the ShoreParams it came from.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SHORE, type ShoreParams } from "@/propagation/world";
import { DEMO_WORLD_GLSL, shoreUniformDefaults } from "./demoWorld";

const EAST_FACING: ShoreParams = {
  baseXKm: 300 - DEFAULT_SHORE.baseXKm,
  terms: DEFAULT_SHORE.terms.map((t) => ({ amp: -t.amp, freq: t.freq, phase: t.phase })),
  landSign: -1,
};

describe("GLSL shore uniforms", () => {
  it("declares uLandSign", () => {
    expect(DEMO_WORLD_GLSL).toContain("uniform float uLandSign;");
  });

  it("applies the sign inside landDepthKm", () => {
    expect(DEMO_WORLD_GLSL).toContain("return uLandSign * (xKm - shoreX(yKm));");
  });

  it("does not bake the shoreline into shader source", () => {
    // A curated city must switch by uniform, never by recompile (CLAUDE.md §27).
    expect(DEMO_WORLD_GLSL).not.toContain(String(DEFAULT_SHORE.baseXKm));
  });

  it("carries the sign through shoreUniformDefaults", () => {
    expect(shoreUniformDefaults().uLandSign).toBe(1);
    expect(shoreUniformDefaults(EAST_FACING).uLandSign).toBe(-1);
  });

  it("produces one uniform value per declared shore uniform", () => {
    const declared = [...DEMO_WORLD_GLSL.matchAll(/uniform \w+ (u\w+);/g)].map((m) => m[1]).filter((n) => n !== "uFlatTerrain");
    const produced = Object.keys(shoreUniformDefaults());
    expect(new Set(produced)).toEqual(new Set(declared));
  });
});
