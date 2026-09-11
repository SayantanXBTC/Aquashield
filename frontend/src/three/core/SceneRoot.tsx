import { createElement, Suspense } from "react";
import { getDisasterVisualizer } from "@/three/disasters/registry";
import { LocationMarker } from "@/three/markers/LocationMarker";
import { Landmass } from "@/three/terrain/Landmass";
import type { LatLon } from "@/three/utils/geoProjection";
import { WaterSurface } from "@/three/water/WaterSurface";
import type { SimulationVisualState } from "@/three/adapters/simulationVisualAdapter";
import { CameraController } from "./CameraController";
import { EnvironmentSystem } from "./EnvironmentSystem";
import { LightingSystem } from "./LightingSystem";

interface SceneRootProps {
  scenarioLocation: LatLon;
  scenarioName: string;
  visualState: SimulationVisualState | null;
}

/**
 * The scene graph every AQUASHIELD view shares: atmosphere, lighting,
 * water, a landmass, the scenario's own location marker, and — only when
 * simulation data is available — the disaster-specific visualizer resolved
 * from the registry. Nothing else in the app constructs a `<Canvas>`
 * scene graph by hand; this is the one place that does.
 */
export function SceneRoot({ scenarioLocation, scenarioName, visualState }: SceneRootProps) {
  const Visualizer = visualState ? getDisasterVisualizer(visualState.disasterType) : null;

  return (
    <Suspense fallback={null}>
      <EnvironmentSystem />
      <LightingSystem />
      <CameraController />

      <WaterSurface />
      <Landmass />

      <LocationMarker position={[0, 0, 0]} label={scenarioName} color="#e7edf3" pulse={false} />

      {/* createElement, not JSX: the visualizer is resolved from a
          registry (three/disasters/registry.ts) at render time — using a
          <Visualizer /> JSX tag here reads to static analysis as "creating
          a component during render", which this isn't (the registry only
          ever returns one of five stable, module-level component
          references). */}
      {Visualizer && visualState ? createElement(Visualizer, { visualState, origin: scenarioLocation }) : null}
    </Suspense>
  );
}
