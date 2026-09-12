import { ApiError } from "@/features/scenario-builder/api/scenarioApi";
import type { ExposureResult, GeographicFeature, GeospatialDataQuality, HazardFootprint, ImpactFrame } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (body.detail) detail = JSON.stringify(body.detail);
    } catch {
      // response had no JSON body — fall back to statusText
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

interface HazardFootprintListResponse {
  simulation_run_id: string;
  frame_count: number;
  footprints: HazardFootprint[];
}

interface ExposureResponse {
  simulation_run_id: string;
  frame_index: number | null;
  data_quality: GeospatialDataQuality;
  exposure_results: ExposureResult[];
}

interface InfrastructureAssetListResponse {
  data_quality: "available" | "unavailable";
  assets: ExposureResult[];
}

interface NearbyFeaturesResponse {
  data_quality: "available" | "unavailable";
  radius_km: number;
  features: GeographicFeature[];
}

/** Client for Prompt 10's hazard-footprint/exposure/impact endpoints — the
 * command center's "Data Layers" panel and its 3D geospatial overlays are
 * the only consumers. Reuses ApiError from the scenario-builder feature's
 * client rather than a second error type for the same HTTP failure shape. */
export const geospatialApi = {
  getHazardFootprints(runId: string): Promise<HazardFootprintListResponse> {
    return request(`/simulation-runs/${runId}/hazard-footprints`);
  },

  getExposure(runId: string, frameIndex?: number): Promise<ExposureResponse> {
    const query = frameIndex != null ? `?frame_index=${frameIndex}` : "";
    return request(`/simulation-runs/${runId}/exposure${query}`);
  },

  /** Always available — independent of any scenario/run. The Command
   * Center's "Infrastructure" layer uses this so real assets are visible
   * before a simulation has ever been executed; exposure status against a
   * specific hazard footprint comes from `getExposure` instead. */
  getInfrastructureAssets(): Promise<InfrastructureAssetListResponse> {
    return request(`/infrastructure-assets`);
  },

  /** Always available — independent of any scenario/run. Real, previously-
   * ingested geographic features (e.g. Natural Earth coastline) near a
   * point, already clipped server-side to `radiusKm`. */
  getNearbyFeatures(latitude: number, longitude: number, radiusKm = 300): Promise<NearbyFeaturesResponse> {
    return request(
      `/geographic-features/nearby?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`,
    );
  },

  getImpact(runId: string, frameIndex?: number): Promise<ImpactFrame> {
    const path =
      frameIndex != null
        ? `/simulation-runs/${runId}/impact/frames/${frameIndex}`
        : `/simulation-runs/${runId}/impact`;
    return request(path);
  },
};

export { ApiError };
