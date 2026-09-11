import type {
  DisasterType,
  Page,
  ScenarioCreateRequest,
  ScenarioDetail,
  ScenarioListItem,
  ScenarioStatus,
  ScenarioUpdateRequest,
  ScenarioVersion,
  ScenarioVersionCreateRequest,
  SimulationRun,
  SimulationRunCreateRequest,
  SimulationStatus,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ListScenariosParams {
  disasterType?: DisasterType;
  status?: ScenarioStatus;
  search?: string;
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

export const scenarioApi = {
  createScenario(data: ScenarioCreateRequest): Promise<ScenarioDetail> {
    return request("/scenarios", { method: "POST", body: JSON.stringify(data) });
  },

  getScenarios(params: ListScenariosParams = {}): Promise<Page<ScenarioListItem>> {
    const qs = toQueryString({
      disaster_type: params.disasterType,
      status: params.status,
      search: params.search,
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

  duplicateScenario(id: string): Promise<ScenarioDetail> {
    return request(`/scenarios/${id}/duplicate`, { method: "POST" });
  },

  getVersions(id: string): Promise<ScenarioVersion[]> {
    return request(`/scenarios/${id}/versions`);
  },

  createVersion(id: string, data: ScenarioVersionCreateRequest): Promise<ScenarioVersion> {
    return request(`/scenarios/${id}/versions`, { method: "POST", body: JSON.stringify(data) });
  },

  getRuns(id: string, status?: SimulationStatus): Promise<SimulationRun[]> {
    const qs = toQueryString({ status });
    return request(`/scenarios/${id}/runs${qs}`);
  },

  createRun(id: string, data: SimulationRunCreateRequest = {}): Promise<SimulationRun> {
    return request(`/scenarios/${id}/runs`, { method: "POST", body: JSON.stringify(data) });
  },
};
