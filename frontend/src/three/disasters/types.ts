import type { ComponentType } from "react";
import type { SimulationVisualState } from "../adapters/simulationVisualAdapter";
import type { LatLon } from "../utils/geoProjection";

export interface DisasterVisualizerProps {
  visualState: SimulationVisualState;
  /** The scenario's own location — the origin every lat/lon is projected
   * relative to (see three/utils/geoProjection.ts). */
  origin: LatLon;
}

export type DisasterVisualizerComponent = ComponentType<DisasterVisualizerProps>;
