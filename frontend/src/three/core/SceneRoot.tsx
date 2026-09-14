import { createElement, Suspense, useEffect, useMemo } from "react";
import type { TownProfile, WorldProfile } from "@shared/types";
import { getDisasterVisualizer } from "@/three/disasters/registry";
import { clearHazardChannel } from "@/three/hazard/hazardChannel";
import { HeadingGuide } from "@/three/markers/HeadingGuide";
import { OriginPin } from "@/three/markers/OriginPin";
import { StructureLayer, type StructureLayerProps } from "@/three/structures/StructureLayer";
import { ShorelineTerrain } from "@/three/terrain/ShorelineTerrain";
import { DenseBuildingLayer } from "@/three/urban/DenseBuildingLayer";
import { ForestLayer } from "@/three/vegetation/ForestLayer";
import { WaterSurface } from "@/three/water/WaterSurface";
import { kmToScene, kmToSceneUnits } from "@/three/world/demoWorld";
import { buildLandFieldTexture } from "@/three/world/landField";
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { DEFAULT_SHORE, headingVector, shoreParamsForTown, type ShoreParams } from "@/propagation/world";
import { CameraController } from "./CameraController";
import { EnvironmentSystem } from "./EnvironmentSystem";
import { LightingSystem } from "./LightingSystem";

export interface SceneRootProps {
  kind: HazardKind | null;
  originKm: [number, number];
  headingDeg: number;
  /** Along-heading distance to the coast from the origin, km (null = the
   * heading never reaches land). From the propagation mirror. */
  coastDistanceKm: number | null;
  getSnapshot: () => HazardSnapshot | null;
  onOriginDrag: (xKm: number, yKm: number) => void;
  onOriginDragEnd: () => void;
  originLocked?: boolean;
  entrance?: boolean;
  onEntranceComplete?: () => void;
  /** User-placed structures (Prompt 13). */
  structures?: Omit<StructureLayerProps, "getSnapshot">;
  /** A purely cosmetic 3D-rendering choice — never a real place (CLAUDE.md
   * §25/§27). "dense_coastal" flattens the terrain and swaps the forest for
   * a generic instanced building field; "real_city" is the ADR-009
   * exception — see `town`. */
  worldProfile?: WorldProfile;
  /** The curated real city's data (ADR-009), required when worldProfile is
   * "real_city". Its `shore_base_x_km`/`shore_terms` override the fictional
   * demo curve everywhere — terrain, water, buildings, structure grounding. */
  town?: TownProfile;
}

/** Fallback framing radius in scene units when nothing is placed. */
const DEFAULT_FRAME_RADIUS = 95;
const MIN_FRAME_RADIUS = 55;
/** A real city's footprint is a small fraction of the 300km world (CLAUDE.md
 * §27) — the camera frames the metro area, not the whole square. */
const REAL_CITY_FRAME_PAD = 1.6;
const REAL_CITY_MIN_HALF_SPAN_KM = 8;

/**
 * The scene graph every AQUASHIELD view shares: atmosphere, lighting, the
 * one shoreline world (water + terrain + forest), the draggable origin pin
 * with its heading guide, and — resolved from the registry by hazard kind —
 * the disaster visualizer. Nothing else in the app constructs a scene graph.
 *
 * Composition is decided here: the camera frames the segment from the
 * origin to the landfall point (or the origin alone when the heading misses
 * the coast). Visualizers never move the camera.
 */
