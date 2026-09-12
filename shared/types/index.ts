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
  /** Prompt 10.1: mirrors SimulationRunDetail.frame_count — null before an
   * artifact exists (pending/running/failed), 0 when an artifact exists but
   * produced no frames (a COMPLETED run is never assumed to have usable
   * frames — see docs/geospatial/impact-visualization.md). Present on both
   * GET /scenarios/{id}/runs list items and GET /scenarios/{id}/runs/default
   * so the run selector never needs a second call per run. */
  frame_count?: number | null;
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

// --- Simulation execution (Prompt 7: backend/app/schemas/simulation.py) ---
//
// API-local envelope shapes for /simulation-runs/* — not duplicated into
// shared/schemas/python since backend/app/schemas/simulation.py is already
// their Python source of truth (same convention as the Scenario API
// envelopes above). Added here, mirrored from that file, because the
// command-center feature (Prompt 8) is the first frontend consumer.

export type ArtifactType = "netcdf" | "zarr" | "geotiff" | "json" | "other";

export interface SimulationArtifactOut {
  id: string;
  artifact_type: ArtifactType;
  format?: string | null;
  timestep_start?: number | null;
  timestep_end?: number | null;
  extra_metadata: Record<string, unknown>;
}

export interface SimulationRunDetail {
  id: string;
  scenario_version_id: string;
  status: SimulationStatus;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  timestep_config: Record<string, unknown>;
  model_identifier?: string | null;
  error_message?: string | null;
  created_at: string;
  artifact?: SimulationArtifactOut | null;
  frame_count?: number | null;
}

