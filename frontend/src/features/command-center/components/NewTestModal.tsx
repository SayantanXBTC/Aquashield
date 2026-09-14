import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { DISASTER_ICON } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { GeoAnchor } from "@/three/map/geoAnchor";
import { ANCHOR_PRESETS, DEFAULT_ANCHOR } from "../anchorPresets";
import { DISASTER_PRESETS, type DisasterPreset } from "../presets";
import type { WorldProfile } from "../types";

interface NewTestModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, preset: DisasterPreset, worldProfile: WorldProfile, anchor?: GeoAnchor) => Promise<void>;
}

/** In-situ "New test": a name and a generic preset, nothing else. The test
 * is saved to the signed-in user's account immediately and becomes the
 * active scenario; every parameter is tuned inline afterwards. */
export function NewTestModal({ open, busy, onClose, onCreate }: NewTestModalProps) {
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState(DISASTER_PRESETS[0].id);
  const [worldProfile, setWorldProfile] = useState<WorldProfile>("demo");
  const [anchor, setAnchor] = useState<GeoAnchor>(DEFAULT_ANCHOR);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const preset = DISASTER_PRESETS.find((p) => p.id === presetId) ?? DISASTER_PRESETS[0];

  const close = () => {
    setError(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onCreate(name, preset, worldProfile, worldProfile === "real_map" ? anchor : undefined);
      setName("");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the test");
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,11,0.55)] p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-test-title"
            onSubmit={(e) => void submit(e)}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-[10px] border border-white/[0.08] bg-[rgba(9,14,20,0.9)] p-5 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="new-test-title" className="text-ink text-sm font-semibold tracking-[0.16em] uppercase">
                New test
              </h2>
              <button type="button" onClick={close} aria-label="Close" className="text-ink-faint hover:text-ink cursor-pointer rounded-[4px] p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="text-ink-faint mb-1.5 block text-[10px] tracking-[0.14em] uppercase" htmlFor="new-test-name">
              Name
            </label>
            <input
              id="new-test-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={preset.name}
              maxLength={120}
              autoFocus
              className="text-ink mb-4 h-10 w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-accent/40 focus:bg-white/10"
            />

            <span className="text-ink-faint mb-1.5 block text-[10px] tracking-[0.14em] uppercase">Preset</span>
            <div role="radiogroup" className="mb-4 grid grid-cols-2 gap-2">
              {DISASTER_PRESETS.map((p) => {
                const Icon = DISASTER_ICON[p.disasterType];
                const active = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPresetId(p.id)}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      active ? "border-accent/50 bg-accent/12" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
                    )}
                  >
                    <span className={cn("flex items-center gap-2 text-xs font-medium", active ? "text-accent-strong" : "text-ink")}>
                      {Icon ? <Icon size={14} /> : null}
                      {p.name}
                    </span>
                    <span className="text-ink-faint text-[11px] leading-snug">{p.blurb}</span>
                  </button>
                );
              })}
            </div>

            <span className="text-ink-faint mb-1.5 block text-[10px] tracking-[0.14em] uppercase">World</span>
            <div role="radiogroup" className="mb-4 grid grid-cols-3 gap-2">
              {(
                [
                  { id: "demo", label: "Demo World", blurb: "Default procedural shoreline." },
                  { id: "dense_coastal", label: "Dense Coastal", blurb: "Flat canvas, generic buildings." },
                  { id: "real_map", label: "Real Basemap", blurb: "Real coastline & buildings, simplified hazard model." },
                ] as const
              ).map((w) => {
                const active = w.id === worldProfile;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setWorldProfile(w.id)}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      active ? "border-accent/50 bg-accent/12" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
                    )}
                  >
                    <span className={cn("text-xs font-medium", active ? "text-accent-strong" : "text-ink")}>{w.label}</span>
                    <span className="text-ink-faint text-[11px] leading-snug">{w.blurb}</span>
                  </button>
                );
              })}
            </div>

            {worldProfile === "real_map" ? (
              <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <span className="text-ink-faint mb-1.5 block text-[10px] tracking-[0.14em] uppercase">Anchor location</span>
                <div className="mb-2 flex gap-2">
                  <label className="flex-1">
                    <span className="text-ink-faint mb-1 block text-[10px]">Latitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      min={-90}
                      max={90}
                      value={anchor.lat}
                      onChange={(e) => setAnchor((a) => ({ ...a, lat: Number(e.target.value) }))}
                      className="text-ink h-9 w-full rounded-md border border-white/[0.08] bg-white/5 px-2 text-xs outline-none focus:border-accent/40"
                    />
                  </label>
                  <label className="flex-1">
                    <span className="text-ink-faint mb-1 block text-[10px]">Longitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      min={-180}
                      max={180}
                      value={anchor.lon}
                      onChange={(e) => setAnchor((a) => ({ ...a, lon: Number(e.target.value) }))}
                      className="text-ink h-9 w-full rounded-md border border-white/[0.08] bg-white/5 px-2 text-xs outline-none focus:border-accent/40"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ANCHOR_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAnchor({ lat: p.lat, lon: p.lon })}
                      className="text-ink-soft hover:text-ink hover:bg-white/[0.06] cursor-pointer rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px]"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-ink-faint mt-2 text-[10px] leading-snug">
                  Real coastline &amp; buildings from a real basemap; the hazard itself is still the same simplified demonstration model — not an operational forecast.
                </p>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-status-critical mb-3 text-[11px]">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={close} className="text-ink-soft hover:text-ink cursor-pointer rounded-[var(--radius-control)] px-3 py-2 text-xs">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="bg-ink text-void hover:bg-white cursor-pointer rounded-[var(--radius-control)] px-4 py-2 text-xs font-semibold tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create test"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
