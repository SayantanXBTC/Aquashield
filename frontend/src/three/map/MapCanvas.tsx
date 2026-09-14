import { createElement, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { WebGLRenderer } from "three";
import { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { headingVector } from "@/propagation/world";
import { LightingSystem } from "@/three/core/LightingSystem";
import { getDisasterVisualizer } from "@/three/disasters/registry";
import { clearHazardChannel } from "@/three/hazard/hazardChannel";
import { HeadingGuide } from "@/three/markers/HeadingGuide";
import { OriginPin } from "@/three/markers/OriginPin";
import type { GeoAnchor } from "./geoAnchor";
import { buildModelMatrix, createThreeMapLayer, type SceneRenderRef } from "./threeMapLayer";

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const THREE_LAYER_ID = "aquashield-three-overlay";
const BUILDINGS_LAYER_ID = "aquashield-3d-buildings";

/** What the scene needs from the map before it can build its renderer: the
 * map's canvas and the map's GL context, both owned by MapLibre. */
interface MapGpu {
  map: MaplibreMap;
  gl: WebGL2RenderingContext | WebGLRenderingContext;
}

interface MapHazardContentProps {
  kind: HazardKind | null;
  originKm: [number, number];
  headingDeg: number;
  coastDistanceKm: number | null;
  getSnapshot: () => HazardSnapshot | null;
}

/**
 * Drives the scene from inside MapLibre's render pass.
 *
 * The camera takes the map's own projection matrix, so the scene sits on the
 * earth wherever the user pans, zooms, pitches or rotates. The technique needs
 * an identity view matrix — every transform lives in the map matrix combined
 * with the anchor's model matrix.
 *
 * `resetState()` before each draw is mandatory: Three and MapLibre share one
 * context and each caches GL state the other changes.
 */
function MapSceneBridge({ anchor, gpu, renderRef }: { anchor: GeoAnchor; gpu: MapGpu; renderRef: SceneRenderRef }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const advance = useThree((s) => s.advance);
  const model = useMemo(() => buildModelMatrix(anchor), [anchor]);

  useEffect(() => {
    // Never clear: the basemap has already drawn into this framebuffer.
    gl.autoClear = false;
    scene.background = null;
    camera.matrixAutoUpdate = false;
    camera.matrixWorld.identity();
    camera.matrixWorldInverse.identity();

    const canvas = gpu.map.getCanvas();
    renderRef.current = (matrix) => {
      camera.projectionMatrix.fromArray(Array.from(matrix)).multiply(model);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.matrixWorld.identity();
      camera.matrixWorldInverse.identity();
      gl.resetState();
      // setSize is neutered (MapLibre owns the canvas), so the viewport has to
      // come from the canvas itself. Its width/height are already device
      // pixels, and the renderer's pixel ratio stays 1 for that reason.
      gl.setViewport(0, 0, canvas.width, canvas.height);
      gl.setScissorTest(false);
      // R3F's loop is "never": this is the only thing that runs useFrame
      // subscribers and draws, and it runs inside MapLibre's own frame.
      advance(performance.now());
    };
    return () => {
      renderRef.current = null;
    };
  }, [gl, camera, scene, advance, model, gpu, renderRef]);

  return null;
}

/** The subset of SceneRoot's composition this profile renders: no procedural
 * terrain/water/forest — the basemap supplies land and sea — just the
 * hazard itself, plus the same origin/heading markers every profile shows. */
function MapHazardContent({ kind, originKm, headingDeg, coastDistanceKm, getSnapshot }: MapHazardContentProps) {
  const Visualizer = getDisasterVisualizer(kind);

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

  return (
    <Suspense fallback={null}>
      <LightingSystem />
      {/* No EnvironmentSystem/Sky: its dome is an opaque backdrop that would
          paint over the basemap this scene draws on top of. */}
      <HeadingGuide originKm={originKm} landfallKm={landfallKm} fallbackEndKm={fallbackEndKm} />
      {/* Pointer events belong to MapLibre's pan/rotate, so the pin orients
          rather than drags here. */}
      <OriginPin originKm={originKm} onDrag={() => {}} onDragEnd={() => {}} disabled />
      {/* createElement, not JSX: Visualizer is a stable module-level
          component resolved from the registry, not one created in render
          (same convention as SceneRoot.tsx). */}
      {Visualizer ? createElement(Visualizer, { getSnapshot }) : null}
    </Suspense>
  );
}

export interface MapCanvasProps extends MapHazardContentProps {
  anchor: GeoAnchor;
}

/**
 * The "real_map" world profile's viewport: a real MapLibre basemap (real
 * coastline, real 3D buildings) with the existing Three.js hazard scene drawn
 * into the same canvas.
 *
 * One WebGL context for both renderers. R3F still owns the scene graph, but
 * its renderer is built on MapLibre's canvas and context, its frameloop is
 * "never", and MapSceneBridge draws it from inside MapLibre's render pass.
 * R3F's own <canvas> element stays blank and unused — it exists only because
 * <Canvas> creates one.
 *
 * The root must be absolutely positioned, not `h-full`: every child here is
 * absolute, so in normal flow the element collapses to zero height and
 * MapLibre silently falls back to a 300px canvas and never finishes loading.
 */
export function MapCanvas({ kind, originKm, headingDeg, coastDistanceKm, getSnapshot, anchor }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderRef = useRef<((matrix: ArrayLike<number>) => void) | null>(null);
  const [gpu, setGpu] = useState<MapGpu | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MaplibreMap({
      container,
      style: OPENFREEMAP_STYLE_URL,
      center: [anchor.lon, anchor.lat],
      zoom: 13,
      pitch: 60,
      bearing: -20,
    });

    // A lost context is silent on MapLibre's own error channel — the map just
    // stops painting — so it is worth naming rather than debugging as "blank
    // map". Sharing one context with Three.js is what keeps this rare.
    const canvas = map.getCanvas();
    const onLost = (ev: Event) => {
      ev.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    // The container is sized by its parent, which can settle after MapLibre
    // first measures it.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    map.on("load", () => {
      // Liberty ships its own building extrusion; an explicit layer keeps the
      // height fallback (and any future exposure-driven styling) in code this
      // project owns rather than upstream style internals.
      if (!map.getLayer(BUILDINGS_LAYER_ID)) {
        map.addLayer({
          id: BUILDINGS_LAYER_ID,
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "#9aa5b1",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 6],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.85,
          },
        });
      }
      if (!map.getLayer(THREE_LAYER_ID)) {
        map.addLayer(
          createThreeMapLayer(THREE_LAYER_ID, {
            onContext: (mapInstance, gl) => setGpu({ map: mapInstance, gl }),
            renderRef,
          }),
        );
      }
    });

    return () => {
      renderRef.current = null;
      setGpu(null);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      map.remove();
    };
    // The anchor is baked into the model matrix; changing it recreates the
    // map rather than rescaling that matrix in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.lat, anchor.lon]);

  /** Build the scene's renderer on the map's canvas and context instead of a
   * second one. setSize/setPixelRatio/forceContextLoss are neutered because
   * MapLibre owns the canvas and its context — R3F calls all three on resize
   * and unmount, and any of them would resize or destroy the map. */
  const makeRenderer = useCallback(() => {
    if (!gpu) throw new Error("map GL context not ready");
    const renderer = new WebGLRenderer({ canvas: gpu.map.getCanvas(), context: gpu.gl, antialias: true });
    renderer.autoClear = false;
    renderer.setPixelRatio(1);
    renderer.setSize = () => {};
    renderer.setPixelRatio = () => {};
    renderer.forceContextLoss = () => {};
    return renderer;
  }, [gpu]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {gpu ? (
        <div className="pointer-events-none absolute inset-0">
          <Canvas frameloop="never" gl={makeRenderer} camera={{ manual: true }}>
            <MapSceneBridge anchor={anchor} gpu={gpu} renderRef={renderRef} />
            <MapHazardContent kind={kind} originKm={originKm} headingDeg={headingDeg} coastDistanceKm={coastDistanceKm} getSnapshot={getSnapshot} />
          </Canvas>
        </div>
      ) : null}
      {contextLost ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[6px] border border-amber-400/50 bg-[rgba(20,14,4,0.9)] px-4 py-2 text-[12px] text-amber-200">
          WebGL context lost — reload the page to restore the map.
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] border border-white/[0.08] bg-[rgba(9,14,20,0.72)] px-3 py-1.5 text-[10px] tracking-[0.08em] text-white/70 backdrop-blur-xl">
        Real basemap — simplified demonstration hazard model, not an operational forecast
      </div>
    </div>
  );
}

export default MapCanvas;
