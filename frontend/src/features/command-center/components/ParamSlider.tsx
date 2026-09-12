import { useId } from "react";

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (value: number) => string;
  /** Live: fires on every movement. */
  onChange: (value: number) => void;
  /** Settled: pointer/key released — the moment to persist. */
  onCommit: () => void;
  disabled?: boolean;
  hint?: string;
}

/** One HUD slider: label + live mono readout + range input. `onChange`
 * updates the preview at input rate; `onCommit` fires once the gesture
 * ends so autosave never runs mid-drag. */
export function ParamSlider({ label, value, min, max, step, unit, format, onChange, onCommit, disabled = false, hint }: ParamSliderProps) {
  const id = useId();
  const text = format ? format(value) : value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-ink-faint text-[10px] tracking-[0.14em] uppercase">
          {label}
        </label>
        <span className="text-ink font-mono text-[11px]">
          {text}
          {unit ? <span className="text-ink-faint ml-1">{unit}</span> : null}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="disabled:opacity-40"
      />
      {hint ? <span className="text-ink-faint text-[10px]">{hint}</span> : null}
    </div>
  );
}
