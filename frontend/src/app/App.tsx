import { useRef } from "react";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { useFadeIn } from "@/animations/micro-interactions/useFadeIn";
import { ScenarioBuilderFeature } from "@/features/scenario-builder/ScenarioBuilderFeature";

export function App() {
  const { status, data } = useHealthCheck();
  const headerRef = useRef<HTMLDivElement | null>(null);
  useFadeIn(headerRef);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header ref={headerRef} className="border-b border-slate-800 px-8 py-6">
        <h1 className="text-2xl font-semibold">AQUASHIELD</h1>
        <p className="text-slate-400">Water Disaster Intelligence, Simulation &amp; Response Platform</p>
        <p className="mt-2 text-xs text-slate-600">
          Backend:{" "}
          <span data-testid="health-status">
            {status === "loading" && "checking..."}
            {status === "ok" && `${data?.status} (${data?.service})`}
            {status === "error" && "unreachable"}
          </span>
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-8 py-8">
        <ScenarioBuilderFeature />
      </div>
    </main>
  );
}
