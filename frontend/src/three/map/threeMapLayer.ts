/**
 * Camera bridge between a MapLibre basemap and the existing Three.js scene
 * (the "real_map" world profile).
 *
 * MapLibre supplies a mercator projection matrix every frame. Folding a
 * model matrix into it (translate to the anchor, swap Y-up for mercator's
 * altitude-up, scale km -> mercator units) yields a camera projection that
 * places scene content, still expressed in the simulation's own kilometre
 * coordinates, correctly on the earth.
 *
 * The scene is NOT drawn into MapLibre's own canvas. An earlier attempt
 * shared the canvas and GL context via a custom layer that rendered
 * directly; both renderers then cached conflicting GL state and the map
 * stopped painting entirely. Instead this layer only TAPS the matrix and
 * draws nothing, while the scene renders in its own transparent canvas
 * stacked over the map. Each renderer owns its context, and the two stay
 * aligned because they share the same per-frame matrix.
 */
import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MapLibreMap } from "maplibre-gl";
import type { GeoAnchor } from "./geoAnchor";

const KM_TO_M = 1000;

/**
 * Scene content is Y-up (x=east, y=up, z=south — three/world/demoWorld.ts's
 * convention). MapLibre's mercator frame is x=east, y=SOUTH, z=altitude. So
 * the scene's y and z axes simply swap:
 *
 *   mercator.x = scene.x     (east)
 *   mercator.y = scene.z     (south)
 *   mercator.z = scene.y     (up)
 *
 * That swap is a REFLECTION, not a rotation — its determinant is -1 — so no
 * rotation can express it. A 90 degree rotation about X was used here first
 * and sends scene.z to NORTH instead of south, mirroring the whole scene
 * about the anchor's latitude: click 1 km north of the anchor and the origin
 * lands 1 km south of it, twice as far from the pointer as you meant, with
 * the error growing the further you click from the anchor.
 */
export function buildModelMatrix(anchor: GeoAnchor): THREE.Matrix4 {
  const anchorMercator = MercatorCoordinate.fromLngLat({ lng: anchor.lon, lat: anchor.lat }, 0);
  const kmScale = anchorMercator.meterInMercatorCoordinateUnits() * KM_TO_M;
  // Columns are the images of the scene's x, y and z axes, in that order.
  const axisSwap = new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
  );
  return new THREE.Matrix4()
    .makeTranslation(anchorMercator.x, anchorMercator.y, anchorMercator.z)
    .multiply(axisSwap)
    .multiply(new THREE.Matrix4().makeScale(kmScale, kmScale, kmScale));
}

/** Latest map projection matrix, or null before the first frame. Written by
 * the tap layer, read by the overlay canvas's camera each frame. */
export type MapMatrixRef = { current: ArrayLike<number> | null };

/**
 * A custom layer that renders nothing and exists only to observe MapLibre's
 * per-frame projection matrix. `repaint` keeps the map redrawing so the tap
 * keeps firing while the hazard shaders animate.
 */
export function createMapMatrixTap(id: string, matrixRef: MapMatrixRef, repaint = true): CustomLayerInterface {
  let map: MapLibreMap | null = null;
  return {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(mapInstance: MapLibreMap) {
      map = mapInstance;
    },
    render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
      matrixRef.current = options.defaultProjectionData.mainMatrix;
      if (repaint) map?.triggerRepaint();
    },
    onRemove() {
      map = null;
      matrixRef.current = null;
    },
  };
}
