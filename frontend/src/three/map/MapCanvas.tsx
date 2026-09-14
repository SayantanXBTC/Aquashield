import { createElement, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
import { buildModelMatrix, createMapMatrixTap, type MapMatrixRef } from "./threeMapLayer";

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MATRIX_TAP_LAYER_ID = "aquashield-matrix-tap";
const BUILDINGS_LAYER_ID = "aquashield-3d-buildings";

interface MapHazardContentProps {
  kind: HazardKind | null;
  originKm: [number, number];
  headingDeg: number;
  coastDistanceKm: number | null;
  getSnapshot: () => HazardSnapshot | null;
}

/** Drives the overlay camera from the map's own projection matrix, so the
 * scene sits on the earth wherever the user pans, zooms, pitches or rotates.
 * The technique needs an identity view matrix — every transform lives in the
 * map matrix combined with the anchor's model matrix. */
function MapCameraSync({ anchor, matrixRef }: { anchor: GeoAnchor; matrixRef: MapMatrixRef }) {
  const camera = useThree((s) => s.camera);
  const model = useMemo(() => buildModelMatrix(anchor), [anchor]);

  useEffect(() => {
    camera.matrixAutoUpdate = false;
    camera.matrixWorld.identity();
    camera.matrixWorldInverse.identity();
  }, [camera]);

  useFrame(() => {
    const mapMatrix = matrixRef.current;
    if (!mapMatrix) return;
    camera.projectionMatrix.fromArray(Array.from(mapMatrix)).multiply(model);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.matrixWorld.identity();
    camera.matrixWorldInverse.identity();
  });

  return null;
}

/** The subset of SceneRoot's composition this profile renders: no procedural
 * terrain/water/forest — the basemap supplies land and sea — just the
 * hazard itself, plus the same origin/heading markers every profile shows. */
/** R3F re-applies its own clear state after onCreated, which leaves this
 * canvas opaque and hides the basemap underneath. Enforcing it from inside
 * the tree runs after that setup. */
function TransparentClear() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.background = null;
    gl.setClearColor(0x000000, 0);
    gl.setClearAlpha(0);
  }, [gl, scene]);
  return null;
}

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
          paint over the basemap showing through this transparent canvas. */}
      <HeadingGuide originKm={originKm} landfallKm={landfallKm} fallbackEndKm={fallbackEndKm} />
      {/* The overlay canvas takes no pointer events (they belong to
          MapLibre's pan/rotate), so the pin orients rather than drags here. */}
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
 * coastline, real 3D buildings) with the existing Three.js hazard scene
 * aligned on top.
 *
 * Two stacked canvases, each owning its own WebGL context: MapLibre's, and a
 * transparent R3F one above it. They stay locked together because the scene
 * camera is driven by the map's own per-frame projection matrix. Sharing one
 * canvas between the two renderers was tried first and left the map blank —
 * both cache GL state and neither tolerates the other mutating it.
 *
 * The root must be absolutely positioned, not `h-full`: every child here is
 * absolute, so in normal flow the element collapses to zero height and
 * MapLibre silently falls back to a 300px canvas and never finishes loading.
 */
export function MapCanvas({ kind, originKm, headingDeg, coastDistanceKm, getSnapshot, anchor }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const matrixRef = useRef<ArrayLike<number> | null>(null);
  const [contextLost, setContextLost] = useState(false);
  // TEMPORARY: on-screen probe while the viewport renders black. Three
  // different renderer arrangements all went blank, which rules the overlay
  // out and points at the basemap itself, so this reports what the map
  // actually has: canvas size, GL liveness, load state, tile errors.
  const [diag, setDiag] = useState<string[]>([]);

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
    // stops painting — and browsers cap how many live contexts a page may
    // hold, so this is worth naming rather than debugging as "blank map".
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

    const errors: string[] = [];
    map.on("error", (ev) => {
      const message = (ev as unknown as { error?: { message?: string } }).error?.message ?? "unknown";
      if (errors.length < 3 && !errors.includes(message)) errors.push(message);
    });

    const probe = window.setInterval(() => {
      const rect = container.getBoundingClientRect();
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const canvases = Array.from(container.parentElement?.querySelectorAll("canvas") ?? []);
      // The overlay is whichever canvas is not the map's. Its context alpha
      // is the one thing that decides whether it hides the map underneath.
      const over = canvases.find((c) => c !== canvas);
      const overGl = over ? ((over.getContext("webgl2") ?? over.getContext("webgl")) as WebGLRenderingContext | null) : null;
      setDiag([
        `container ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        `map canvas ${canvas.width}x${canvas.height} css ${canvas.clientWidth}x${canvas.clientHeight}`,
        `gl ${gl ? (gl.isContextLost() ? "LOST" : "live") : "none"}`,
        `loaded ${map.loaded()} style ${map.isStyleLoaded()} matrix ${matrixRef.current ? "yes" : "no"}`,
        `canvases ${canvases.length} overlay ${over ? `${over.width}x${over.height} alpha ${overGl ? String(overGl.getContextAttributes()?.alpha) : "no-ctx"}` : "none"}`,
        errors.length ? `err ${errors.join(" | ")}` : "err none",
      ]);
    }, 700);

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
      if (!map.getLayer(MATRIX_TAP_LAYER_ID)) {
        map.addLayer(createMapMatrixTap(MATRIX_TAP_LAYER_ID, matrixRef));
      }
    });

    return () => {
      matrixRef.current = null;
      window.clearInterval(probe);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      map.remove();
    };
    // The anchor is baked into the model matrix; changing it recreates the
    // map rather than rescaling that matrix in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.lat, anchor.lon]);

  return (
    <div className="absolute inset-0">
      {/* Inline style, not a class: MapLibre stamps `maplibregl-map` on its
          container, and that rule sets `position: relative`. It has the same
          specificity as Tailwind's `absolute` but lands later in the cascade,
          so the element falls out of absolute positioning, takes height:auto
          over no in-flow content, and measures Nx0. MapLibre then sizes its
          canvas to the 300px default and paints a map nobody can see. An
          inline style outranks both classes. */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
            <div className="pointer-events-none absolute inset-0">
        <Canvas
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          camera={{ manual: true }}
          style={{ background: "transparent" }}
          onCreated={({ gl }) => {
            // Must clear fully transparent: this canvas sits over the
            // basemap and any alpha here hides the map.
            gl.setClearColor(0x000000, 0);
            gl.setClearAlpha(0);
          }}
        >
          <TransparentClear />
          <MapCameraSync anchor={anchor} matrixRef={matrixRef} />
          <MapHazardContent kind={kind} originKm={originKm} headingDeg={headingDeg} coastDistanceKm={coastDistanceKm} getSnapshot={getSnapshot} />
        </Canvas>
      </div>
      {contextLost ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[6px] border border-amber-400/50 bg-[rgba(20,14,4,0.9)] px-4 py-2 text-[12px] text-amber-200">
          WebGL context lost — reload the page to restore the map.
        </div>
      ) : null}
      {/* TEMPORARY probe — removed once the basemap renders. */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 rounded-[6px] border border-cyan-400/40 bg-[rgba(4,12,18,0.92)] px-3 py-2 font-mono text-[11px] leading-relaxed text-cyan-200">
        {diag.length ? diag.map((line) => <div key={line}>{line}</div>) : <div>probing…</div>}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] border border-white/[0.08] bg-[rgba(9,14,20,0.72)] px-3 py-1.5 text-[10px] tracking-[0.08em] text-white/70 backdrop-blur-xl">
        Real basemap — simplified demonstration hazard model, not an operational forecast
      </div>
    </div>
  );
}

export default MapCanvas;
