import { ApiError } from "@/features/scenario-builder/api/scenarioApi";
import type { SimulationRunDetail, TimelineResponse } from "../types";

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

/** Client for Prompt 7's /simulation-runs/* endpoints — the command
 * center's only path to real simulation execution/timeline data. Reuses
 * `ApiError` from the scenario-builder feature's api client rather than
 * defining a second error type for the same HTTP failure shape. */
export const simulationApi = {
  getRun(runId: string): Promise<SimulationRunDetail> {
    return request(`/simulation-runs/${runId}`);
  },

  executeRun(runId: string): Promise<SimulationRunDetail> {
    return request(`/simulation-runs/${runId}/execute`, { method: "POST" });
  },

  getTimeline(runId: string): Promise<TimelineResponse> {
    return request(`/simulation-runs/${runId}/timeline`);
  },
};

export { ApiError };
