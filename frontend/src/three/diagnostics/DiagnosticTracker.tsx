import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDiagnostics } from "./diagnosticStore";
import { logCameraAndSceneDiagnostics } from "./diagnosticUtils";

/**
 * Development-only scene tracker that monitors camera, renderer, and scene state.
 * Runs inside AquaCanvas.
 */
export function DiagnosticTracker() {
  const { toneMapping, showStats } = useDiagnostics();
  const three = useThree();
  const loggedRef = useRef(false);

  // Apply tone mapping bypass
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    three.gl.toneMapping = toneMapping === "aces" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  }, [three.gl, toneMapping]);

  // Log scene diagnostics when showStats is enabled
  useEffect(() => {
    if (showStats && !loggedRef.current) {
      logCameraAndSceneDiagnostics(three.camera, three.scene);
      loggedRef.current = true;
    } else if (!showStats) {
      loggedRef.current = false;
    }
  }, [showStats, three.camera, three.scene]);

  return null;
}
