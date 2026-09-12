import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeHazard,
  hazardKindFor,
  paramsFor,
  snapshotFromRecordedFrame,
  type HazardKind,
  type HazardSnapshot,
} from "@/propagation/hazards";
import { paramsToConfig, type PropagationParams } from "@/propagation/kinematics";
import { assessStructures, geometryFromSnapshot } from "@/propagation/structures";
import { distanceToCoastAlongHeading, shoreX, WORLD_KM } from "@/propagation/world";
import { scenarioApi } from "../api/scenarioApi";
import { simulationApi } from "../api/simulationApi";
import type { PlaybackClock } from "../playback/playbackClock";
import type { DisasterPreset } from "../presets";
import type { ScenarioDetail, ScenarioListItem, SimulationRun, StructureConfig, StructureImpact, StructureType, TimelineFrame } from "../types";

export type AsyncStatus = "idle" | "loading" | "error";
export type SaveStatus = "saved" | "dirty" | "saving" | "error";

const DEFAULT_DURATION_HOURS = 6;
const AUTOSAVE_DELAY_MS = 700;
/** Backend timestep the recorded runs use (simulation/core/time.py default). */
const RECORDED_TIMESTEP_MINUTES = 15;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function structuresFromConfig(config: Record<string, unknown> | undefined): StructureConfig[] {
  const raw = config?.structures;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is StructureConfig => Boolean(s) && typeof s === "object" && typeof (s as StructureConfig).id === "string")
    .map((s) => ({ ...s, enabled: s.enabled !== false, name: s.name ?? "" }));
}

/** Default drop point for a new structure of `type`: on the shoreline
 * (port/lighthouse/terminal) or just inland (others), staggered by how many
 * already exist so they don't stack. */
export function defaultStructurePosition(type: StructureType, existing: number, aroundYKm: number): [number, number] {
  const y = Math.max(5, Math.min(WORLD_KM - 5, aroundYKm + ((existing % 7) - 3) * 9));
  const shore = shoreX(y);
  const coastal = type === "port" || type === "lighthouse" || type === "fuel_terminal";
  return [coastal ? shore + 0.6 : shore + 4 + Math.floor(existing / 7) * 6, y];
}

function durationFromConfig(config: Record<string, unknown> | undefined): number {
  const raw = config?.duration_hours;
  return typeof raw === "number" && raw > 0 ? raw : DEFAULT_DURATION_HOURS;
}

/**
 * Everything the command center knows about "my tests":
 *
 *   Scenario (owned by the signed-in user) -> current version's
 *   scenario_config -> PropagationParams (the inline HUD's live values)
 *   -> HazardSnapshot per frame, from either
 *        (a) the client-side mirror of the demo models (LIVE PREVIEW —
 *            params can change at any moment), or
 *        (b) a recorded backend run's frames (REPLAY — read-only).
 *
 * Every parameter edit is persisted to the user's account as a new
 * immutable ScenarioVersion (autosaved shortly after the edit settles).
 * Recording a run creates + executes a SimulationRun on the backend against
 * the version that is current at that moment.
 */
