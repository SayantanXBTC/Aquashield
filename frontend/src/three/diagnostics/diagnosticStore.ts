import { useSyncExternalStore } from "react";

export interface DiagnosticSettings {
  /** Replaces scene materials with neutral diagnostic MeshBasicMaterial */
  enabled: boolean;
  /** Terrain visualization mode */
  terrainMode: "normal" | "basic" | "wireframe" | "normals";
  /** Whether scene fog is enabled */
  fogEnabled: boolean;
  /** Tone mapping bypass */
  toneMapping: "aces" | "none";
  /** Display live camera & scene diagnostic statistics */
  showStats: boolean;
}

let settings: DiagnosticSettings = {
  enabled: false,
  terrainMode: "normal",
  fogEnabled: true,
  toneMapping: "aces",
  showStats: false,
};

const listeners = new Set<() => void>();

export const diagnosticStore = {
  get: () => settings,
  set: (partial: Partial<DiagnosticSettings>) => {
    settings = { ...settings, ...partial };
    listeners.forEach((l) => l());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reset: () => {
    settings = {
      enabled: false,
      terrainMode: "normal",
      fogEnabled: true,
      toneMapping: "aces",
      showStats: false,
    };
    listeners.forEach((l) => l());
  },
};

export function useDiagnostics(): DiagnosticSettings {
  return useSyncExternalStore(
    diagnosticStore.subscribe,
    diagnosticStore.get,
    diagnosticStore.get,
  );
}
