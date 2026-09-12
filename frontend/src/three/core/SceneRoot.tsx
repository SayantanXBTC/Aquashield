import { createElement, Suspense } from "react";
import { getDisasterVisualizer } from "@/three/disasters/registry";
import { CoastlineLayer } from "@/three/geospatial/CoastlineLayer";
import { HazardFootprintLayer } from "@/three/geospatial/HazardFootprintLayer";
import { InfrastructureMarkers } from "@/three/geospatial/InfrastructureMarkers";
import { LocationMarker } from "@/three/markers/LocationMarker";
import { Landmass } from "@/three/terrain/Landmass";
import type { LatLon } from "@/three/utils/geoProjection";
import { WaterSurface } from "@/three/water/WaterSurface";
import type { SimulationVisualState } from "@/three/adapters/simulationVisualAdapter";
import type { ExposureResult, GeographicFeature, HazardFootprint } from "@/features/command-center/types";
import { CameraController } from "./CameraController";
import { EnvironmentSystem } from "./EnvironmentSystem";
import { LightingSystem } from "./LightingSystem";

interface DataLayersProps {
  hazardFootprint: HazardFootprint | null;
  exposureResults: ExposureResult[];
  showInfrastructure: boolean;
  showExposure: boolean;
  /** Real, previously-ingested geographic features (e.g. Natural Earth
   * coastline) near the scenario — see three/geospatial/CoastlineLayer.tsx. */
  coastlineFeatures: GeographicFeature[];
}

interface SceneRootProps {
  scenarioLocation: LatLon;
  scenarioName: string;
  visualState: SimulationVisualState | null;
  /** Prompt 10's optional geospatial overlays (hazard footprint outline +
   * infrastructure/exposure markers) — additive to the existing scene graph,
   * never rendered when absent (undefined is the "Data Layers panel doesn't
   * apply here yet" case, distinct from an empty/toggled-off layer). */
  dataLayers?: DataLayersProps;
}

/**
 * The scene graph every AQUASHIELD view shares: atmosphere, lighting,
 * water, a landmass, the scenario's own location marker, and — only when
 * simulation data is available — the disaster-specific visualizer resolved
 * from the registry. Nothing else in the app constructs a `<Canvas>`
 * scene graph by hand; this is the one place that does.
 */
export function SceneRoot({ scenarioLocation, scenarioName, visualState, dataLayers }: SceneRootProps) {
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

      {/* TWO HAZARD-VISUAL SYSTEMS DELIBERATELY COEXIST HERE (Prompt 10.1):
          (A) the per-disaster-type Visualizer above (HazardDisc/HazardRing
          etc., three/disasters/*), driven by simulationVisualAdapter's
          toVisualState(currentFrame) — a stylized, disaster-specific visual
          language (expanding disc for flood, rotating rings for cyclone,
          ...) that reads clearly at a glance regardless of real-world
          geometry, and (B) HazardFootprintLayer just below, driven by real
          GET /simulation-runs/{id}/hazard-footprints Polygon/Point geometry
          — the authoritative geographic footprint for this phase's
          hazard/exposure/impact panels. (A) is not removed: it's still the
          "read clearly" visual language earlier prompts established and
          other code may depend on it; (B) is what Data Layers/Impact panels
          and geospatial analysis actually reason about. See
          docs/geospatial/impact-visualization.md for the full rationale. */}
      {dataLayers?.hazardFootprint ? (
        <HazardFootprintLayer origin={scenarioLocation} footprint={dataLayers.hazardFootprint} />
      ) : null}
      {dataLayers && (dataLayers.showInfrastructure || dataLayers.showExposure) ? (
        <InfrastructureMarkers
          origin={scenarioLocation}
          assets={dataLayers.exposureResults}
          showAll={dataLayers.showInfrastructure}
          showExposureColor={dataLayers.showExposure}
        />
      ) : null}
      {dataLayers?.coastlineFeatures.length ? (
        <CoastlineLayer origin={scenarioLocation} features={dataLayers.coastlineFeatures} />
      ) : null}
    </Suspense>
  );
}
