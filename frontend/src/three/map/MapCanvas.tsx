import { createElement, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Map as MaplibreMap, Marker, NavigationControl, ScaleControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { headingVector } from "@/propagation/world";
import { LightingSystem } from "@/three/core/LightingSystem";
import { getDisasterVisualizer } from "@/three/disasters/registry";
import { clearHazardChannel } from "@/three/hazard/hazardChannel";
import { HeadingGuide } from "@/three/markers/HeadingGuide";
import { kmToLngLat, lngLatToKm, type GeoAnchor } from "./geoAnchor";
import { measureCoastDistanceKm, type CoastMeasurement } from "./mapCoast";
import { MapHazardFootprint } from "./MapHazardFootprint";
import { buildModelMatrix, createMapMatrixTap, type MapMatrixRef } from "./threeMapLayer";

/** Why the real coast could not be measured, in the operator's terms. A
 * measurement that cannot be made is said plainly — never a number from the
 * synthetic coastline standing in for the real one. */
const COAST_NOTE: Partial<Record<CoastMeasurement["reason"], string>> = {
  off_screen: "Coast not measurable — zoom out until the origin and the shoreline are both on screen",
  no_land_in_range: "No land within 300 km along this heading",
  no_water_layer: "Basemap water layer unavailable — coast cannot be measured",
};

/** Markers are authored for the 300 km demo world; a city view is ~2 km
 * across. Scaling the marker group keeps them readable instead of filling
 * the screen. */
const REAL_MAP_MARKER_SCALE = 0.02;

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
      {/* The origin pin and landfall marker are modelled for the 300 km demo
          world — the pin alone is an 8 km tall, 6.4 km wide cylinder. Over a
          city that is a skyscraper-sized slab across the whole view, so this
          profile draws the same markers at city scale. Purely a rendering
          choice; nothing about the hazard changes. */}
      <group scale={REAL_MAP_MARKER_SCALE}>
        <HeadingGuide originKm={originKm} landfallKm={landfallKm} fallbackEndKm={fallbackEndKm} />
      </group>
      {/* The hazard's own swept area. Every other profile draws a tsunami
          crest in the water shader; there is no water mesh here, so without
          this the hazard is invisible on the basemap. */}
      <MapHazardFootprint originKm={originKm} kind={kind} getSnapshot={getSnapshot} />
      {/* createElement, not JSX: Visualizer is a stable module-level
          component resolved from the registry, not one created in render
          (same convention as SceneRoot.tsx). */}
      {Visualizer ? createElement(Visualizer, { getSnapshot }) : null}
    </Suspense>
  );
}

