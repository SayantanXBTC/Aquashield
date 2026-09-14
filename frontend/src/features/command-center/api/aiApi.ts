import { request } from "@/api/client";
import type { AIAnalyzeRequest, AIRequestOut, AIRequestResultOut, AIRequestStatusOut } from "../types";

/** /ai/* — the read-only multi-agent analysis layer (Prompt 14). Owner-
 * scoped like every other endpoint; the backend runs the graph
 * synchronously, so `analyze` returns the finished audit record and
 * `getResult` the Command Brief. */
export const aiApi = {
  analyze(data: AIAnalyzeRequest): Promise<AIRequestOut> {
    return request("/ai/analyze", { method: "POST", body: JSON.stringify(data) });
  },
  /** Frame-synchronised analysis (Prompt 15): carries the scenario version
   * on screen and what triggered the run. A version that no longer matches
   * the recorded run is refused with 409 rather than answered. */
  analyzeFrame(data: AIAnalyzeRequest): Promise<AIRequestOut> {
    return request("/ai/analyze-frame", { method: "POST", body: JSON.stringify(data) });
  },
  getRequest(id: string): Promise<AIRequestOut> {
    return request(`/ai/requests/${id}`);
  },
  getStatus(id: string): Promise<AIRequestStatusOut> {
    return request(`/ai/requests/${id}/status`);
  },
  getResult(id: string): Promise<AIRequestResultOut> {
    return request(`/ai/requests/${id}/result`);
  },
};
