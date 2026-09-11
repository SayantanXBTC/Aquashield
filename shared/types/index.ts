/**
 * TypeScript mirror of the JSON Schema contracts in shared/contracts/.
 *
 * The JSON Schema files are the canonical, cross-language source of truth
 * for shape and validation rules. These types are a synchronized,
 * hand-maintained representation for frontend consumers — see
 * docs/development/database.md for the cross-language contract strategy.
 *
 * No business logic belongs here — types only.
 */

export type DisasterType =
  | "flood"
  | "flash_flood"
  | "coastal_flood"
  | "storm_surge"
  | "cyclone"
  | "tsunami"
  | "oil_spill"
  | "chemical_pollution"
  | "search_rescue";

export type ScenarioStatus = "draft" | "ready" | "archived";

export type SimulationStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export type RiskCategory =
  | "overall"
  | "population"
  | "infrastructure"
  | "environmental"
  | "economic"
  | "evacuation"
  | "accessibility";

export type RecommendationPriority = "P0" | "P1" | "P2" | "P3";

export type RecommendationStatus = "proposed" | "accepted" | "rejected" | "implemented";

export type RecommendationSource =
  | "rule_based"
  | "simulation_analysis"
  | "ai_agent"
  | "human_operator";

export type AgentResponseStatus = "success" | "partial" | "error";

export type WebSocketEventType =
  | "simulation_started"
  | "simulation_frame"
  | "simulation_paused"
  | "simulation_completed"
  | "simulation_error"
  | "risk_updated"
  | "alert_created"
  | "agent_update"
  | "recommendation_created";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface Scenario {
  id: string;
  name: string;
  description?: string | null;
  disaster_type: DisasterType;
  location_name?: string | null;
  location?: GeoPoint | null;
  status: ScenarioStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScenarioVersion {
  id: string;
  scenario_id: string;
  version_number: number;
  label?: string | null;
  /** Disaster-specific parameters — shape varies by Scenario.disaster_type. */
  scenario_config: Record<string, unknown>;
  notes?: string | null;
  created_at?: string;
}

export interface SimulationRun {
  id: string;
  scenario_version_id: string;
  status: SimulationStatus;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  timestep_config: Record<string, unknown>;
  model_identifier?: string | null;
  error_message?: string | null;
  created_at?: string;
}

// --- API request/response envelopes ---
//
// These mirror backend/app/schemas/scenario.py, which is their source of
// truth (there is no separate Python copy of these — only the domain types
// above are mirrored on both sides; these are API-shape only).

export interface ScenarioCreateRequest {
  name: string;
  description?: string | null;
  disaster_type: DisasterType;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scenario_config?: Record<string, unknown>;
  version_label?: string | null;
  created_by?: string | null;
}

export interface ScenarioUpdateRequest {
  name?: string | null;
  description?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: ScenarioStatus | null;
  scenario_config?: Record<string, unknown> | null;
  version_label?: string | null;
  version_notes?: string | null;
}

export interface ScenarioVersionCreateRequest {
  scenario_config: Record<string, unknown>;
  label?: string | null;
  notes?: string | null;
}

export interface ScenarioListItem {
  id: string;
  name: string;
  disaster_type: DisasterType;
  status: ScenarioStatus;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  current_version_number?: number | null;
  updated_at: string;
}

export interface ScenarioDetail {
  id: string;
  name: string;
  description?: string | null;
  disaster_type: DisasterType;
  status: ScenarioStatus;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  current_version: ScenarioVersion | null;
  version_count: number;
}

export interface SimulationRunCreateRequest {
  /** Defaults to the scenario's current (latest) version if omitted. */
  scenario_version_id?: string | null;
  model_identifier?: string | null;
  timestep_config?: Record<string, unknown>;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface SimulationState {
  simulation_run_id: string;
  simulation_time?: string;
  timestep: number;
  disaster_type: DisasterType;
  environmental_state: Record<string, unknown>;
  hazard_state: Record<string, unknown>;
  affected_area?: Record<string, unknown> | null;
  risk_state: Record<string, unknown>;
  infrastructure_impacts: Record<string, unknown>[];
  metadata: Record<string, unknown>;
}

export interface TimelineFrame {
  simulation_run_id: string;
  timestep: number;
  simulation_time?: string;
  state: Record<string, unknown>;
  is_key_event?: boolean;
}

export interface RiskAssessment {
  id: string;
  simulation_run_id: string;
  category: RiskCategory;
  level: RiskLevel;
  score?: number | null;
  explanation?: string | null;
  timestep?: number | null;
  metadata: Record<string, unknown>;
  created_at?: string;
}

export interface VulnerabilityResult {
  id: string;
  simulation_run_id: string;
  infrastructure_asset_id?: string | null;
  region_label?: string | null;
  level: RiskLevel;
  reason?: string | null;
  impact_description?: string | null;
  timestep?: number | null;
  metadata: Record<string, unknown>;
  created_at?: string;
}

export interface AgentRequest {
  request_id: string;
  agent_type: string;
  scenario_id?: string | null;
  simulation_run_id?: string | null;
  simulation_state?: Record<string, unknown> | null;
  task: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface AgentResponse {
  request_id: string;
  agent_type: string;
  status: AgentResponseStatus;
  findings: Record<string, unknown>[];
  confidence?: number | null;
  evidence: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  metadata: Record<string, unknown>;
}

export interface RAGQuery {
  disaster_type?: DisasterType | null;
  location?: string | null;
  query: string;
  simulation_context?: Record<string, unknown> | null;
  required_source_type?: string | null;
  filters: Record<string, unknown>;
}

export interface RAGResult {
  source_id: string;
  title: string;
  source_type?: string | null;
  publisher?: string | null;
  publication_date?: string | null;
  relevance_score?: number | null;
  excerpt?: string | null;
  metadata: Record<string, unknown>;
}

export interface ResponseRecommendation {
  id: string;
  simulation_run_id: string;
  priority: RecommendationPriority;
  action: string;
  rationale?: string | null;
  evidence_reference?: string | null;
  responsible_role?: string | null;
  deadline_timestep?: number | null;
  confidence?: number | null;
  source: RecommendationSource;
  status: RecommendationStatus;
  created_at?: string;
}

export interface IncidentActionPlan {
  id: string;
  simulation_run_id: string;
  incident_overview?: string | null;
  situation_summary?: string | null;
  objectives: string[];
  priority_actions: Record<string, unknown>[];
  operational_period: Record<string, unknown>;
  resources: Record<string, unknown>;
  evacuation_strategy?: string | null;
  safety_considerations?: string | null;
  communication_plan?: string | null;
  environmental_considerations?: string | null;
  monitoring_plan?: string | null;
  decision_triggers: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  generation_metadata: Record<string, unknown>;
  created_at?: string;
}

export interface WebSocketEvent {
  event_type: WebSocketEventType;
  timestamp: string;
  simulation_run_id?: string | null;
  payload: Record<string, unknown>;
}
