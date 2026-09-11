import { useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmptyState, ErrorState } from "@/components/ui";
import { AquaCanvas } from "@/three/core/AquaCanvas";
import { SceneRoot } from "@/three/core/SceneRoot";
import { toVisualState } from "@/three/adapters/simulationVisualAdapter";
import type { LatLon } from "@/three/utils/geoProjection";
import type { ScenarioDetail, SimulationState, TimelineFrame } from "../types";

interface CommandCenterViewportProps {
  scenario: ScenarioDetail | null;
  currentFrame: TimelineFrame | null;
}

/** The dominant 3D viewport. Wrapped in its own error boundary so a WebGL
 * or scene-graph failure degrades to an actionable ErrorState instead of
 * taking down the whole command center. */
export function CommandCenterViewport({ scenario, currentFrame }: CommandCenterViewportProps) {
  const scenarioLocation: LatLon | null =
    scenario?.latitude != null && scenario?.longitude != null
      ? { latitude: scenario.latitude, longitude: scenario.longitude }
      : null;

  const visualState = useMemo(() => {
    if (!currentFrame) return null;
    // TimelineFrame.state is typed as Record<string, unknown> in the
    // canonical shared contract (it's disaster-specific and stays
    // unconstrained there); the backend's actual payload matches
    // SimulationState exactly (backend/app/schemas/simulation.py) — this is
    // the one place that assumption is made explicit.
    return toVisualState(currentFrame.state as unknown as SimulationState);
  }, [currentFrame]);

  if (!scenario) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState title="No scenario selected" detail="Choose a scenario from the panel on the left." />
      </div>
    );
  }

  if (!scenarioLocation) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState title="Scenario has no location" detail="This scenario was created without coordinates." />
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={(retry) => (
        <div className="flex h-full items-center justify-center">
          <ErrorState title="3D scene failed to initialize" detail="WebGL may be unavailable in this browser." onRetry={retry} />
        </div>
      )}
    >
      <AquaCanvas>
        <SceneRoot scenarioLocation={scenarioLocation} scenarioName={scenario.name} visualState={visualState} />
      </AquaCanvas>
    </ErrorBoundary>
  );
}
