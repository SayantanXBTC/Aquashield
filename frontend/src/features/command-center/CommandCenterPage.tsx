import { useMemo } from "react";
import { toVisualState } from "@/three/adapters/simulationVisualAdapter";
import { CommandCenterHeader } from "./components/CommandCenterHeader";
import { CommandCenterViewport } from "./components/CommandCenterViewport";
import { ScenarioContextPanel } from "./components/ScenarioContextPanel";
import { SimulationStatusPanel } from "./components/SimulationStatusPanel";
import { useCommandCenterSession } from "./hooks/useCommandCenterSession";
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

  return (
    <div className="bg-void flex h-screen w-screen flex-col overflow-hidden">
      <CommandCenterHeader scenario={session.scenarioDetail} runStatus={session.runDetail?.status} />

      <div className="relative flex-1">
        <div className="absolute inset-0">
          <CommandCenterViewport scenario={session.scenarioDetail} currentFrame={session.currentFrame} />
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 md:p-4">
          <div className="pointer-events-auto w-full md:w-80">
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
          </div>

          <div className="pointer-events-auto w-full md:ml-auto md:w-96">
            <SimulationStatusPanel
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
