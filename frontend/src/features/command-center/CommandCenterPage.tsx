import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { AnchorControl } from "./components/AnchorControl";
import { CommandCenterViewport } from "./components/CommandCenterViewport";
import { NewTestModal } from "./components/NewTestModal";
import { ParameterPanel } from "./components/ParameterPanel";
import { PlaybackBar } from "./components/PlaybackBar";
import { RunsPanel } from "./components/RunsPanel";
import { ScenarioTray } from "./components/ScenarioTray";
import { StructuresPanel } from "./components/StructuresPanel";
import { AgentExecutionHud } from "./components/AgentExecutionHud";
import { IntelligencePanel } from "./components/IntelligencePanel";
import { TelemetryPanel } from "./components/TelemetryPanel";
import { TopBar } from "./components/TopBar";
import { useAIOrchestrator } from "./ai/useAIOrchestrator";
import { useScenarioSession } from "./hooks/useScenarioSession";
import { usePlaybackClock } from "./playback/usePlaybackClock";

// maplibre-gl (and its custom-layer three.js bridge) stays out of every
// bundle but the one visit that actually opens a "real_map" test — lazy
// like the command center itself is lazy from the landing page (CLAUDE.md
// §27's build-output check covers this).
const MapCanvas = lazy(() => import("@/three/map/MapCanvas"));

const RECORDED_TIMESTEP_MINUTES = 15;
const WORLD_PROFILE_CYCLE = { demo: "dense_coastal", dense_coastal: "real_map", real_map: "demo" } as const;

/**
 * The AQUASHIELD command center — one full-bleed 3D shoreline world with
 * glass HUD overlays: tests tray + parameters on the left, telemetry +
 * recorded runs on the right, transport along the bottom. Arriving via the
 * post-login warp plays the camera entrance and reveals the HUD only once
 * the camera has landed.
 */