export function useScenarioSession(clock: PlaybackClock) {
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [scenariosStatus, setScenariosStatus] = useState<AsyncStatus>("loading");
  const [scenariosError, setScenariosError] = useState<string | null>(null);

  // Deep link: `?scenario=<id>` selects that test on load; selection is
  // mirrored back into the URL so a reload/share lands on the same test.
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("scenario"),
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedScenarioId) url.searchParams.set("scenario", selectedScenarioId);
    else url.searchParams.delete("scenario");
    window.history.replaceState(window.history.state, "", url);
  }, [selectedScenarioId]);
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [scenarioStatus, setScenarioStatus] = useState<AsyncStatus>("idle");
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [params, setParamsState] = useState<PropagationParams | null>(null);
  const [durationHours, setDurationHoursState] = useState(DEFAULT_DURATION_HOURS);
  const [structures, setStructuresState] = useState<StructureConfig[]>([]);
  const [showStructures, setShowStructures] = useState(true);
  const structuresRef = useRef<StructureConfig[]>([]);
  useEffect(() => {
    structuresRef.current = structures;
  }, [structures]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const latestConfig = useRef<Record<string, unknown>>({});
  const paramsRef = useRef<PropagationParams | null>(null);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [recording, setRecording] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRecordedRun, setLastRecordedRun] = useState<{ frameCount: number; durationMs: number } | null>(null);
  const lastRecordedRunTimer = useRef<number | null>(null);
  const [replayRunId, setReplayRunId] = useState<string | null>(null);
  const [replayFrames, setReplayFrames] = useState<TimelineFrame[]>([]);
  const [replayStatus, setReplayStatus] = useState<AsyncStatus>("idle");

  const [creating, setCreating] = useState(false);

  const kind: HazardKind | null = scenario ? hazardKindFor(scenario.disaster_type) : null;

  // --- scenario list -------------------------------------------------------

  const loadScenarios = useCallback(async (preferId?: string | null) => {
    startTransition(() => {
      setScenariosStatus("loading");
      setScenariosError(null);
    });
    try {
      const page = await scenarioApi.getScenarios({ limit: 50, sortBy: "updated_at" });
      const items = page.items.filter((s) => s.status !== "archived");
      setScenarios(items);
      setScenariosStatus("idle");
      setSelectedScenarioId((current) => {
        const wanted = preferId ?? current;
        if (wanted && items.some((s) => s.id === wanted)) return wanted;
        return items[0]?.id ?? null;
      });
    } catch (err) {
      setScenariosStatus("error");
      setScenariosError(errorMessage(err, "Failed to load your tests"));
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadScenarios();
    });
  }, [loadScenarios]);

  // --- selected scenario ---------------------------------------------------

  useEffect(() => {
    if (!selectedScenarioId) {
      startTransition(() => {
        setScenario(null);
        setParamsState(null);
        setRuns([]);
        setReplayRunId(null);
      });
      return;
    }
    let cancelled = false;
    startTransition(() => {
      setScenarioStatus("loading");
      setScenarioError(null);
      setReplayRunId(null);
      setReplayFrames([]);
      setRunError(null);
      clock.pause();
      clock.restart();
    });
    (async () => {
      try {
        const [detail, runList] = await Promise.all([
          scenarioApi.getScenario(selectedScenarioId),
          scenarioApi.getRuns(selectedScenarioId),
        ]);
        if (cancelled) return;
        const config = (detail.current_version?.scenario_config ?? {}) as Record<string, unknown>;
        const k = hazardKindFor(detail.disaster_type);
        latestConfig.current = config;
        setScenario(detail);
        setParamsState(k ? paramsFor(k, config) : null);
        setStructuresState(structuresFromConfig(config));
        const hours = durationFromConfig(config);
        setDurationHoursState(hours);
        clock.setDuration(hours * 60);
        setRuns(runList);
        setSaveStatus("saved");
        setSaveError(null);
        setScenarioStatus("idle");
      } catch (err) {
        if (cancelled) return;
        setScenarioStatus("error");
        setScenarioError(errorMessage(err, "Failed to load test"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedScenarioId, clock]);

  // --- parameter editing + autosave ---------------------------------------

  const persist = useCallback(
    async (next: PropagationParams, hours: number) => {
      if (!selectedScenarioId) return;
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const scenario_config = {
          ...latestConfig.current,
          ...paramsToConfig(next),
          duration_hours: hours,
          structures: structuresRef.current,
        };
        const detail = await scenarioApi.updateScenario(selectedScenarioId, {
          scenario_config,
          version_label: "Inline parameter edit",
        });
        latestConfig.current = (detail.current_version?.scenario_config ?? scenario_config) as Record<string, unknown>;
        setScenario(detail);
        setScenarios((prev) => prev.map((s) => (s.id === detail.id ? { ...s, updated_at: detail.updated_at, current_version_number: detail.current_version?.version_number ?? s.current_version_number } : s)));
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
        setSaveError(errorMessage(err, "Failed to save parameters"));
      }
    },
    [selectedScenarioId],
  );

  const scheduleSave = useCallback(
    (next: PropagationParams, hours: number) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      setSaveStatus("dirty");
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void persist(next, hours);
      }, AUTOSAVE_DELAY_MS);
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (lastRecordedRunTimer.current) window.clearTimeout(lastRecordedRunTimer.current);
    },
    [],
  );

  /** Live edit (slider drag, pin drag): updates the preview only. */
  const setParams = useCallback((update: Partial<PropagationParams>) => {
    setReplayRunId(null);
    setParamsState((prev) => (prev ? { ...prev, ...update } : prev));
  }, []);

  /** Edit settled (slider release, pin drop): persist as a new version. */
  const commitParams = useCallback(() => {
    if (paramsRef.current) scheduleSave(paramsRef.current, durationHours);
  }, [scheduleSave, durationHours]);

  const setDurationHours = useCallback(
    (hours: number) => {
      const clamped = Math.max(0.5, Math.min(72, hours));
      setDurationHoursState(clamped);
      clock.setDuration(clamped * 60);
      if (paramsRef.current) scheduleSave(paramsRef.current, clamped);
    },
    [clock, scheduleSave],
  );

  // --- structures ---------------------------------------------------------

  /** Live edit (drag): preview only. */
  const setStructures = useCallback((update: (prev: StructureConfig[]) => StructureConfig[]) => {
    setStructuresState((prev) => update(prev));
  }, []);

  /** Edit settled: persist alongside the params (same version). */
  const commitStructures = useCallback(() => {
    if (paramsRef.current) scheduleSave(paramsRef.current, durationHours);
  }, [scheduleSave, durationHours]);

  const addStructure = useCallback(
    (type: StructureType) => {
      const existing = structuresRef.current.length;
      const [x, y] = defaultStructurePosition(type, existing, paramsRef.current?.originYKm ?? 150);
      const label = STRUCTURE_LABELS[type];
      const structure: StructureConfig = {
        id: `${type}-${Date.now().toString(36)}-${existing}`,
        type,
        name: `${label} ${structuresRef.current.filter((s) => s.type === type).length + 1}`,
        x_km: x,
        y_km: y,
        enabled: true,
      };
      setStructuresState((prev) => [...prev, structure]);
      commitStructures();
      return structure;
    },
    [commitStructures],
  );

  const removeStructure = useCallback(
    (id: string) => {
      setStructuresState((prev) => prev.filter((s) => s.id !== id));
      commitStructures();
    },
    [commitStructures],
  );

  const toggleStructure = useCallback(
    (id: string) => {
      setStructuresState((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
      commitStructures();
    },
    [commitStructures],
  );

  const renameStructure = useCallback(
    (id: string, name: string) => {
      setStructuresState((prev) => prev.map((s) => (s.id === id ? { ...s, name: name.slice(0, 80) } : s)));
      commitStructures();
    },
    [commitStructures],
  );

  const moveStructure = useCallback((id: string, xKm: number, yKm: number) => {
    setStructuresState((prev) => prev.map((s) => (s.id === id ? { ...s, x_km: xKm, y_km: yKm } : s)));
  }, []);

  // --- creating a new test ------------------------------------------------

  const createTest = useCallback(
    async (name: string, preset: DisasterPreset) => {
      setCreating(true);
      try {
        const detail = await scenarioApi.createScenario({
          name: name.trim() || preset.name,
          disaster_type: preset.disasterType,
          scenario_config: preset.config,
          version_label: `Preset: ${preset.name}`,
        });
        await loadScenarios(detail.id);
        return detail;
      } finally {
        setCreating(false);
      }
    },
    [loadScenarios],
  );

  const archiveTest = useCallback(
    async (id: string) => {
      await scenarioApi.archiveScenario(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
      setSelectedScenarioId((current) => (current === id ? null : current));
      if (selectedScenarioId === id) {
        const remaining = scenarios.filter((s) => s.id !== id);
        setSelectedScenarioId(remaining[0]?.id ?? null);
      }
    },
    [scenarios, selectedScenarioId],
  );

  // --- recording + replaying runs ----------------------------------------

  const recordRun = useCallback(async () => {
    if (!selectedScenarioId) return;
    if (lastRecordedRunTimer.current) window.clearTimeout(lastRecordedRunTimer.current);
    setLastRecordedRun(null);
    setRecording(true);
    setRunError(null);
    // The live preview may be mid-playback when Record is clicked; entering
    // replay must always start paused, never carry over a stale "playing"
    // state the transport controls (and the operator) don't expect.
    clock.pause();
    const startedAt = performance.now();
    try {
      // Make sure the version being run is the one on screen.
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (params) await persist(params, durationHours);
      }
      const created = await scenarioApi.createRun(selectedScenarioId, {
        timestep_config: { timestep_minutes: RECORDED_TIMESTEP_MINUTES },
      });
      const executed = await simulationApi.executeRun(created.id);
      const merged: SimulationRun = { ...created, ...executed };
      setRuns((prev) => [merged, ...prev]);
      setReplayRunId(merged.id);
      setLastRecordedRun({ frameCount: merged.frame_count ?? 0, durationMs: Math.round(performance.now() - startedAt) });
      lastRecordedRunTimer.current = window.setTimeout(() => setLastRecordedRun(null), 6000);
    } catch (err) {
      setRunError(errorMessage(err, "Recording failed"));
    } finally {
      setRecording(false);
    }
  }, [selectedScenarioId, params, durationHours, persist, clock]);

  useEffect(() => {
    if (!replayRunId) {
      startTransition(() => setReplayFrames([]));
      return;
    }
    let cancelled = false;
    startTransition(() => setReplayStatus("loading"));
    (async () => {
      try {
        const timeline = await simulationApi.getTimeline(replayRunId);
        if (cancelled) return;
        setReplayFrames(timeline.frames);
        setReplayStatus("idle");
        // A recorded run's own length, not whatever the live scenario's
        // duration slider happened to say — otherwise the scrubber range
        // doesn't match the frames actually available and playback clamps
        // to the last frame almost immediately, reading as frozen.
        const lastFrame = timeline.frames.at(-1);
        if (lastFrame) clock.setDuration(lastFrame.timestep * RECORDED_TIMESTEP_MINUTES);
        clock.restart();
      } catch (err) {
        if (cancelled) return;
        setReplayStatus("error");
        setRunError(errorMessage(err, "Failed to load recorded timeline"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [replayRunId, clock]);

  const exitReplay = useCallback(() => {
    setReplayRunId(null);
    // Restore the live scenario's own duration/position — replay just left
    // the clock set to the recorded run's length, not the live preview's.
    clock.pause();
    clock.setDuration(durationHours * 60);
    clock.restart();
  }, [clock, durationHours]);

  // --- the per-frame snapshot accessor -----------------------------------

  const coastDistanceKm = useMemo(
    () => (params ? distanceToCoastAlongHeading(params.originXKm, params.originYKm, params.headingDeg) : null),
    [params],
  );

  const snapshotCache = useRef<{ key: string; elapsed: number; snapshot: HazardSnapshot | null }>({ key: "", elapsed: -1, snapshot: null });
  const frameSource = useRef<{ kind: HazardKind | null; params: PropagationParams | null; frames: TimelineFrame[]; replay: boolean; structures: StructureConfig[] }>({ kind: null, params: null, frames: [], replay: false, structures: [] });
  useEffect(() => {
    frameSource.current = { kind, params, frames: replayFrames, replay: replayRunId !== null && replayFrames.length > 0, structures };
  }, [kind, params, replayFrames, replayRunId, structures]);

  const getSnapshot = useCallback((): HazardSnapshot | null => {
    const { kind: k, params: p, frames, replay, structures: placed } = frameSource.current;
    if (!k || !p) return null;
    const elapsed = clock.elapsedMinutes;
    const structureKey = placed.map((s) => `${s.id}:${s.x_km.toFixed(2)},${s.y_km.toFixed(2)},${s.enabled ? 1 : 0}`).join("|");
    const key = replay
      ? `replay:${frames.length}`
      : `live:${p.originXKm},${p.originYKm},${p.headingDeg},${p.speedKmh},${p.intensity},${p.spreadRadiusKm},${p.dispersionRate}|${structureKey}`;
    const cache = snapshotCache.current;
    if (cache.key === key && cache.elapsed === elapsed) return cache.snapshot;
    let snapshot: HazardSnapshot | null;
    if (replay) {
      const index = Math.min(frames.length - 1, Math.max(0, Math.round(elapsed / RECORDED_TIMESTEP_MINUTES)));
      const frame = frames[index];
      const state = frame.state as { hazard_state?: Record<string, unknown>; infrastructure_impacts?: StructureImpact[] };
      snapshot = snapshotFromRecordedFrame(k, (state.hazard_state ?? {}) as never, frame.timestep * RECORDED_TIMESTEP_MINUTES);
      // A recorded run carries the backend's own assessment for the
      // structures that existed when it was recorded — never re-derived.
      snapshot.impacts = state.infrastructure_impacts ?? [];
    } else {
      snapshot = computeHazard(k, p, elapsed);
      snapshot.impacts = assessStructures(placed, geometryFromSnapshot(snapshot));
    }
    snapshotCache.current = { key, elapsed, snapshot };
    return snapshot;
  }, [clock]);

  return {
    scenarios,
    scenariosStatus,
    scenariosError,
    reloadScenarios: loadScenarios,
    selectedScenarioId,
    setSelectedScenarioId,
    scenario,
    scenarioStatus,
    scenarioError,
    kind,

    params,
    setParams,
    commitParams,
    durationHours,
    setDurationHours,
    saveStatus,
    saveError,
    coastDistanceKm,

    structures,
    showStructures,
    setShowStructures,
    setStructures,
    commitStructures,
    addStructure,
    removeStructure,
    toggleStructure,
    renameStructure,
    moveStructure,

    createTest,
    creating,
    archiveTest,

    runs,
    recording,
    recordRun,
    runError,
    lastRecordedRun,
    replayRunId,
    replayStatus,
    replayFrames,
    setReplayRunId,
    exitReplay,

    getSnapshot,
  };
}

export const STRUCTURE_LABELS: Record<StructureType, string> = {
  building: "Town block",
  hospital: "Hospital",
  port: "Port",
  power_plant: "Power plant",
  lighthouse: "Lighthouse",
  fuel_terminal: "Fuel terminal",
};

export type ScenarioSession = ReturnType<typeof useScenarioSession>;
