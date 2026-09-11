import { useState } from "react";
import { ScenarioBuilderPage } from "./components/ScenarioBuilderPage";
import { ScenarioDetailPage } from "./components/ScenarioDetailPage";
import { ScenarioListPage } from "./components/ScenarioListPage";

type View = { name: "list" } | { name: "create" } | { name: "detail"; scenarioId: string };

/**
 * Feature-local view switching — no router is installed yet (ADR-001 notes
 * one will be added "if needed"; this feature doesn't need URL-addressable
 * routes to be functional, so it doesn't force that decision). Swap this for
 * real routes when the app grows enough views to need them.
 */
export function ScenarioBuilderFeature() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return (
      <ScenarioBuilderPage
        onCreated={(scenarioId) => setView({ name: "detail", scenarioId })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "detail") {
    return (
      <ScenarioDetailPage
        scenarioId={view.scenarioId}
        onBack={() => setView({ name: "list" })}
        onDuplicated={(scenarioId) => setView({ name: "detail", scenarioId })}
      />
    );
  }

  return (
    <ScenarioListPage
      onCreateNew={() => setView({ name: "create" })}
      onView={(scenarioId) => setView({ name: "detail", scenarioId })}
    />
  );
}
