import { request } from "@/api/client";
import type { SimulationRunDetail, TimelineResponse } from "../types";

/** /simulation-runs/* — execution and recorded timelines. Ownership is
 * enforced server-side; another user's run is a 404. */
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
