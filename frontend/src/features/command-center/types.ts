// Re-exported from the cross-domain shared contracts (architecture.md §22) —
// this feature never redefines these shapes locally. SimulationRunDetail/
// SimulationArtifactOut/TimelineResponse were added to shared/types in this
// same phase (Prompt 8) since this is their first frontend consumer.
export type {
  DisasterType,
  Page,
  Scenario,
  ScenarioDetail,
  ScenarioListItem,
  ScenarioStatus,
  SimulationArtifactOut,
  SimulationRun,
  SimulationRunDetail,
  SimulationState,
  SimulationStatus,
  TimelineFrame,
  TimelineResponse,
} from "@shared/types";
