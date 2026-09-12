import { useState } from "react";
import { diagnosticStore, useDiagnostics } from "./diagnosticStore";
import { sampleCanvasCenterPixel } from "./diagnosticUtils";

/**
 * Floating developer HUD for isolating 3D render pipeline issues.
 * Only rendered in development mode (import.meta.env.DEV).
 */
export function DiagnosticPanel() {
  const [open, setOpen] = useState(false);
  const [sampledPixel, setSampledPixel] = useState<string | null>(null);
  const diag = useDiagnostics();

  if (!import.meta.env.DEV) return null;

  const handleSamplePixel = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      setSampledPixel("No canvas element found");
      return;
    }
    const pixel = sampleCanvasCenterPixel(canvas);
    if (!pixel) {
      setSampledPixel("Could not get WebGL context");
      return;
    }
    const result = `RGB(${pixel.r}, ${pixel.g}, ${pixel.b}) A:${pixel.a}`;
    setSampledPixel(result);
    console.log("📍 Canvas center-lower sampled pixel:", result);
  };

  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-30 flex flex-col items-start gap-2 text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="border-hairline-strong bg-abyss/85 text-ink-soft hover:text-ink rounded-[var(--radius-control)] border px-2 py-1 text-[10px] tracking-wide uppercase backdrop-blur-sm transition-colors"
      >
        3D Pipeline Debug {diag.enabled ? "(DIAG ON)" : ""}
      </button>

      {open && (
        <div className="flex w-72 flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-slate-200 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-semibold text-cyan-400">Diagnostic Isolation Controls</span>
            <button
              onClick={() => diagnosticStore.reset()}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Reset
            </button>
          </div>

          {/* Section 7: Obvious Diagnostic Materials */}
          <div className="flex items-center justify-between">
            <span>Diagnostic Materials:</span>
            <button
              onClick={() => diagnosticStore.set({ enabled: !diag.enabled })}
              className={`rounded px-2 py-0.5 font-medium ${
                diag.enabled ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-300"
              }`}
            >
              {diag.enabled ? "ON (MeshBasic)" : "OFF (Normal)"}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Replaces scene materials with neutral BasicMaterial: Gray Terrain, Cyan Water, Bright Coast/Infra/Hazard.
          </p>

          {/* Section 9: Normals & Wireframe */}
          <div className="mt-1 flex flex-col gap-1 border-t border-slate-800 pt-1">
            <span className="text-[11px] font-semibold text-slate-300">Terrain Inspection:</span>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {(["normal", "basic", "wireframe", "normals"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => diagnosticStore.set({ terrainMode: mode })}
                  className={`rounded py-0.5 capitalize ${
                    diag.terrainMode === mode ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Section 10: Fog Isolation */}
          <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-1">
            <span>Atmospheric Fog:</span>
            <button
              onClick={() => diagnosticStore.set({ fogEnabled: !diag.fogEnabled })}
              className={`rounded px-2 py-0.5 font-medium ${
                diag.fogEnabled ? "bg-cyan-700 text-white" : "bg-rose-800 text-white"
              }`}
            >
              {diag.fogEnabled ? "Fog ON" : "Fog OFF"}
            </button>
          </div>

          {/* Section 11: Tone Mapping Bypass */}
          <div className="flex items-center justify-between">
            <span>Tone Mapping:</span>
            <button
              onClick={() => diagnosticStore.set({ toneMapping: diag.toneMapping === "aces" ? "none" : "aces" })}
              className="rounded bg-slate-800 px-2 py-0.5 text-slate-300"
            >
              {diag.toneMapping.toUpperCase()}
            </button>
          </div>

          {/* Section 8: Camera & Scene Stats */}
          <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-1">
            <span>Camera & Scene Stats:</span>
            <button
              onClick={() => diagnosticStore.set({ showStats: !diag.showStats })}
              className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 hover:bg-slate-700"
            >
              {diag.showStats ? "Log to Console" : "Log Stats"}
            </button>
          </div>

          {/* Section 13: Pixel Sampling */}
          <div className="mt-1 flex flex-col gap-1 border-t border-slate-800 pt-1">
            <button
              onClick={handleSamplePixel}
              className="rounded bg-slate-800 py-1 text-[11px] text-cyan-300 hover:bg-slate-700"
            >
              🎯 Sample Canvas Center Pixel RGB
            </button>
            {sampledPixel && (
              <span className="text-center font-mono text-[11px] text-amber-300">{sampledPixel}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
