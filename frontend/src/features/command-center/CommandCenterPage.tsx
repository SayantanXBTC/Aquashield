import { useMemo } from "react";
import { toVisualState } from "@/three/adapters/simulationVisualAdapter";
import { CommandCenterHeader } from "./components/CommandCenterHeader";
import { CommandCenterViewport } from "./components/CommandCenterViewport";
import { DataLayersPanel } from "./components/DataLayersPanel";
import { GeographicContextPanel } from "./components/GeographicContextPanel";
import { ImpactPanel } from "./components/ImpactPanel";
import { ScenarioContextPanel } from "./components/ScenarioContextPanel";
import { SimulationStatusPanel } from "./components/SimulationStatusPanel";
import { useCommandCenterSession } from "./hooks/useCommandCenterSession";
import { useDataLayers } from "./hooks/useDataLayers";
import type { SimulationState } from "./types";

/**
 * The AQUASHIELD command center — the real 3D-dominant application shell
 * Prompt 8 establishes. Command panels float as overlays on the viewport
 * rather than splitting it into a sidebar/content grid (Prompt 8 "Panels
 * should feel like overlays on a command environment").
 */
export function CommandCenterPage() {
  const session = useCommandCenterSession();

  const currentFrameLabel = useMemo(() => {
    if (!session.currentFrame) return null;
    return toVisualState(session.currentFrame.state as unknown as SimulationState).label;
  }, [session.currentFrame]);

  const runCompleted = session.runDetail?.status === "completed";
  const scenarioLatitude = session.scenarioDetail?.latitude ?? null;
  const scenarioLongitude = session.scenarioDetail?.longitude ?? null;
  // Stable object identity across renders (keyed on the primitive values, not
  // scenarioDetail itself) so useDataLayers's coastline-fetch effect can
  // safely depend on the object without an eslint-disable or a re-fetch loop.
  const scenarioLocation = useMemo(
    () => (scenarioLatitude != null && scenarioLongitude != null ? { latitude: scenarioLatitude, longitude: scenarioLongitude } : null),
    [scenarioLatitude, scenarioLongitude],
  );
  const dataLayers = useDataLayers({
    runId: session.runDetail?.id ?? null,
    runCompleted,
    frameIndex: session.frameIndex,
    scenarioLocation,
  });

  return (
    <div className="bg-void flex h-screen w-screen flex-col overflow-hidden">
      <CommandCenterHeader scenario={session.scenarioDetail} runStatus={session.runDetail?.status} />

      <div className="relative flex-1">
        <div className="absolute inset-0">
          <CommandCenterViewport
            scenario={session.scenarioDetail}
            currentFrame={session.currentFrame}
            dataLayers={{
              enabled: dataLayers.enabled,
              hazardFootprint: dataLayers.hazardFootprint,
              exposureResults: dataLayers.exposureResults,
              coastlineFeatures: dataLayers.coastlineFeatures,
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 md:p-4">
          <div className="pointer-events-auto flex max-h-full w-full flex-col gap-3 overflow-y-auto md:w-80">
            <ScenarioContextPanel
              scenarios={session.scenarios}
              scenariosStatus={session.scenariosStatus}
              scenariosError={session.scenariosError}
              selectedScenarioId={session.selectedScenarioId}
              onSelectScenario={session.setSelectedScenarioId}
              scenario={session.scenarioDetail}
              scenarioStatus={session.scenarioStatus}
              scenarioError={session.scenarioError}
            />
            <DataLayersPanel
              enabled={dataLayers.enabled}
              onToggle={dataLayers.toggleLayer}
              hazardFootprint={dataLayers.hazardFootprint}
              exposureResults={dataLayers.exposureResults}
              infrastructureCount={dataLayers.infrastructureCount}
              coastlineFeatureCount={dataLayers.coastlineFeatures.length}
              dataQuality={dataLayers.dataQuality}
              hasRun={runCompleted}
            />
            <ImpactPanel impact={dataLayers.impact} hasRun={runCompleted} />
            <GeographicContextPanel
              scenarioLocation={scenarioLocation}
              coastlineFeatures={dataLayers.coastlineFeatures}
              infrastructureCount={dataLayers.infrastructureCount}
            />
          </div>

          <div className="pointer-events-auto w-full md:ml-auto md:w-96">
            <SimulationStatusPanel
              runs={session.runs}
              selectedRunId={session.selectedRunId}
              onSelectRun={session.setSelectedRunId}
              runDetail={session.runDetail}
              runStatus={session.runStatus}
              runError={session.runError}
              executing={session.executing}
              onExecute={() => void session.executeRun()}
              creatingRun={session.creatingRun}
              onCreateRun={() => void session.createRun()}
              hasRuns={session.runs.length > 0}
              frames={session.frames}
              timelineStatus={session.timelineStatus}
              timelineError={session.timelineError}
              frameIndex={session.frameIndex}
              onFrameIndexChange={session.setFrameIndex}
              currentFrameLabel={currentFrameLabel}
              isPlaying={session.isPlaying}
              onTogglePlay={session.togglePlay}
              playbackSpeed={session.playbackSpeed}
              onPlaybackSpeedChange={session.setPlaybackSpeed}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandCenterPage;