export function SceneRoot({
  kind,
  originKm,
  headingDeg,
  coastDistanceKm,
  getSnapshot,
  onOriginDrag,
  onOriginDragEnd,
  originLocked = false,
  entrance = false,
  onEntranceComplete,
  structures,
  worldProfile,
  town,
}: SceneRootProps) {
  const Visualizer = getDisasterVisualizer(kind);
  const dense = worldProfile === "dense_coastal" || worldProfile === "real_city";
  const shore: ShoreParams = useMemo(
    () => (worldProfile === "real_city" && town ? shoreParamsForTown(town) : DEFAULT_SHORE),
    [worldProfile, town],
  );

  // The curated city's rasterised coast field (ADR-009) as a GPU texture —
  // built once per `shore.landField` and disposed on change/unmount so
  // WaterSurface and ShorelineTerrain always share the exact same texture
  // object (the single biggest risk here: only one of the two seeing the
  // field would tear the coastline).
  const landField = shore.landField;
  const landFieldTexture = useMemo(() => (landField ? buildLandFieldTexture(landField) : undefined), [landField]);
  useEffect(() => () => landFieldTexture?.dispose(), [landFieldTexture]);

  useEffect(() => {
    if (!Visualizer) clearHazardChannel();
    return () => clearHazardChannel();
  }, [Visualizer]);

  const landfallKm = useMemo<[number, number] | null>(() => {
    if (coastDistanceKm === null) return null;
    const [dx, dy] = headingVector(headingDeg);
    return [originKm[0] + dx * coastDistanceKm, originKm[1] + dy * coastDistanceKm];
  }, [originKm, headingDeg, coastDistanceKm]);

  const fallbackEndKm = useMemo<[number, number]>(() => {
    const [dx, dy] = headingVector(headingDeg);
    return [originKm[0] + dx * 120, originKm[1] + dy * 120];
  }, [originKm, headingDeg]);

  const townBoundsKm = useMemo(() => {
    if (!town || town.buildings.length === 0) return null;
    let minXKm = Infinity;
    let maxXKm = -Infinity;
    let minYKm = Infinity;
    let maxYKm = -Infinity;
    for (const b of town.buildings) {
      if (b.xKm < minXKm) minXKm = b.xKm;
      if (b.xKm > maxXKm) maxXKm = b.xKm;
      if (b.yKm < minYKm) minYKm = b.yKm;
      if (b.yKm > maxYKm) maxYKm = b.yKm;
    }
    return { minXKm, maxXKm, minYKm, maxYKm };
  }, [town]);

  const { focus, frameRadius } = useMemo(() => {
    if (worldProfile === "real_city" && townBoundsKm) {
      let { minXKm, maxXKm, minYKm, maxYKm } = townBoundsKm;
      if (landfallKm) {
        const centerXKm = (minXKm + maxXKm) / 2;
        const centerYKm = (minYKm + maxYKm) / 2;
        const spanKm = Math.max(maxXKm - minXKm, maxYKm - minYKm);
        const landfallDistKm = Math.hypot(landfallKm[0] - centerXKm, landfallKm[1] - centerYKm);
        // Only pull a nearby landfall into shot — a far-offshore origin must
        // not widen the frame back toward the whole world.
        if (landfallDistKm <= spanKm * 2) {
          minXKm = Math.min(minXKm, landfallKm[0]);
          maxXKm = Math.max(maxXKm, landfallKm[0]);
          minYKm = Math.min(minYKm, landfallKm[1]);
          maxYKm = Math.max(maxYKm, landfallKm[1]);
        }
      }
      const centerXKm = (minXKm + maxXKm) / 2;
      const centerYKm = (minYKm + maxYKm) / 2;
      const halfSpanKm = Math.max(REAL_CITY_MIN_HALF_SPAN_KM, Math.max(maxXKm - minXKm, maxYKm - minYKm) / 2);
      const [fx, fz] = kmToScene(centerXKm, centerYKm);
      return { focus: [fx, 0, fz] as [number, number, number], frameRadius: kmToSceneUnits(halfSpanKm) * REAL_CITY_FRAME_PAD };
    }
    const [ox, oz] = kmToScene(originKm[0], originKm[1]);
    if (!landfallKm) return { focus: [ox, 0, oz] as [number, number, number], frameRadius: DEFAULT_FRAME_RADIUS };
    const [lx, lz] = kmToScene(landfallKm[0], landfallKm[1]);
    // Bias the shot toward the landfall point (where the structures are)
    // and frame a little tighter than the full origin→coast segment.
    const radius = Math.max(MIN_FRAME_RADIUS, kmToSceneUnits(coastDistanceKm ?? 0) * 0.5);
    return { focus: [ox + (lx - ox) * 0.62, 0, oz + (lz - oz) * 0.62] as [number, number, number], frameRadius: radius };
  }, [worldProfile, townBoundsKm, originKm, landfallKm, coastDistanceKm]);

  return (
    <Suspense fallback={null}>
      <EnvironmentSystem />
      <LightingSystem />
      <CameraController focus={focus} frameRadius={frameRadius} entrance={entrance} onEntranceComplete={onEntranceComplete} />

      <WaterSurface worldProfile={worldProfile} shore={shore} landFieldTexture={landFieldTexture} />
      <ShorelineTerrain worldProfile={worldProfile} shore={shore} landFieldTexture={landFieldTexture} />
      {dense ? (
        // Dense Coastal Profile / real city: a generic (or real-footprint)
        // instanced building field replaces the forest
        // (three/urban/DenseBuildingLayer.tsx).
        <DenseBuildingLayer structures={structures?.structures} getSnapshot={getSnapshot} town={worldProfile === "real_city" ? town : undefined} shore={shore} />
      ) : (
        // Scenery on the land plate — planted by the same noise the terrain
        // material paints its forest with, cleared around placed structures.
        <ForestLayer structures={structures?.structures} />
      )}

      <HeadingGuide originKm={originKm} landfallKm={landfallKm} fallbackEndKm={fallbackEndKm} />
      <OriginPin originKm={originKm} onDrag={onOriginDrag} onDragEnd={onOriginDragEnd} disabled={originLocked} shore={shore} />

      {structures ? <StructureLayer {...structures} getSnapshot={getSnapshot} flat={dense} shoreParams={shore} /> : null}

      {/* createElement, not JSX: the visualizer is a stable module-level
          component resolved from the registry, not one created in render. */}
      {Visualizer ? createElement(Visualizer, { getSnapshot }) : null}
    </Suspense>
  );
}