export interface TimelineResponse {
  simulation_run_id: string;
  frame_count: number;
  frames: TimelineFrame[];
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

// --- Disaster catalog (Prompt 9.1: backend/app/schemas/disaster_catalog.py) ---
//
// Discovery/documentation metadata for GET /disaster-types — additive, NOT
// the Scenario Builder form's live data source (that stays
// the command center's preset registry (frontend/src/features/command-center/presets.ts), mirrored by
// hand from the same backend truth per CLAUDE.md §25 — see
// docs/development/scenarios.md).

export interface DisasterCatalogEntry {
  disaster_type: DisasterType;
  display_name: string;
  short_description: string;
  category: string;
  /** The real resolved simulation model id (simulation/core/registry.py) —
   * e.g. storm_surge reports "cyclone-demo-v1", never a fabricated
   * per-type id. */
  model_identifier: string;
  parameter_keys: string[];
}

export interface WebSocketEvent {
  event_type: WebSocketEventType;
  timestamp: string;
  simulation_run_id?: string | null;
  payload: Record<string, unknown>;
}

// --- Geospatial / hazard-footprint / exposure / impact (Prompt 10) --------
// New contracts — nothing here existed before this phase. Added to
// shared/types/index.ts per CLAUDE.md; backend/app/schemas/geospatial.py is
// the matching Pydantic mirror.

export type GeospatialDataQuality = "available" | "partial" | "unavailable" | "stale" | "unknown";

export type GeospatialDataCoverage = "local" | "regional" | "global";

export type GeographicDatasetType = "coastline" | "land_polygon" | "admin_boundary" | "other";

/** A GeoJSON geometry object — deliberately untyped beyond `type`/`coordinates`
 * since a hazard footprint or dataset feature may be a Point, LineString,
 * Polygon, or Multi* depending on the disaster/source (never forced into one
 * shape). */
export interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

/** Real provenance for a piece of geographic/hazard data — who produced it,
 * where from, under what license/version. Carried on every dataset/footprint/
 * exposure/impact response, never only documented in prose. */
export interface DataProvenance {
  source_provider: string;
  source_url: string;
  license?: string | null;
  version?: string | null;
  data_quality: GeospatialDataQuality;
  coverage?: GeospatialDataCoverage | null;
}

export interface GeographicDataset {
  id: string;
  name: string;
  dataset_type: GeographicDatasetType;
  source_provider: string;
  source_url: string;
  license: string;
  version: string;
  resolution?: string | null;
  units?: string | null;
  data_quality: GeospatialDataQuality;
  coverage: GeospatialDataCoverage;
  feature_count: number;
  provenance: Record<string, unknown>;
}

/** Mirrors backend/app/schemas/geospatial.py's `GeographicFeatureOut` — the
 * shape returned by GET /geographic-features/nearby. `geometry` is already
 * clipped server-side to the query radius (a raw feature can span an entire
 * continent — see GeographicFeatureRepository.find_within_distance_clipped),
 * so this is real, provenance-tracked geometry ready to render, not a raw
 * dataset row. */
export interface GeographicFeature {
  id: string;
  feature_type: string;
  geometry: GeoJSONGeometry | null;
  properties: Record<string, unknown>;
  dataset_name: string;
  source_provider: string;
  license: string;
}

/** Repackages one TimelineFrame's hazard_state/affected_area into a common
 * shape — never a second physics computation (simulation/core/
 * hazard_footprint.py builds this server-side; the frontend never derives
 * one itself). */
export interface HazardFootprint {
  disaster_type: DisasterType;
  simulation_run_id: string;
  frame_index: number;
  geometry: GeoJSONGeometry | null;
  geometry_type?: string | null;
  intensity: number | null;
  intensity_units: string;
  model_id: string;
  model_version: string;
  is_demo_model: true;
}

/** "within_hazard_footprint" (geometry intersects) or "potentially_exposed"
 * (within a buffer distance but not intersecting) — never "damaged" /
 * "destroyed" / "will be affected" (CLAUDE.md wording rule).
 * "no_active_hazard" is the always-available listing from
 * GET /infrastructure-assets — an asset that exists but hasn't been
 * evaluated against any hazard footprint yet (no run selected/executed). */
export type ExposureStatus = "within_hazard_footprint" | "potentially_exposed" | "no_active_hazard";

export interface ExposureResult {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  criticality: string;
  status: ExposureStatus;
  distance_km?: number | null;
  /** Representative marker position — the asset geometry's centroid (see
   * backend/app/services/exposure_service.py's docstring on why this is a
   * rendering convenience, not a "true location" claim for a line/polygon
   * asset). */
  latitude: number;
  longitude: number;
}

/** AQUASHIELD's own UI severity band — not an official standard (see
 * backend/app/services/impact_severity.py's documented thresholds). */
export type ImpactSeverityBand = "low" | "moderate" | "high" | "critical";

export interface ImpactFrame {
  simulation_run_id: string;
  frame_index: number | null;
  disaster_type: DisasterType | null;
  /** "unavailable" when the run has no executed frames yet — every other
   * field is then a safe empty default, never fabricated. */
  data_quality: GeospatialDataQuality;
  severity_band: ImpactSeverityBand | null;
  exposed_asset_count: number;
  exposed_counts_by_type: Record<string, number>;
  exposed_counts_by_criticality: Record<string, number>;
  hazard_footprint: HazardFootprint | null;
  exposure_results: ExposureResult[];
  vulnerability_assessment_ids: string[];
  risk_assessment_id: string | null;
  is_demo_model: true;
  cached: boolean;
}

// --- Demo shoreline world propagation (Prompt 12) ---------------------------
//
// Common propagation parameters every disaster type accepts inside
// `scenario_config` (backend/app/schemas/scenario_config.py PropagationConfig
// is the validating mirror; simulation/core/propagation.py consumes them).
// Coordinates are kilometres in the synthetic demo shoreline world
// (shared/constants/demo_world.json) — never real-world lat/lon.

export interface PropagationConfig {
  origin_x_km?: number;
  origin_y_km?: number;
  /** Compass degrees: 0 = north (+y), 90 = east (+x). */
  heading_deg?: number;
  speed_kmh?: number;
  /** 0-1. */
  intensity?: number;
  spread_radius_km?: number;
  /** 0-1. */
  dispersion_rate?: number;
  duration_hours?: number;
}

export type HazardPhase = "offshore" | "landfall" | "inland";

/** The disaster-agnostic keys every recorded frame's `hazard_state`
 * carries (simulation/core/propagation.py FrontState.to_hazard_state). */
export interface PropagationHazardState {
  world: string;
  origin_km: { x: number; y: number };
  position_km: { x: number; y: number };
  heading_deg: number;
  speed_kmh: number;
  intensity: number;
  traveled_km: number;
  coast_distance_total_km: number | null;
  distance_to_coast_km: number | null;
  arrival_progress: number;
  arrived: boolean;
  eta_minutes: number | null;
  phase: HazardPhase;
  radius_km: number;
}

// --- User-placed structures (Prompt 13) -------------------------------------
// Validated by backend/app/schemas/scenario_config.py `StructureConfig`;
// exposure assessed per frame by simulation/core/structures.py (mirrored in
// frontend/src/propagation/structures.ts).

export type StructureType = "building" | "hospital" | "port" | "power_plant" | "lighthouse" | "fuel_terminal";

export interface StructureConfig {
  id: string;
  type: StructureType;
  name: string;
  /** Demo-world km. */
  x_km: number;
  y_km: number;
  enabled: boolean;
}

export type StructureStatus = "clear" | "at_risk" | "impacted" | "severe";

/** One entry of a frame's `infrastructure_impacts`. */
export interface StructureImpact {
  structure_id: string;
  structure_type: StructureType;
  name: string;
  distance_km: number;
  /** 0-1. */
  exposure: number;
  status: StructureStatus;
}

// --- AI intelligence layer (Prompt 14) ---------------------------------------
// Mirrors agents/schemas/{evidence,outputs,brief}.py and backend/app/schemas/ai.py.
// Read-only analysis over recorded frames; every action is human-gated.

export type AIRequestStatus = "pending" | "running" | "completed" | "failed";
export type AIPriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AIClaimKind = "observed_simulation_fact" | "spatial_exposure";
export type AIEvidenceKind = "scenario" | "simulation_run" | "timeline_frame" | "hazard_footprint" | "asset_exposure" | "structure_impact";

export interface AIEvidenceRef {
  id: string;
  kind: AIEvidenceKind;
  simulation_run_id?: string | null;
  frame_index?: number | null;
  asset_id?: string | null;
  structure_id?: string | null;
  summary: string;
  values: Record<string, unknown>;
  source: string;
}

export interface AIDataLimitation {
  /** DATA_UNAVAILABLE | RESOURCE_DATA_UNAVAILABLE | NOT_CONFIGURED | AGENT_FAILED */
  code: string;
  subject: string;
  detail: string;
}

export interface AIGroundedStatement {
  statement: string;
  evidence_ids: string[];
}

export interface AIExposureFinding {
  subject: string;
  subject_ref: string;
  claim_kind: AIClaimKind;
  statement: string;
  evidence_ids: string[];
  severity_hint: AIPriorityLevel;
}

export interface AIPriority {
  level: AIPriorityLevel;
  subject: string;
  rationale: string;
  evidence_ids: string[];
}

export interface AIRecommendedAction {
  action: string;
  priority: AIPriorityLevel;
  prerequisites: string[];
  risks: string[];
  /** Always RESOURCE_DATA_UNAVAILABLE until a resource inventory exists. */
  resources: string;
  requires_human_approval: true;
  evidence_ids: string[];
}

/** One graph node's execution record — what the Agent Execution HUD shows. */
export type AIAgentExecutionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "UNAVAILABLE" | "SKIPPED";

export interface AIAgentRun {
  agent: string;
  label: string;
  status: AIAgentExecutionStatus;
  summary?: string | null;
  duration_ms: number;
}

export interface CommandBrief {
  scenario_id: string;
  simulation_run_id: string;
  frame_index: number;
  generated_at: string;
  situation: string;
  current_hazard: string;
  hazard_progression: AIGroundedStatement[];
  key_exposures: AIExposureFinding[];
  priorities: AIPriority[];
  /** Protective measures proposed before impact (Precaution Agent). */
  precautions: AIRecommendedAction[];
  /** Targeted actions per exposed subject (Tactical Response Agent). */
  recommended_actions: AIRecommendedAction[];
  /** Always RESOURCE_DATA_UNAVAILABLE until a verified inventory exists. */
  resource_status: string;
  agent_runs: AIAgentRun[];
  evidence_references: AIEvidenceRef[];
  data_limitations: AIDataLimitation[];
  uncertainties: string[];
  human_review_required: true;
  validation_notes: string[];
  disclaimer: string;
}

/** What triggered an analysis — recorded so throttling stays auditable. */
export type AIRequestType = "playback" | "scrub" | "paused" | "complete" | "manual";

export interface AIAnalyzeRequest {
  scenario_id: string;
  simulation_run_id: string;
  frame_index: number;
  /** The configuration version on screen; a mismatch is refused as stale (409). */
  scenario_version_id?: string | null;
  request_type?: AIRequestType | null;
  user_question?: string | null;
}

export interface AIRequestOut {
  id: string;
  scenario_id: string;
  simulation_run_id: string;
  scenario_version_id?: string | null;
  frame_index: number;
  request_type?: AIRequestType | null;
  user_question?: string | null;
  status: AIRequestStatus;
  provider?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  agent_versions: Record<string, string>;
  tools_called: { agent: string; tool: string; arguments?: Record<string, unknown>; ok: boolean; duration_ms: number; note?: string | null }[];
  execution_ms?: number | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface AIRequestStatusOut {
  id: string;
  status: AIRequestStatus;
  execution_ms?: number | null;
  error?: string | null;
}

export interface AIRequestResultOut {
  id: string;
  status: AIRequestStatus;
  result: CommandBrief | null;
  error?: string | null;
}

// --- AI milestone events (`/ws/ai`) -----------------------------------------
// A live view of the analysis graph while the synchronous /ai/analyze-frame
// call is in flight. Events are best effort: the Command Brief always comes
// back over HTTP, so a client that misses events still renders correctly.

export type AIEventType =
  | "AI_EVENTS_READY"
  | "heartbeat"
  | "AI_ANALYSIS_STARTED"
  | "AGENT_STARTED"
  | "AGENT_COMPLETED"
  | "AI_ANALYSIS_COMPLETED"
  | "AI_ANALYSIS_FAILED"
  | "AI_ANALYSIS_STALE";

export interface AIEvent {
  type: AIEventType;
  request_id?: string;
  scenario_id?: string;
  simulation_run_id?: string;
  scenario_version_id?: string;
  frame_index?: number;
  agent_name?: string;
  label?: string;
  status?: AIAgentExecutionStatus;
  summary?: string | null;
  duration_ms?: number;
  execution_ms?: number | null;
  command_brief?: CommandBrief | null;
  error?: string | null;
}
