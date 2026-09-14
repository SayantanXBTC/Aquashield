import { useState } from "react";
import type { GeoAnchor } from "@/three/map/geoAnchor";
import { ANCHOR_PRESETS } from "../anchorPresets";

interface AnchorControlProps {
  anchor: GeoAnchor;
  onChange: (anchor: GeoAnchor) => void;
  locked?: boolean;
}

/** Where the "real_map" world profile's km frame sits on the real earth —
 * a real, user-chosen location (CLAUDE.md's real_map exception to "never a
 * real place"). Edits apply on blur/preset click, not per keystroke, so an
 * in-progress digit never triggers a scenario save.
 *
 * Local text state only tracks the incoming `anchor` on mount, not on every
 * prop change — an external change (loading a different scenario) is
 * handled by the caller remounting this component with a `key`, rather than
 * an effect resyncing state that would otherwise also stomp on an
 * in-progress edit whenever a commit round-trips the same value back. */
export function AnchorControl({ anchor, onChange, locked = false }: AnchorControlProps) {
  const [lat, setLat] = useState(String(anchor.lat));
  const [lon, setLon] = useState(String(anchor.lon));

  const commit = (nextLat: string, nextLon: string) => {
    const parsedLat = Number(nextLat);
    const parsedLon = Number(nextLon);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLon)) onChange({ lat: parsedLat, lon: parsedLon });
  };

  return (
    <section className="border-hairline-strong bg-surface-raised/60 pointer-events-auto rounded-[10px] border p-3 backdrop-blur-xl">
      <h3 className="text-ink-faint mb-2 text-[10px] tracking-[0.14em] uppercase">Anchor location</h3>
      <div className="mb-2 flex gap-2">
        <label className="flex-1">
          <span className="text-ink-faint mb-1 block text-[10px]">Latitude</span>
          <input
            type="number"
            step="0.0001"
            min={-90}
            max={90}
            value={lat}
            disabled={locked}
            onChange={(e) => setLat(e.target.value)}
            onBlur={() => commit(lat, lon)}
            className="text-ink h-8 w-full rounded-md border border-white/[0.08] bg-white/5 px-2 text-xs outline-none focus:border-accent/40 disabled:opacity-50"
          />
        </label>
        <label className="flex-1">
          <span className="text-ink-faint mb-1 block text-[10px]">Longitude</span>
          <input
            type="number"
            step="0.0001"
            min={-180}
            max={180}
            value={lon}
            disabled={locked}
            onChange={(e) => setLon(e.target.value)}
            onBlur={() => commit(lat, lon)}
            className="text-ink h-8 w-full rounded-md border border-white/[0.08] bg-white/5 px-2 text-xs outline-none focus:border-accent/40 disabled:opacity-50"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ANCHOR_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={locked}
            onClick={() => onChange({ lat: p.lat, lon: p.lon })}
            className="text-ink-soft hover:text-ink hover:bg-white/[0.06] cursor-pointer rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
