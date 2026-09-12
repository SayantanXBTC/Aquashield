import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState } from "@/components/ui";
import { AquaCanvas } from "@/three/core/AquaCanvas";
import { SceneRoot, type SceneRootProps } from "@/three/core/SceneRoot";
import { DiagnosticPanel } from "@/three/diagnostics/DiagnosticPanel";

/** The full-bleed 3D world. Wrapped in its own error boundary so a WebGL
 * failure degrades to an actionable ErrorState instead of taking the HUD
 * down with it. The debug overlay only appears with `?debug=3d`. */
export function CommandCenterViewport(props: SceneRootProps) {
  const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "3d";
  return (
    <ErrorBoundary
      fallback={(retry) => (
        <div className="bg-abyss-2 flex h-full items-center justify-center p-8">
          <div className="max-w-sm">
            <ErrorState title="3D scene failed to initialize" detail="WebGL may be unavailable or disabled in this browser." onRetry={retry} />
          </div>
        </div>
      )}
    >
      <div className="absolute inset-0">
        <AquaCanvas>
          <SceneRoot {...props} />
        </AquaCanvas>
        {debug ? <DiagnosticPanel /> : null}
      </div>
    </ErrorBoundary>
  );
}
