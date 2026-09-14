/**
 * Camera + render bridge between a MapLibre basemap and the existing Three.js
 * scene (the "real_map" world profile).
 *
 * MapLibre supplies a mercator projection matrix every frame. Folding a model
 * matrix into it (translate to the anchor, swap Y-up for mercator's
 * altitude-up, scale km -> mercator units) yields a camera projection that
 * places scene content, still expressed in the simulation's own kilometre
 * coordinates, correctly on the earth.
 *
 * ONE WebGL context. The scene draws into MapLibre's own canvas through this
 * custom layer. Stacking a second canvas over the map was tried first: a page
 * that holds two contexts loses one of them whenever the browser's context
 * budget is reached, and the symptom is a silently black map rather than an
 * error. Sharing the context needs `renderer.resetState()` before every draw
 * (Three and MapLibre each cache GL state and neither expects the other to
 * change it) — the earlier shared-canvas attempt failed for want of exactly
 * that call.
 */
import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MapLibreMap } from "maplibre-gl";
import type { GeoAnchor } from "./geoAnchor";

const KM_TO_M = 1000;

/**
 * Scene content is Y-up (x=east, y=up, z=south — three/world/demoWorld.ts's
 * convention). MapLibre's 3D frame treats its third mercator axis as
 * altitude, with x=east and y=south planar. A 90 degree rotation about X
 * aligns the two; nothing in the existing scene graph changes.
 */
export function buildModelMatrix(anchor: GeoAnchor): THREE.Matrix4 {
  const anchorMercator = MercatorCoordinate.fromLngLat({ lng: anchor.lon, lat: anchor.lat }, 0);
  const kmScale = anchorMercator.meterInMercatorCoordinateUnits() * KM_TO_M;
  return new THREE.Matrix4()
    .makeTranslation(anchorMercator.x, anchorMercator.y, anchorMercator.z)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeScale(kmScale, kmScale, kmScale));
}

/** Set by the scene once its renderer exists; called by the layer on every
 * map frame with that frame's projection matrix. Null before the scene mounts
 * and after it unmounts — the layer simply draws nothing then. */
export type SceneRenderRef = { current: ((matrix: ArrayLike<number>) => void) | null };

export interface ThreeMapLayerHandlers {
  /** The map's own GL context, handed over once the layer is added. The scene
   * builds its renderer on this context rather than creating a second one. */
  onContext: (map: MapLibreMap, gl: WebGL2RenderingContext | WebGLRenderingContext) => void;
  renderRef: SceneRenderRef;
}

/**
 * A custom layer that hands MapLibre's GL context to the scene and calls it
 * back inside MapLibre's own render pass. `triggerRepaint` keeps the map
 * redrawing so the hazard shaders keep animating while nothing else moves.
 */
export function createThreeMapLayer(id: string, handlers: ThreeMapLayerHandlers): CustomLayerInterface {
  let map: MapLibreMap | null = null;
  return {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(mapInstance: MapLibreMap, gl: WebGL2RenderingContext | WebGLRenderingContext) {
      map = mapInstance;
      handlers.onContext(mapInstance, gl);
    },
    render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
      handlers.renderRef.current?.(options.defaultProjectionData.mainMatrix);
      map?.triggerRepaint();
    },
    onRemove() {
      map = null;
    },
  };
}
