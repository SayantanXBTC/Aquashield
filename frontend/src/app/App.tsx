import { useRef } from "react";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { useFadeIn } from "@/animations/micro-interactions/useFadeIn";
import { BootstrapCanvas } from "@/three/core/BootstrapCanvas";

export function App() {
  const { status, data } = useHealthCheck();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFadeIn(panelRef);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col gap-6 p-8">
      <div ref={panelRef}>
        <h1 className="text-2xl font-semibold">AQUASHIELD — Bootstrap</h1>
        <p className="text-slate-400">
          Technology bootstrap only. No disaster features implemented yet.
        </p>
        <p className="mt-4 text-sm">
          Backend health:{" "}
          <span data-testid="health-status">
            {status === "loading" && "checking..."}
            {status === "ok" && `${data?.status} (${data?.service})`}
            {status === "error" && "unreachable"}
          </span>
        </p>
      </div>

      <div className="h-96 rounded-lg border border-slate-800">
        <BootstrapCanvas />
      </div>
    </main>
  );
}
