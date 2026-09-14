/**
 * The GLSL twin is compiled by the GPU, not by Vitest, so what is testable
 * here is that the uniform contract is complete and consistent: every
 * uniform the shader source declares is produced by shoreUniformDefaults,
 * and the sign it carries matches the ShoreParams it came from.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_SHORE, type ShoreParams } from "@/propagation/world";
import { DEMO_WORLD_GLSL, shoreUniformDefaults } from "./demoWorld";
import { landFieldUniformDefaults } from "./landField";

// The three materials that inject DEMO_WORLD_GLSL and must initialize every
// shore uniform it declares (water.ts's fragment/vertex shaders are plain
// GLSL strings, not a separate uniform-setting call site — waterMaterial.ts
// is the one place that sets its uniforms). Paths are relative to this file.
const CONSUMING_MATERIALS = [
  "../terrain/terrainMaterial.ts",
  "../water/waterMaterial.ts",
  "../vegetation/forestMaterial.ts",
];

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
    // uFlatTerrain and the land-field uniforms (below) are declared
    // alongside the shore uniforms but produced by their own functions.
    const nonShore = new Set(["uFlatTerrain", ...Object.keys(landFieldUniformDefaults()), "uLandFieldTex"]);
    const declared = [...DEMO_WORLD_GLSL.matchAll(/uniform \w+ (u\w+);/g)].map((m) => m[1]).filter((n) => !nonShore.has(n));
    const produced = Object.keys(shoreUniformDefaults());
    expect(new Set(produced)).toEqual(new Set(declared));
  });
});

describe("shore uniforms are set by every consuming material", () => {
  // Data-driven off shoreUniformDefaults()'s own keys, so a sixth shore
  // uniform added later fails this test for any material that forgets to
  // set it, instead of silently reading as 0 on the GPU (the forestMaterial
  // uLandSign regression this test was added to catch).
  const keys = Object.keys(shoreUniformDefaults());

  it.each(CONSUMING_MATERIALS)("%s assigns every shore uniform", (relPath) => {
    const source = readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), "utf-8");
    for (const key of keys) {
      expect(source).toMatch(new RegExp(`\\b${key}\\s*[:=]`));
    }
  });
});

describe("GLSL land field uniforms (ADR-009 rasterised coast)", () => {
  it("falls back to the sine curve when disabled or out of coverage", () => {
    expect(DEMO_WORLD_GLSL).toContain("if (uLandFieldEnabled > 0.5)");
    expect(DEMO_WORLD_GLSL).toContain("return uLandSign * (xKm - shoreX(yKm));");
  });

  it("samples with a texel-centred UV (nearest, not bilinear)", () => {
    expect(DEMO_WORLD_GLSL).toContain("(vec2(col, row) + 0.5) / uLandFieldResolution");
  });

  it("is disabled by default (undecorated ShoreParams)", () => {
    expect(landFieldUniformDefaults(DEFAULT_SHORE.landField).uLandFieldEnabled).toBe(0);
  });

  // Same rationale as the shore-uniform block above: a fourth material or a
  // seventh land-field uniform that forgets to bind it reads as an unbound
  // sampler / a silently-disabled field instead of failing loudly.
  const landFieldKeys = [...Object.keys(landFieldUniformDefaults()), "uLandFieldTex"];

  it.each(CONSUMING_MATERIALS)("%s assigns every land field uniform", (relPath) => {
    const source = readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), "utf-8");
    for (const key of landFieldKeys) {
      expect(source).toMatch(new RegExp(`\\b${key}\\s*[:=]`));
    }
  });
});
