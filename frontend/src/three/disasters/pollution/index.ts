// chemical_pollution reuses OilSpillVisualizer — same reuse decision as
// simulation/core/registry.py (Prompt 7) and backend/app/schemas/
// scenario_config.py's DISASTER_CONFIG_SCHEMAS. This file exists only so
// the directory documented in the suggested three/ tree isn't silently
// empty with no explanation.
export { OilSpillVisualizer as PollutionVisualizer } from "../oil-spill/OilSpillVisualizer";