export interface MapCanvasProps extends MapHazardContentProps {
  anchor: GeoAnchor;
  /** Clicking the map moves the hazard origin there (the km-frame pin cannot
   * be dragged on this profile — pointer events belong to MapLibre's pan). */
  onOriginPick?: (xKm: number, yKm: number) => void;
  /** Locks origin picking during replay, exactly as the pin locks elsewhere. */
  originLocked?: boolean;
  /** Distance to the REAL coast, measured off the basemap's water polygons,
   * or null when the path runs outside what the map has rendered. */
  onCoastMeasured?: (km: number | null) => void;
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
export function MapCanvas({
  kind,
  originKm,
  headingDeg,
  coastDistanceKm,
  getSnapshot,
  anchor,
  onOriginPick,
  originLocked = false,
  onCoastMeasured,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const matrixRef = useRef<ArrayLike<number> | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const markerRef = useRef<Marker | null>(null);
  // Last values pushed upward, so an unchanged measurement stays local.
  const lastReason = useRef<CoastMeasurement["reason"] | null>(null);
  const lastDistance = useRef<number | null | undefined>(undefined);
  const [mapReady, setMapReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [coastReason, setCoastReason] = useState<CoastMeasurement["reason"] | null>(null);


  // Callbacks and the values the measurement reads live in refs: the map is
  // built once per anchor, and re-running that effect for a slider change
  // would tear down and rebuild the whole basemap.
  const originRef = useRef(originKm);
  const headingRef = useRef(headingDeg);
  const anchorRef = useRef(anchor);
  const pickRef = useRef(onOriginPick);
  const lockedRef = useRef(originLocked);
  const measuredRef = useRef(onCoastMeasured);
  useEffect(() => {
    originRef.current = originKm;
    headingRef.current = headingDeg;
    anchorRef.current = anchor;
    pickRef.current = onOriginPick;
    lockedRef.current = originLocked;
    measuredRef.current = onCoastMeasured;
  }, [originKm, headingDeg, anchor, onOriginPick, originLocked, onCoastMeasured]);

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
    mapRef.current = map;

    // Pan, scroll-zoom, rotate and pitch are MapLibre's defaults; the
    // control gives them a visible affordance and a way back to north.
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

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
      setMapReady(true);
      scheduleMeasure();
    });

    // Clicking open water moves the hazard origin. MapLibre fires "click"
    // only when the pointer did not drag, so this never fights a pan.
    map.on("click", (ev) => {
      if (lockedRef.current || !pickRef.current) return;
      const [xKm, yKm] = lngLatToKm(ev.lngLat.lng, ev.lngLat.lat, anchorRef.current);
      pickRef.current(xKm, yKm);
    });

    // The origin is a real MapLibre marker, so it grabs and drags exactly
    // like the demo world's pin. A Three.js pin cannot: the overlay takes no
    // pointer events, and giving it any would fight the map's own pan.
    const markerEl = document.createElement("div");
    markerEl.setAttribute("aria-label", "Hazard origin");
    markerEl.style.cssText = [
      "width:18px",
      "height:18px",
      "border-radius:9999px",
      "background:rgba(34,211,238,0.9)",
      "border:2px solid rgba(255,255,255,0.9)",
      "box-shadow:0 0 0 6px rgba(34,211,238,0.22)",
      "cursor:grab",
    ].join(";");
    const [originLng, originLat] = kmToLngLat(originRef.current[0], originRef.current[1], anchorRef.current);
    const marker = new Marker({ element: markerEl, draggable: !lockedRef.current }).setLngLat([originLng, originLat]).addTo(map);
    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      const [xKm, yKm] = lngLatToKm(lng, lat, anchorRef.current);
      pickRef.current?.(xKm, yKm);
    });
    markerRef.current = marker;

    // Re-measure when the view settles: the measurement can only read tiles
    // that are on screen, so panning or zooming changes what is answerable.
    //
    // NOT on "idle". The matrix tap calls triggerRepaint() every frame to keep
    // the hazard shaders animating, so the map is never idle for long, and
    // driving React state from that event turned into a render loop that
    // pinned the main thread: each march ran hundreds of
    // queryRenderedFeatures calls, set state, re-rendered, and fired again.
    const remeasure = () => {
      // Size the step to what is visible, so a zoomed-in view bails after a
      // few samples instead of walking 300 km it cannot classify anyway.
      const bounds = map.getBounds();
      const [westKm, southKm] = lngLatToKm(bounds.getWest(), bounds.getSouth(), anchorRef.current);
      const [eastKm, northKm] = lngLatToKm(bounds.getEast(), bounds.getNorth(), anchorRef.current);
      const spanKm = Math.hypot(eastKm - westKm, northKm - southKm);
      const result = measureCoastDistanceKm(
        map,
        anchorRef.current,
        originRef.current,
        headingRef.current,
        Math.min(300, spanKm),
        Math.max(0.25, spanKm / 200),
      );
      // Only push a CHANGED value upward. An unchanged one would re-render
      // the whole command center on every settle for nothing.
      if (result.reason !== lastReason.current) {
        lastReason.current = result.reason;
        setCoastReason(result.reason);
      }
      if (result.distanceKm !== lastDistance.current) {
        lastDistance.current = result.distanceKm;
        measuredRef.current?.(result.distanceKm);
      }
    };

    let pending: number | undefined;
    const scheduleMeasure = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(remeasure, 300);
    };
    map.on("moveend", scheduleMeasure);
    measureRef.current = scheduleMeasure;

    return () => {
      matrixRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      measureRef.current = null;
      window.clearTimeout(pending);
      setMapReady(false);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      map.remove();
    };
    // The anchor is baked into the model matrix; changing it recreates the
    // map rather than rescaling that matrix in place. Everything else the
    // effect reads goes through a ref for exactly that reason.
  }, [anchor.lat, anchor.lon]);

  // Moving the pin or turning the heading changes the path being measured,
  // and neither moves the map, so "moveend" would not fire on its own.
  const [originXKm, originYKm] = originKm;
  useEffect(() => {
    if (!mapReady) return;
    measureRef.current?.();
    const marker = markerRef.current;
    if (!marker) return;
    marker.setDraggable(!originLocked);
    // The marker is the source of its own drags; only follow the session
    // when the change came from somewhere else (a preset, a replay exit).
    const [lng, lat] = kmToLngLat(originXKm, originYKm, anchor);
    const at = marker.getLngLat();
    if (Math.abs(at.lng - lng) > 1e-9 || Math.abs(at.lat - lat) > 1e-9) marker.setLngLat([lng, lat]);
  }, [mapReady, originXKm, originYKm, headingDeg, originLocked, anchor]);

  return (
    <div className="absolute inset-0">
      {/* Inline style, not a class: MapLibre stamps `maplibregl-map` on its
          container, and that rule sets `position: relative`. It has the same
          specificity as Tailwind's `absolute` but lands later in the cascade,
          so the element falls out of absolute positioning, takes height:auto
          over no in-flow content, and measures Nx0. MapLibre then sizes its
          canvas to the 300px default and paints a map nobody can see. An
          inline style outranks both classes. */}
      {/* The HUD's right column covers the map's bottom-right corner, where
          MapLibre puts its controls by default, so they are nudged inboard. */}
      <div
        ref={containerRef}
        className="[&_.maplibregl-ctrl-bottom-right]:!right-[350px] [&_.maplibregl-ctrl-bottom-right]:!bottom-[110px]"
        style={{ position: "absolute", inset: 0 }}
      />
            {/* R3F writes `pointer-events: auto` as an INLINE style on its canvas
          (react-three-fiber sets it whenever no `eventSource` is given), and
          an inline style outranks the wrapper's `pointer-events-none` class.
          The canvas then sits over the whole viewport and eats every drag,
          scroll and click meant for the map. Only an `!important` rule
          outranks an inline style, so the child selector carries one — and it
          has to cover every descendant, not just the canvas: R3F wraps the
          canvas in its own inline-styled divs, and the probe caught one of
          those taking the clicks after the canvas was excluded. Nothing in
          this subtree needs pointer events; the origin pin is disabled here
          because MapLibre owns the gestures. */}
      <div className="pointer-events-none absolute inset-0 [&_*]:!pointer-events-none">
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
      {coastReason && COAST_NOTE[coastReason] ? (
        <div className="pointer-events-none absolute bottom-12 left-3 max-w-sm rounded-[6px] border border-amber-400/40 bg-[rgba(24,16,4,0.85)] px-3 py-1.5 text-[11px] text-amber-200 backdrop-blur-xl">
          {COAST_NOTE[coastReason]}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] border border-white/[0.08] bg-[rgba(9,14,20,0.72)] px-3 py-1.5 text-[10px] tracking-[0.08em] text-white/70 backdrop-blur-xl">
        Real basemap and coastline — simplified demonstration hazard model, not an operational forecast
      </div>
    </div>
  );
}

export default MapCanvas;
