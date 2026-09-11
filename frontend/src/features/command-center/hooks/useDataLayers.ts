import { startTransition, useCallback, useEffect, useState } from "react";
import { geospatialApi } from "../api/geospatialApi";
import type { ExposureResult, GeospatialDataQuality, HazardFootprint } from "../types";

export type DataLayerKey = "hazardFootprint" | "infrastructure" | "exposure";

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
}

/**
 * Fetches Prompt 10's hazard-footprint/exposure data for the command
 * center's "Data Layers" panel and its 3D geospatial overlays — independent
 * of useCommandCenterSession so a failure here (or simply no data yet)
 * never affects core playback. Real backend data only: no toggle here ever
 * fabricates a geometry or asset.
 */
export function useDataLayers({ runId, runCompleted, frameIndex }: UseDataLayersArgs) {
  const [enabled, setEnabled] = useState<Record<DataLayerKey, boolean>>({
    hazardFootprint: true,
    infrastructure: true,
    exposure: true,
  });

  const [footprints, setFootprints] = useState<HazardFootprint[]>([]);
  const [exposureResults, setExposureResults] = useState<ExposureResult[]>([]);
  const [dataQuality, setDataQuality] = useState<GeospatialDataQuality>("unknown");
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const anyLayerEnabled = enabled.hazardFootprint || enabled.infrastructure || enabled.exposure;

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

  return {
    enabled,
    toggleLayer,
    hazardFootprint: currentFootprint,
    exposureResults: enabled.infrastructure || enabled.exposure ? exposureResults : [],
    dataQuality,
    status,
    error,
  };
}