export function CommandCenterPage() {
  const clock = usePlaybackClock();
  const session = useScenarioSession(clock);
  // The AI layer follows the playhead on its own throttle/debounce — the
  // deterministic readouts below keep updating every frame regardless.
  const ai = useAIOrchestrator({
    scenarioId: session.selectedScenarioId,
    runs: session.runs,
    replayRunId: session.replayRunId,
    clock,
    recordedTimestepMinutes: RECORDED_TIMESTEP_MINUTES,
  });
  const location = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const [entrance] = useState(() => (location.state as { entrance?: string } | null)?.entrance === "warp" && !reducedMotion);
  const [hudVisible, setHudVisible] = useState(!entrance);
  const [hudOpen, setHudOpen] = useState(true);
  const [newTestOpen, setNewTestOpen] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);

  // Clear the router state so a reload doesn't replay the entrance.
  useEffect(() => {
    if (entrance) window.history.replaceState({}, "");
  }, [entrance]);

  // Dev aid: `?t=<minutes>` seeks the clock once a test is loaded, so a
  // headless screenshot can capture a specific moment. Dev builds only.
  useEffect(() => {
    if (!import.meta.env.DEV || !session.params) return;
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (Number.isFinite(t) && t > 0) clock.seek(t);
  }, [clock, session.params]);

  const replaying = session.replayRunId !== null;
  const originKm = useMemo<[number, number]>(
    () => (session.params ? [session.params.originXKm, session.params.originYKm] : [70, 150]),
    [session.params],
  );

  const handleOriginDrag = useCallback((x: number, y: number) => session.setParams({ originXKm: x, originYKm: y }), [session]);
  const handleOriginDragEnd = useCallback(() => session.commitParams(), [session]);
  // The real_map profile has no draggable pin (MapLibre owns pointer events),
  // so a click on the map places the origin and commits in one gesture.
  const handleOriginPick = useCallback((x: number, y: number) => session.setAndCommitParams({ originXKm: x, originYKm: y }), [session]);
  const handleEntranceComplete = useCallback(() => setHudVisible(true), []);
  const handleStructureDrag = useCallback((id: string, x: number, y: number) => session.moveStructure(id, x, y), [session]);
  const handleStructureDragEnd = useCallback(() => session.commitStructures(), [session]);
  const handleStructureSelect = useCallback((id: string | null) => setSelectedStructureId(id), []);

  const replayMarkers = useMemo(
    () => session.replayFrames.filter((f) => f.is_key_event && f.timestep > 0).map((f) => f.timestep * RECORDED_TIMESTEP_MINUTES),
    [session.replayFrames],
  );

  const hudMotion = {
    // Only animate the reveal when arriving via the warp; otherwise the HUD
    // is simply there (no first-paint flash, nothing to wait on).
    initial: entrance ? { opacity: 0, y: 8 } : false,
    animate: hudVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="bg-void relative h-screen w-screen overflow-hidden">
      {session.worldProfile === "real_map" ? (
        // The ONE sanctioned exception to "exactly one <Canvas>": this path
        // drives Three.js directly inside a MapLibre custom layer instead of
        // mounting <AquaCanvas>'s <Canvas> — see three/map/threeMapLayer.ts.
        // There is still never more than one Three.js renderer alive.
        <Suspense fallback={<div className="bg-abyss-2 absolute inset-0" />}>
          <MapCanvas
            kind={session.kind}
            originKm={originKm}
            headingDeg={session.params?.headingDeg ?? 90}
            coastDistanceKm={session.coastDistanceKm}
            getSnapshot={session.getSnapshot}
            anchor={session.anchor}
            onOriginPick={handleOriginPick}
            originLocked={replaying || !session.params}
            onCoastMeasured={session.setMeasuredCoastKm}
          />
        </Suspense>
      ) : (
        <CommandCenterViewport
          kind={session.kind}
          originKm={originKm}
          headingDeg={session.params?.headingDeg ?? 90}
          coastDistanceKm={session.coastDistanceKm}
          getSnapshot={session.getSnapshot}
          onOriginDrag={handleOriginDrag}
          onOriginDragEnd={handleOriginDragEnd}
          originLocked={replaying || !session.params}
          entrance={entrance}
          onEntranceComplete={handleEntranceComplete}
          worldProfile={session.worldProfile}
          structures={{
            structures: session.structures,
            visible: session.showStructures,
            onDrag: handleStructureDrag,
            onDragEnd: handleStructureDragEnd,
            locked: replaying || !session.params,
            selectedId: selectedStructureId,
            onSelect: handleStructureSelect,
          }}
        />
      )}

      {/* HUD layer — pointer-events pass through to the canvas except on the panels themselves. */}
      <motion.div {...hudMotion} className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
        <TopBar
          scenario={session.scenario}
          saveStatus={session.saveStatus}
          replaying={replaying}
          worldProfile={session.scenario ? session.worldProfile : undefined}
          onToggleWorldProfile={() => session.setWorldProfile(WORLD_PROFILE_CYCLE[session.worldProfile])}
        />

        <div className="relative z-10 flex min-h-0 flex-1 gap-3">
          <div className={`flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto pb-1 ${hudOpen ? "" : "hidden"}`}>
            <ScenarioTray
              scenarios={session.scenarios}
              status={session.scenariosStatus}
              error={session.scenariosError}
              selectedId={session.selectedScenarioId}
              onSelect={session.setSelectedScenarioId}
              onNew={() => setNewTestOpen(true)}
              onArchive={(id) => void session.archiveTest(id)}
              onRetry={() => void session.reloadScenarios()}
            />
            <ParameterPanel
              kind={session.kind}
              params={session.params}
              durationHours={session.durationHours}
              coastDistanceKm={session.coastDistanceKm}
              locked={replaying}
              onChange={session.setParams}
              onCommit={session.commitParams}
              onDurationChange={session.setDurationHours}
              originGesture={session.worldProfile === "real_map" ? "click" : "drag"}
            />
            {session.worldProfile === "real_map" ? (
              // Keyed by scenario so switching tests remounts fresh local
              // text state instead of an effect resyncing it (AnchorControl.tsx).
              <AnchorControl key={session.selectedScenarioId ?? "none"} anchor={session.anchor} onChange={session.setAnchor} locked={replaying} />
            ) : null}
            <AgentExecutionHud
              agents={ai.agents}
              status={ai.status}
              trigger={ai.lastTrigger}
              frameIndex={ai.targetRun ? ai.frameIndex : null}
              error={ai.error}
              onAnalyseNow={ai.analyseNow}
              disabled={!ai.targetRun}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-end">
            <div className="pointer-events-auto mb-1 self-start">
              <button
                type="button"
                onClick={() => setHudOpen((v) => !v)}
                aria-label={hudOpen ? "Hide side panels" : "Show side panels"}
                className="text-ink-soft hover:text-ink flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] border border-white/[0.07] bg-[rgba(9,14,20,0.66)] backdrop-blur-xl"
              >
                {hudOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            </div>
            <div className="mx-auto w-full max-w-2xl">
              <PlaybackBar clock={clock} disabled={!session.params} markers={replayMarkers} />
            </div>
          </div>

          <div className={`flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto pb-1 ${hudOpen ? "" : "hidden"}`}>
            <TelemetryPanel kind={session.kind} clock={clock} getSnapshot={session.getSnapshot} worldProfile={session.worldProfile} structures={session.structures} />
            <StructuresPanel
              structures={session.structures}
              visible={session.showStructures}
              onVisibleChange={session.setShowStructures}
              selectedId={selectedStructureId}
              onSelect={handleStructureSelect}
              onAdd={(type) => setSelectedStructureId(session.addStructure(type).id)}
              onRemove={session.removeStructure}
              onToggle={session.toggleStructure}
              onRename={session.renameStructure}
              getSnapshot={session.getSnapshot}
              locked={replaying || !session.params}
            />
            <RunsPanel
              runs={session.runs}
              recording={session.recording}
              error={session.runError}
              replayRunId={session.replayRunId}
              replayStatus={session.replayStatus}
              canRecord={Boolean(session.params)}
              onRecord={() => void session.recordRun()}
              onReplay={session.setReplayRunId}
              onExitReplay={session.exitReplay}
              lastRecordedRun={session.lastRecordedRun}
            />
            <IntelligencePanel
              brief={ai.brief}
              structures={session.structures}
              frameIndex={ai.frameIndex}
              briefIsBehind={ai.briefIsBehind}
              status={ai.status}
              provider={ai.provider}
            />
            {session.scenarioStatus === "error" && session.scenarioError ? (
              <p role="alert" className="text-status-critical pointer-events-auto rounded-[8px] border border-status-critical/40 bg-[rgba(9,14,20,0.8)] px-3 py-2 text-[11px] backdrop-blur-xl">
                {session.scenarioError}
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>

      <NewTestModal
        open={newTestOpen}
        busy={session.creating}
        onClose={() => setNewTestOpen(false)}
        onCreate={async (name, preset, worldProfile, anchor) => void (await session.createTest(name, preset, worldProfile, anchor))}
      />
    </div>
  );
}

export default CommandCenterPage;
