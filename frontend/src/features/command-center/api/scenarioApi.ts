import { request } from "@/api/client";
import type {
  Page,
  ScenarioCreateRequest,
  ScenarioDetail,
  ScenarioListItem,
  ScenarioStatus,
  ScenarioUpdateRequest,
  SimulationRun,
  SimulationRunCreateRequest,
  SimulationStatus,
} from "../types";

export interface ListScenariosParams {
  status?: ScenarioStatus;
  sortBy?: "created_at" | "updated_at" | "name";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string | number][];
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

/** /scenarios/* — every call is scoped server-side to the signed-in user
 * (the bearer token api/client.ts attaches), so this list is always "my
 * tests" and nothing else. */
export const scenarioApi = {
  createScenario(data: ScenarioCreateRequest): Promise<ScenarioDetail> {
    return request("/scenarios", { method: "POST", body: JSON.stringify(data) });
  },
  getScenarios(params: ListScenariosParams = {}): Promise<Page<ScenarioListItem>> {
    const qs = toQueryString({
      status: params.status,
      sort_by: params.sortBy,
      sort_dir: params.sortDir,
      limit: params.limit,
      offset: params.offset,
    });
    return request(`/scenarios${qs}`);
  },
  getScenario(id: string): Promise<ScenarioDetail> {
    return request(`/scenarios/${id}`);
  },
  updateScenario(id: string, data: ScenarioUpdateRequest): Promise<ScenarioDetail> {
    return request(`/scenarios/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },
  archiveScenario(id: string): Promise<ScenarioDetail> {
    return request(`/scenarios/${id}`, { method: "DELETE" });
  },
  getRuns(id: string, status?: SimulationStatus): Promise<SimulationRun[]> {
    return request(`/scenarios/${id}/runs${toQueryString({ status })}`);
  },
  createRun(id: string, data: SimulationRunCreateRequest = {}): Promise<SimulationRun> {
    return request(`/scenarios/${id}/runs`, { method: "POST", body: JSON.stringify(data) });
  },
};
