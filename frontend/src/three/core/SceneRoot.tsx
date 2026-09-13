import { createElement, Suspense, useEffect, useMemo } from "react";
import type { WorldProfile } from "@shared/types";
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
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { headingVector } from "@/propagation/world";
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
   * a generic instanced building field. */
  worldProfile?: WorldProfile;
}

/** Fallback framing radius in scene units when nothing is placed. */
const DEFAULT_FRAME_RADIUS = 95;
const MIN_FRAME_RADIUS = 55;

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
}: SceneRootProps) {
  const Visualizer = getDisasterVisualizer(kind);
  const dense = worldProfile === "dense_coastal";

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

  const { focus, frameRadius } = useMemo(() => {
    const [ox, oz] = kmToScene(originKm[0], originKm[1]);
    if (!landfallKm) return { focus: [ox, 0, oz] as [number, number, number], frameRadius: DEFAULT_FRAME_RADIUS };
    const [lx, lz] = kmToScene(landfallKm[0], landfallKm[1]);
    // Bias the shot toward the landfall point (where the structures are)
    // and frame a little tighter than the full origin→coast segment.
    const radius = Math.max(MIN_FRAME_RADIUS, kmToSceneUnits(coastDistanceKm ?? 0) * 0.5);
    return { focus: [ox + (lx - ox) * 0.62, 0, oz + (lz - oz) * 0.62] as [number, number, number], frameRadius: radius };
  }, [originKm, landfallKm, coastDistanceKm]);

  return (
    <Suspense fallback={null}>
      <EnvironmentSystem />
      <LightingSystem />
      <CameraController focus={focus} frameRadius={frameRadius} entrance={entrance} onEntranceComplete={onEntranceComplete} />

      <WaterSurface worldProfile={worldProfile} />
      <ShorelineTerrain worldProfile={worldProfile} />
      {dense ? (
        // Dense Coastal Profile: a generic, fictional instanced building
        // field replaces the forest (three/urban/DenseBuildingLayer.tsx).
        <DenseBuildingLayer structures={structures?.structures} getSnapshot={getSnapshot} />
      ) : (
        // Scenery on the land plate — planted by the same noise the terrain
        // material paints its forest with, cleared around placed structures.
        <ForestLayer structures={structures?.structures} />
      )}

      <HeadingGuide originKm={originKm} landfallKm={landfallKm} fallbackEndKm={fallbackEndKm} />
      <OriginPin originKm={originKm} onDrag={onOriginDrag} onDragEnd={onOriginDragEnd} disabled={originLocked} />

      {structures ? <StructureLayer {...structures} getSnapshot={getSnapshot} flat={dense} /> : null}

      {/* createElement, not JSX: the visualizer is a stable module-level
          component resolved from the registry, not one created in render. */}
      {Visualizer ? createElement(Visualizer, { getSnapshot }) : null}
    </Suspense>
  );
}
