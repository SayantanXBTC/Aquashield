import { createElement, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { createThreeMapLayer, type ThreeMapLayerHandle } from "./threeMapLayer";

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const HAZARD_LAYER_ID = "aquashield-hazard-layer";
const BUILDINGS_LAYER_ID = "aquashield-3d-buildings";

interface MapHazardContentProps {
  kind: HazardKind | null;
  originKm: [number, number];
  headingDeg: number;
  coastDistanceKm: number | null;
  getSnapshot: () => HazardSnapshot | null;
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
      {/* No EnvironmentSystem/Sky here: its dome is an opaque backdrop that
          would paint over the real basemap tiles sharing this canvas. */}
      <HeadingGuide originKm={originKm} landfallKm={landfallKm} fallbackEndKm={fallbackEndKm} />
      {/* No pointer-event manager is installed on this shared canvas (it
          would fight MapLibre's own drag/pan/rotate handlers), so the pin
          is shown for orientation only, not draggable, in this profile. */}
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
 * camera-synced on top via threeMapLayer.ts. Deliberately not <AquaCanvas> —
 * see threeMapLayer.ts's header for why this is still only one Three.js
 * renderer at a time, never a second alongside <AquaCanvas>'s <Canvas>.
 */
export function MapCanvas({ kind, originKm, headingDeg, coastDistanceKm, getSnapshot, anchor }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<ThreeMapLayerHandle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setReady(false);
    const map = new MaplibreMap({
      container,
      style: OPENFREEMAP_STYLE_URL,
      center: [anchor.lon, anchor.lat],
      zoom: 15.5,
      pitch: 60,
      bearing: -20,
      canvasContextAttributes: { antialias: true },
    });

    map.on("load", () => {
      // Liberty already ships its own building extrusion; adding an
      // explicit one keeps the height fallback (and any future
      // exposure-driven styling) in code this project owns rather than
      // upstream style internals.
      map.addLayer({
        id: BUILDINGS_LAYER_ID,
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#9aa5b1",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
          "fill-extrusion-opacity": 0.85,
        },
      });

      const layer = createThreeMapLayer(HAZARD_LAYER_ID, anchor);
      layerRef.current = layer;
      map.addLayer(layer);
      setReady(true);
    });

    return () => {
      setReady(false);
      layerRef.current = null;
      map.remove();
    };
    // The anchor is baked once into the custom layer's model matrix
    // (threeMapLayer.ts); changing it recreates the whole map rather than
    // trying to rescale that matrix in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.lat, anchor.lon]);

  useEffect(() => {
    if (!ready || !layerRef.current) return;
    layerRef.current.setContent(<MapHazardContent kind={kind} originKm={originKm} headingDeg={headingDeg} coastDistanceKm={coastDistanceKm} getSnapshot={getSnapshot} />);
  }, [ready, kind, originKm, headingDeg, coastDistanceKm, getSnapshot]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] border border-white/[0.08] bg-[rgba(9,14,20,0.72)] px-3 py-1.5 text-[10px] tracking-[0.08em] text-white/70 backdrop-blur-xl">
        Real basemap — simplified demonstration hazard model, not an operational forecast
      </div>
    </div>
  );
}

export default MapCanvas;
