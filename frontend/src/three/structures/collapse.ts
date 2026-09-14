/**
 * Illustrative structural response — how a placed structure is DRAWN as the
 * deterministic exposure band rises.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * AQUASHIELD has no damage model, no fragility curve and no casualty model,
 * and CLAUDE.md §25/§26a forbid presenting exposure as damage. Exposure is a
 * SIMPLIFIED DEMONSTRATION band meaning "potentially exposed". What this
 * module does is render that band legibly at a glance — a structure that is
 * deep inside the hazard footprint leans, sheds pieces and finally settles
 * into rubble, so an operator can see the footprint's reach on the model
 * instead of reading four status colours.
 *
 * Three properties keep that honest and must be preserved:
 *
 *  1. **Nothing is computed here that anything else reads.** The output is a
 *     rotation and a position. No number leaves this file. Exposure comes
 *     from `propagation/structures.ts` (the mirror of the Python rules) and
 *     is never modified.
 *  2. **It is a pure function of the current exposure.** No accumulation, no
 *     memory of "already collapsed". Scrub the timeline backwards and the
 *     structure stands back up, because the frame it is showing is a frame in
 *     which the hazard had not reached it. A structure that stayed collapsed
 *     would be asserting a permanent outcome the simulation never produced.
 *  3. **Only the `severe` band collapses.** The thresholds come from
 *     `propagation/structures.ts`, so the visual and the reported status can
 *     never disagree: lean begins at `at_risk`, pieces begin to fail inside
 *     `severe`, and nothing at all happens while a structure reads `clear`.
 *
 * The UI says so as well (StructuresPanel's note) — the picture must never be
 * the only thing telling the operator this is illustrative.
 */
import type { Object3D } from "three";
import type { HazardKind } from "@/propagation/hazards";
import { EXPOSURE_AT_RISK, EXPOSURE_CLEAR, EXPOSURE_IMPACTED } from "@/propagation/structures";
import { hash01 } from "./support";

export interface DamageState {
  /** Exposure 0-1 straight from the propagation mirror. */
  exposure: number;
  kind: HazardKind | null;
  /** Eased 0-1 structural-failure illustration. Pure function of exposure. */
  collapse: number;
  /** 0-1 lean/stress illustration below the collapse band. */
  stress: number;
  /** Seconds, for shake and settle animation. */
  time: number;
  /** Which way the hazard is travelling, in the MODEL's local frame
   * (radians). Pieces topple with the flow rather than in random directions,
   * so a wave reads as having pushed them over. */
  flowHeading: number;
}

export function createDamageState(): DamageState {
  return { exposure: 0, kind: null, collapse: 0, stress: 0, time: 0, flowHeading: 0 };
}

/** How much of the failure illustration the `impacted` band is worth. The
 * remainder belongs to `severe`, so the two bands stay distinguishable at a
 * glance: `impacted` breaks a structure up, `severe` flattens it. */
const IMPACTED_SHARE = 0.72;

/**
 * How far into structural failure the drawing goes, mapped onto the exposure
 * bands `propagation/structures.ts` defines:
 *
 *   clear .. at_risk   nothing (lean only, see stressTarget)
 *   at_risk .. impacted  0 -> IMPACTED_SHARE — pieces begin to fail
 *   impacted .. 1        IMPACTED_SHARE -> 1 — the structure comes down
 *
 * The bands, not a threshold of this module's own invention, are what decide
 * this — so the model and the reported status can never disagree.
 *
 * The ramp inside a band is deliberately front-loaded (`pow(t, 0.65)`).
 * Real scenarios spend most of their time in the middle of a band: a demo
 * tsunami peaks around 0.47 exposure and a cyclone around 0.66, both inside
 * `impacted`. A linear ramp left those looking untouched, which read as "the
 * hazard passed straight through" rather than "this is deep in the
 * footprint".
 */
