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
 */
export function MapCanvas({ kind, originKm, headingDeg, coastDistanceKm, getSnapshot, anchor }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const matrixRef = useRef<ArrayLike<number> | null>(null);
  const [diagnostic, setDiagnostic] = useState("creating map…");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    setDiagnostic(`container ${Math.round(box.width)}x${Math.round(box.height)} — loading style…`);
    if (box.height < 1 || box.width < 1) {
      setDiagnostic(`container has no size (${Math.round(box.width)}x${Math.round(box.height)}) — map cannot render`);
      return;
    }

    let map: MaplibreMap;
    try {
      map = new MaplibreMap({
        container,
        style: OPENFREEMAP_STYLE_URL,
        center: [anchor.lon, anchor.lat],
        zoom: 13,
        pitch: 60,
        bearing: -20,
      });
    } catch (err) {
      setDiagnostic(`map constructor threw: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    map.on("error", (e) => {
      setDiagnostic(`map error: ${e.error?.message ?? "unknown"}`);
    });
    map.on("styledata", () => setDiagnostic((d) => (d.startsWith("map error") ? d : "style loaded, waiting for tiles…")));
    map.on("idle", () => setDiagnostic((d) => (d.startsWith("map error") ? d : `rendering — ${map.getStyle()?.layers?.length ?? 0} layers`)));

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
      map.remove();
    };
    // The anchor is baked into the model matrix; changing it recreates the
    // map rather than rescaling that matrix in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.lat, anchor.lon]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 bg-[#0b1520]" />
      <div className="pointer-events-none absolute inset-0">
        <Canvas
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          camera={{ manual: true }}
          style={{ background: "transparent" }}
        >
          <MapCameraSync anchor={anchor} matrixRef={matrixRef} />
          <MapHazardContent kind={kind} originKm={originKm} headingDeg={headingDeg} coastDistanceKm={coastDistanceKm} getSnapshot={getSnapshot} />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute top-3 left-3 max-w-[520px] rounded-[6px] border border-amber-400/40 bg-[rgba(20,14,4,0.86)] px-3 py-1.5 font-mono text-[11px] text-amber-200/90">
        map status: {diagnostic}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] border border-white/[0.08] bg-[rgba(9,14,20,0.72)] px-3 py-1.5 text-[10px] tracking-[0.08em] text-white/70 backdrop-blur-xl">
        Real basemap — simplified demonstration hazard model, not an operational forecast
      </div>
    </div>
  );
}

export default MapCanvas;
