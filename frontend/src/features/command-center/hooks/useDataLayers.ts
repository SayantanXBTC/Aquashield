import { startTransition, useCallback, useEffect, useState } from "react";
import type { LatLon } from "@/three/utils/geoProjection";
import { geospatialApi } from "../api/geospatialApi";
import type { ExposureResult, GeographicFeature, GeospatialDataQuality, HazardFootprint } from "../types";

export type DataLayerKey = "hazardFootprint" | "infrastructure" | "exposure" | "coastline";

type AsyncStatus = "idle" | "loading" | "error";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

interface UseDataLayersArgs {
  runId: string | null;
  /** Only a completed run has a timeline/hazard footprints to fetch — same
   * gate useCommandCenterSession applies before loading frames. */
  runCompleted: boolean;
  frameIndex: number;
  /** The scenario's real-world location — anchors the (always-available,
   * run-independent) coastline lookup. Omitted/null before a scenario is
   * selected (the coastline layer simply has nothing to fetch yet). */
  scenarioLocation?: LatLon | null;
}

/**
 * Fetches Prompt 10's hazard-footprint/exposure data for the command
 * center's "Data Layers" panel and its 3D geospatial overlays — independent
 * of useCommandCenterSession so a failure here (or simply no data yet)
 * never affects core playback. Real backend data only: no toggle here ever
 * fabricates a geometry or asset.
 */
export function useDataLayers({
  runId,
  runCompleted,
  frameIndex,
  scenarioLocation = null,
}: UseDataLayersArgs) {
  const [enabled, setEnabled] = useState<Record<DataLayerKey, boolean>>({
    hazardFootprint: true,
    infrastructure: true,
    exposure: true,
    coastline: true,
  });

  const [footprints, setFootprints] = useState<HazardFootprint[]>([]);
  const [exposureResults, setExposureResults] = useState<ExposureResult[]>([]);
  const [infrastructureAssets, setInfrastructureAssets] = useState<ExposureResult[]>([]);
  const [coastlineFeatures, setCoastlineFeatures] = useState<GeographicFeature[]>([]);
  const [dataQuality, setDataQuality] = useState<GeospatialDataQuality>("unknown");
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const anyLayerEnabled = enabled.hazardFootprint || enabled.infrastructure || enabled.exposure;

  // Always available — independent of any run. Fetched once whenever the
  // Infrastructure layer is on, regardless of whether a simulation has been
  // executed, so real assets are visible from the moment a scenario is
  // selected (see GET /infrastructure-assets).
  useEffect(() => {
    if (!enabled.infrastructure) {
      startTransition(() => setInfrastructureAssets([]));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await geospatialApi.getInfrastructureAssets();
        if (cancelled) return;
        setInfrastructureAssets(response.assets);
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, "Failed to load infrastructure assets"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled.infrastructure]);

  // Always available — independent of any run. Real Natural Earth coastline
  // (or other ingested) features near the scenario's own location, already
  // clipped server-side to a bounded radius (see
  // GET /geographic-features/nearby) — the only layer in this panel backed
  // by genuinely real, externally-sourced geographic data rather than
  // synthetic demo assets.
  useEffect(() => {
    if (!enabled.coastline || !scenarioLocation) {
      startTransition(() => setCoastlineFeatures([]));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await geospatialApi.getNearbyFeatures(
          scenarioLocation.latitude,
          scenarioLocation.longitude,
        );
        if (cancelled) return;
        setCoastlineFeatures(response.features);
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, "Failed to load nearby geographic features"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled.coastline, scenarioLocation]);

  // One fetch per run — every frame's footprint is already in this list.
  useEffect(() => {
    if (!runId || !runCompleted || !anyLayerEnabled) {
      startTransition(() => setFootprints([]));
      return;
    }
    let cancelled = false;
    startTransition(() => {
      setStatus("loading");
      setError(null);
    });
    (async () => {
      try {
        const response = await geospatialApi.getHazardFootprints(runId);
        if (cancelled) return;
        setFootprints(response.footprints);
        setStatus("idle");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(errorMessage(err, "Failed to load hazard footprints"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, runCompleted, anyLayerEnabled]);

  // Exposure is queried per-frame (it depends on that frame's footprint
  // geometry), so it's refetched on frame change.
  useEffect(() => {
    if (!runId || !runCompleted || !(enabled.infrastructure || enabled.exposure)) {
      startTransition(() => {
        setExposureResults([]);
        setDataQuality("unknown");
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await geospatialApi.getExposure(runId, frameIndex);
        if (cancelled) return;
        setExposureResults(response.exposure_results);
        setDataQuality(response.data_quality);
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, "Failed to load exposure data"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, runCompleted, frameIndex, enabled.infrastructure, enabled.exposure]);

  const toggleLayer = useCallback((key: DataLayerKey) => {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const currentFootprint =
    (enabled.hazardFootprint &&
      (footprints.find((f) => f.frame_index === frameIndex) ?? footprints.at(-1))) ||
    null;

  // Once a run/frame has real exposure evaluation, that's strictly more
  // informative (it carries within/potentially_exposed status) — fall back
  // to the always-available baseline listing only when there's no run-scoped
  // data yet, so markers show up immediately for a scenario that hasn't been
  // executed, and switch to exposure-colored markers the moment a run has.
  const displayedAssets = exposureResults.length > 0 ? exposureResults : infrastructureAssets;

  return {
    enabled,
    toggleLayer,
    hazardFootprint: currentFootprint,
    exposureResults: enabled.infrastructure || enabled.exposure ? displayedAssets : [],
    infrastructureCount: infrastructureAssets.length,
    coastlineFeatures: enabled.coastline ? coastlineFeatures : [],
    dataQuality,
    status,
    error,
  };
}
