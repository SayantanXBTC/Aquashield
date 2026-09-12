import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { DISASTER_ICON } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { DISASTER_PRESETS, type DisasterPreset } from "../presets";

interface NewTestModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, preset: DisasterPreset) => Promise<void>;
}

/** In-situ "New test": a name and a generic preset, nothing else. The test
 * is saved to the signed-in user's account immediately and becomes the
 * active scenario; every parameter is tuned inline afterwards. */
export function NewTestModal({ open, busy, onClose, onCreate }: NewTestModalProps) {
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState(DISASTER_PRESETS[0].id);
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
      await onCreate(name, preset);
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