export function collapseTarget(exposure: number, kind: HazardKind | null): number {
  if (kind === null) return 0;
  // An oil slick coats a structure; it does not knock it down.
  if (kind === "oil_spill") return 0;
  if (exposure <= EXPOSURE_AT_RISK) return 0;
  if (exposure < EXPOSURE_IMPACTED) {
    const t = (exposure - EXPOSURE_AT_RISK) / (EXPOSURE_IMPACTED - EXPOSURE_AT_RISK);
    return IMPACTED_SHARE * Math.pow(t, 0.65);
  }
  const t = (exposure - EXPOSURE_IMPACTED) / (1 - EXPOSURE_IMPACTED);
  return IMPACTED_SHARE + (1 - IMPACTED_SHARE) * Math.min(1, Math.pow(t, 0.65));
}

/** Lean/stress before anything fails — the `at_risk` band. */
export function stressTarget(exposure: number, kind: HazardKind | null): number {
  if (kind === null || exposure <= EXPOSURE_CLEAR) return 0;
  return Math.max(0, Math.min(1, (exposure - EXPOSURE_CLEAR) / (EXPOSURE_AT_RISK - EXPOSURE_CLEAR)));
}

/** Eases the drawn state toward the current frame's exposure. Reversible by
 * construction: scrubbing back lowers the target and the structure recovers. */
export function updateDamageState(
  state: DamageState,
  exposure: number,
  kind: HazardKind | null,
  delta: number,
  elapsed: number,
  flowHeading = 0,
): void {
  state.exposure = exposure;
  state.kind = kind;
  state.time = elapsed;
  state.flowHeading = flowHeading;
  const k = Math.min(1, delta * 3.2);
  state.collapse += (collapseTarget(exposure, kind) - state.collapse) * k;
  state.stress += (stressTarget(exposure, kind) - state.stress) * k;
}

/** Deterministic failure parameters for one piece of a model. */
export interface PieceFailure {
  /** Fraction of the collapse ramp this piece survives before it starts. */
  delay: number;
  /** Direction it falls, radians in the model's local XZ plane. */
  heading: number;
  /** Maximum topple angle, radians. */
  topple: number;
  /** How far it sinks into its own footprint at full failure. */
  sink: number;
  /** Twist as it goes. */
  twist: number;
}

/** Stable per-piece failure parameters — same structure id, same collapse,
 * every session and every replay of the same frame. */
export function pieceFailure(seed: string, index: number): PieceFailure {
  const a = hash01(seed, index * 31 + 5);
  const b = hash01(seed, index * 17 + 11);
  const c = hash01(seed, index * 43 + 23);
  return {
    // Short, overlapping delays: a structure should visibly come apart while
    // it is in the footprint, not hold rigid until the very end of the ramp.
    delay: a * 0.32,
    heading: b * Math.PI * 2,
    topple: 0.75 + c * 0.95,
    sink: 0.3 + a * 0.45,
    twist: (b - 0.5) * 1.1,
  };
}

/**
 * Draws one piece at the given structural state. `baseY` is the piece's
 * standing height above the structure's origin, used so a toppling piece
 * pivots about its foot rather than its centre.
 */
export function applyPieceFailure(object: Object3D, failure: PieceFailure, state: DamageState, baseY: number): void {
  const raw = (state.collapse - failure.delay) / Math.max(0.05, 1 - failure.delay);
  const progress = Math.max(0, Math.min(1, raw));
  // Mildly eased, not quadratic: a square left everything upright until the
  // very top of the ramp, where exposure rarely reaches.
  const fall = Math.pow(progress, 1.35);

  const windShake = state.kind === "cyclone" ? Math.sin(state.time * 19 + failure.heading) * 0.02 * state.stress : 0;
  const lean = state.stress * 0.05;

  // Topple downstream, with a per-piece spread — pieces knocked over by a
  // wave or a wind field do not scatter in random directions.
  const spread = (failure.heading / (Math.PI * 2) - 0.5) * 0.9;
  const heading = state.flowHeading + spread;
  const angle = fall * failure.topple + lean;
  object.rotation.x = Math.cos(heading) * angle + windShake;
  object.rotation.z = Math.sin(heading) * angle + windShake * 0.7;
  object.rotation.y = fall * failure.twist;
  object.position.y = -fall * failure.sink * Math.max(0.2, baseY);
  // Crumble: a failing piece loses height as it goes, so a toppled tower
  // reads as broken rather than as a model that was simply tipped over.
  object.scale.y = 1 - 0.4 * fall;
}
