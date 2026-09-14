/**
 * Bridges the existing Three.js/R3F scene graph into a MapLibre custom
 * layer, camera-synced to a real basemap (the "real_map" world profile).
 * This is the one place in the app a Three.js scene is driven outside
 * <AquaCanvas>'s single <Canvas> — see MapCanvas.tsx for why that still
 * leaves exactly one Three.js renderer alive at a time.
 *
 * Standard MapLibre/Mapbox "three.js custom layer" technique: the map
 * supplies a mercator projection matrix each frame; a model matrix
 * (translate to the anchor, scale km -> mercator units) is folded into it
 * and set as the camera's projectionMatrix, so scene content stays in the
 * simulation's own km coordinates and MapLibre places it on the earth.
 *
 * The existing scene graph (hazard visualizers, OriginPin, HeadingGuide) is
 * built from ordinary R3F components using useFrame/hooks, so it must run
 * inside a real R3F reconciler root — not raw imperative three.js. R3F's
 * `createRoot`/`advance` (its documented <Canvas>-less API) mounts that
 * exact component tree onto the renderer this layer shares with MapLibre.
 */
import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type MapLibreMap } from "maplibre-gl";
import { advance, createRoot, type ReconcilerRoot, type RootStore } from "@react-three/fiber";
import type { ReactNode } from "react";
import type { GeoAnchor } from "./geoAnchor";

const KM_TO_M = 1000;

/**
 * Scene content here is Y-up (x=east, y=up, z=south — three/world/demoWorld.ts's
 * convention). MapLibre's 3D custom-layer frame treats its third mercator
 * axis as altitude/up, with x=east and y=south planar. Swapping Y and Z (a
 * 90 degree rotation about X) is what aligns the two frames; nothing else
 * in the existing scene graph needs to change.
 */
function buildModelMatrix(anchor: GeoAnchor): THREE.Matrix4 {
  const anchorMercator = MercatorCoordinate.fromLngLat({ lng: anchor.lon, lat: anchor.lat }, 0);
  const kmScale = anchorMercator.meterInMercatorCoordinateUnits() * KM_TO_M;
  return new THREE.Matrix4()
    .makeTranslation(anchorMercator.x, anchorMercator.y, anchorMercator.z)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeScale(kmScale, kmScale, kmScale));
}

export interface ThreeMapLayerHandle extends CustomLayerInterface {
  /** Re-renders the R3F tree hosted by this layer — call whenever the
   * hazard/origin/heading props change, the same way a normal React
   * re-render would update SceneRoot's children. */
  setContent(element: ReactNode): void;
}

export function createThreeMapLayer(id: string, anchor: GeoAnchor): ThreeMapLayerHandle {
  let map: MapLibreMap | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let modelMatrix: THREE.Matrix4 | null = null;
  let store: RootStore | null = null;
  let fiberRoot: ReconcilerRoot<HTMLCanvasElement> | null = null;
  let pendingContent: ReactNode = null;

  const handle: ThreeMapLayerHandle = {
    id,
    type: "custom",
    renderingMode: "3d",

    onAdd(mapInstance: MapLibreMap, gl: WebGL2RenderingContext) {
      map = mapInstance;
      scene = new THREE.Scene();
      modelMatrix = buildModelMatrix(anchor);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl });
      renderer.autoClear = false;

      const root = createRoot(map.getCanvas());
      void root.configure({ gl: renderer, scene, camera: { manual: true }, frameloop: "never", events: undefined }).then((configured) => {
        fiberRoot = configured;
        store = configured.render(pendingContent);
        // The mercator custom-layer technique assumes an identity view
        // matrix — every transform lives in the map-supplied projection
        // matrix combined with modelMatrix above. R3F's default camera
        // starts at z=5 looking at the origin; nothing in this scene's
        // content moves it (no CameraController is rendered here), so it's
        // safe to zero it once and leave it.
        const camera = store.getState().camera;
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
      });
    },

    render(_gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
      if (!renderer || !scene || !modelMatrix || !store) return;
      const mapMatrix = new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix);
      store.getState().camera.projectionMatrix = mapMatrix.multiply(modelMatrix);
      // MapLibre and this renderer share one WebGL context; each caches its
      // own notion of GL state, so it must be reset before every draw.
      renderer.resetState();
      advance(performance.now() / 1000, true, store.getState());
      // The hazard visualizers, water/particle shaders etc. animate
      // continuously (the same "always" frameloop AquaCanvas uses) — a
      // custom layer only redraws on request, so it must keep asking.
      map?.triggerRepaint();
    },

    onRemove() {
      // Deliberately NOT calling the R3F root's own unmount: its cleanup
      // path calls gl.forceContextLoss() on this shared context, which
      // would take MapLibre's own rendering down with it too. Disposing the
      // renderer alone releases its GPU resources without touching the
      // context; the map (and the context) is torn down by MapCanvas's own
      // cleanup, which is the right owner for that.
      renderer?.dispose();
      renderer = null;
      scene = null;
      store = null;
      fiberRoot = null;
      map = null;
    },

    setContent(element: ReactNode) {
      pendingContent = element;
      // Before onAdd's async configure() resolves there is no root to
      // render into yet; the .then() above picks up pendingContent then.
      if (fiberRoot) store = fiberRoot.render(element);
    },
  };

  return handle;
}
