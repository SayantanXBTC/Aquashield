import { lazy, Suspense, useRef } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoadingOverlay } from "@/components/ui";
import { useFadeIn } from "@/animations/micro-interactions/useFadeIn";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { LandingPage } from "@/features/landing/LandingPage";
import { ExploreGatewayPage } from "@/features/landing/ExploreGatewayPage";

// Both the command center (Three.js/R3F/drei) and the Prompt 6 scenario
// builder are kept out of the initial bundle — the landing page is the
// actual first thing a visitor loads, and neither route is part of that
// path (Prompt 8 "Lazy Loading — CRITICAL"). See
// docs/development/command-center.md "Lazy loading".
const CommandCenterPage = lazy(() => import("@/features/command-center/CommandCenterPage"));
const ScenarioBuilderFeature = lazy(() =>
  import("@/features/scenario-builder/ScenarioBuilderFeature").then((m) => ({ default: m.ScenarioBuilderFeature })),
);

const COMMAND_CENTER_LOADING_STAGES = ["Environment", "Simulation", "Visualization", "Command Systems"];

function CommandCenterRoute() {
  return (
    <Suspense fallback={<LoadingOverlay stages={COMMAND_CENTER_LOADING_STAGES} />}>
      <CommandCenterPage />
    </Suspense>
  );
}

/** Preserves the Prompt 6 Scenario Builder as its own route — Prompt 8
 * doesn't replace scenario CRUD, only adds the cinematic landing and the
 * read/execute-focused command center in front of it. */
function ScenariosRoute() {
  const { status, data } = useHealthCheck();
  const headerRef = useRef<HTMLDivElement | null>(null);
  useFadeIn(headerRef);

  return (
    <main className="bg-void text-ink min-h-screen">
      <header ref={headerRef} className="border-hairline border-b px-8 py-6">
        <h1 className="text-2xl font-semibold">AQUASHIELD</h1>
        <p className="text-ink-soft">Scenario Builder</p>
        <p className="text-ink-faint mt-2 text-xs">
          Backend:{" "}
          <span data-testid="health-status">
            {status === "loading" && "checking..."}
            {status === "ok" && `${data?.status} (${data?.service})`}
            {status === "error" && "unreachable"}
          </span>
        </p>
      </header>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <Suspense fallback={<p className="text-ink-faint text-xs">Loading scenario builder…</p>}>
          <ScenarioBuilderFeature />
        </Suspense>
      </div>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/explore" element={<ExploreGatewayPage />} />
        <Route path="/command-center" element={<CommandCenterRoute />} />
        <Route path="/scenarios" element={<ScenariosRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
