import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { MetricTile } from "@/components/ui";
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { exposureFor, geometryFromSnapshot, statusFor } from "@/propagation/structures";
import { DEFAULT_SHORE, type ShoreParams } from "@/propagation/world";
import { buildBuildingPlacements } from "@/three/urban/buildingPlacement";
import { placementsFromTown } from "@/three/urban/realTownPlacements";
import type { StructureConfig, TownProfile, WorldProfile } from "../types";
import type { PlaybackClock } from "../playback/playbackClock";
import { HudPanel } from "./HudPanel";

interface TelemetryPanelProps {
  kind: HazardKind | null;
  clock: PlaybackClock;
  getSnapshot: () => HazardSnapshot | null;
  worldProfile?: WorldProfile;
  structures?: StructureConfig[];
  /** The curated real city's data (ADR-009), required to compute its real
   * building stats when worldProfile is "real_city". */
  town?: TownProfile;
}

const PHASE_LABEL = { offshore: "Offshore", landfall: "Landfall", inland: "Inland" } as const;
const PHASE_TONE = { offshore: "accent", landfall: "critical", inland: "warning" } as const;

function fmtKm(v: number | null | undefined, digits = 1): string | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : v.toFixed(digits);
}
function fmtMinutes(v: number | null | undefined): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v < 90) return `${v.toFixed(0)} min`;
  return `${(v / 60).toFixed(1)} h`;
}
function fmtClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `T+${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Live readouts for the current frame — remaining distance to the
 * mainland along the heading, ETA, phase, and the hazard's own headline
 * metric. Polls the snapshot at 8 Hz (a HUD cadence; the 3D scene reads at
 * frame rate). Every value comes from the propagation mirror or a recorded
 * frame; a missing one renders "—" (CLAUDE.md §27).
 */
export function TelemetryPanel({ kind, clock, getSnapshot, worldProfile, structures, town }: TelemetryPanelProps) {
  const [snap, setSnap] = useState<HazardSnapshot | null>(null);
  const dense = worldProfile === "dense_coastal" || worldProfile === "real_city";
  // TODO(Task 6): replace with the shared TownProfile-to-ShoreParams helper.
  const shore: ShoreParams = useMemo(() => (town ? { baseXKm: town.shore_base_x_km, terms: town.shore_terms, landSign: 1 } : DEFAULT_SHORE), [town]);

  useEffect(() => {
    const id = window.setInterval(() => setSnap(getSnapshot()), 125);
    return () => window.clearInterval(id);
  }, [getSnapshot, clock]);

  // Dense Coastal Profile's generic building field, or a curated real
  // city's real footprints (ADR-009) — the exact same deterministic
  // placement DenseBuildingLayer renders, and the exact same
  // exposureFor()/statusFor() functions named structures use. A real,
  // computed count, never a fabricated one.
  const clearings = useMemo(
    () => (structures ?? []).filter((s) => s.enabled !== false).map((s) => ({ xKm: s.x_km, yKm: s.y_km })),
    [structures],
  );
  const buildingPlacements = useMemo(
    () => (worldProfile === "real_city" && town ? placementsFromTown(town, clearings) : dense ? buildBuildingPlacements(clearings) : null),
    [worldProfile, town, dense, clearings],
  );
  const buildingStats = useMemo(() => {
    if (!buildingPlacements || !snap) return null;
    const all = [...buildingPlacements.low, ...buildingPlacements.mid, ...buildingPlacements.highrise];
    if (!all.length) return { impacted: 0, total: 0 };
    const geometry = geometryFromSnapshot(snap);
    const impacted = all.reduce((count, p) => {
      const [, exposure] = exposureFor(geometry, p.xKm, p.yKm, shore);
      return statusFor(exposure) === "clear" ? count : count + 1;
    }, 0);
    return { impacted, total: all.length };
  }, [buildingPlacements, snap, shore]);

  const headline = (() => {
    if (!snap) return { label: "Hazard", value: null as string | null, unit: undefined as string | undefined };
    switch (snap.kind) {
      case "tsunami":
        return { label: "Wave height", value: snap.waveHeightM?.toFixed(2) ?? null, unit: "m" };
      case "cyclone":
        return { label: "Peak wind", value: snap.windSpeedKt?.toFixed(0) ?? null, unit: "kt" };
      case "oil_spill":
        return { label: "Concentration", value: snap.concentrationIndex !== undefined ? (snap.concentrationIndex * 100).toFixed(0) : null, unit: "%" };
      case "coastal_flood":
        return { label: "Water level", value: snap.waterLevelM?.toFixed(2) ?? null, unit: "m" };
    }
  })();

  const secondary = (() => {
    if (!snap) return { label: "Radius", value: null as string | null, unit: "km" };
    switch (snap.kind) {
      case "tsunami":
        return { label: "Run-up inland", value: fmtKm(snap.inundationKm), unit: "km" };
      case "cyclone":
        return { label: "Wind field", value: fmtKm(snap.radiusKm, 0), unit: "km" };
      case "oil_spill":
        return { label: "Slick radius", value: fmtKm(snap.slickRadiusKm), unit: "km" };
      case "coastal_flood":
        return { label: "Inundation", value: fmtKm(snap.inundationKm), unit: "km" };
    }
  })();

  const phase = snap?.phase ?? null;
  const noLandfall = snap ? snap.front.coastDistanceTotalKm === null : false;

  return (
    <HudPanel
      id="telemetry"
      title="Telemetry"
      icon={<Activity className="h-3.5 w-3.5" />}
      aside={
        phase ? (
          <span className={`text-[10px] font-semibold tracking-[0.14em] uppercase ${phase === "landfall" ? "text-status-critical" : phase === "inland" ? "text-status-warning" : "text-accent-strong"}`}>
            {PHASE_LABEL[phase]}
          </span>
        ) : null
      }
      bodyClassName="grid grid-cols-2 gap-x-4 gap-y-3.5"
    >
      {!kind ? (
        <p className="text-ink-faint col-span-2 text-xs">No hazard on the water.</p>
      ) : (
        <>
          <MetricTile label="Sim clock" value={snap ? fmtClock(snap.elapsedMinutes) : null} />
          <MetricTile label="Phase" value={phase ? PHASE_LABEL[phase] : null} tone={phase ? PHASE_TONE[phase] : "default"} />
          <MetricTile
            label="To mainland"
            value={noLandfall ? "no landfall" : fmtKm(snap?.front.distanceToCoastKm)}
            unit={noLandfall ? undefined : "km"}
            tone={snap && snap.front.distanceToCoastKm !== null && snap.front.distanceToCoastKm < 15 && !snap.front.arrived ? "warning" : "default"}
          />
          <MetricTile label="ETA" value={noLandfall ? "—" : snap?.front.arrived ? "arrived" : fmtMinutes(snap?.front.etaMinutes)} tone={snap?.front.arrived ? "critical" : "default"} />
          <MetricTile label={headline.label} value={headline.value} unit={headline.unit} tone="accent" />
          <MetricTile label={secondary.label} value={secondary.value} unit={secondary.unit} />
          <MetricTile label="Travelled" value={fmtKm(snap?.front.traveledKm)} unit="km" />
          <MetricTile label="Heading" value={snap ? `${snap.params.headingDeg.toFixed(0)}°` : null} />
          <MetricTile
            label="Structures hit"
            value={snap?.impacts ? `${snap.impacts.filter((i) => i.exposure >= 0.05).length} / ${snap.impacts.length}` : null}
            tone={snap?.impacts?.some((i) => i.status === "severe") ? "critical" : snap?.impacts?.some((i) => i.exposure >= 0.05) ? "warning" : "default"}
          />
          <MetricTile
            label="Worst exposure"
            value={snap?.impacts && snap.impacts.length ? `${(Math.max(0, ...snap.impacts.map((i) => i.exposure)) * 100).toFixed(0)}` : null}
            unit="%"
          />
          {dense ? (
            <MetricTile
              label="Structures impacted"
              value={buildingStats ? `${buildingStats.impacted} / ${buildingStats.total}` : null}
              tone={buildingStats && buildingStats.impacted > 0 ? "warning" : "default"}
            />
          ) : null}
          <p className="text-ink-faint col-span-2 text-[10px] leading-relaxed tracking-[0.06em] uppercase">
            {worldProfile === "real_city" && town
              ? `${town.label} · real coastline & buildings, simplified physics · not an operational forecast`
              : dense
                ? "Dense Coastal Profile · potentially exposed, not damage · illustrative"
                : "Simplified demonstration model — not an official forecast"}
          </p>
        </>
      )}
    </HudPanel>
  );
}
