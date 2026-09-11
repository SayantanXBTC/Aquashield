interface FormFieldProps {
  id: string;
  label: string;
  type?: "text" | "number" | "datetime-local";
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  as?: "input" | "textarea";
}

/** A labeled field whose error, when present, is programmatically associated
 * via aria-describedby (§38) — not just visually placed nearby. Uses the
 * AQUASHIELD design tokens (frontend/src/styles/tokens.css) rather than raw
 * Tailwind slate/sky classes, so the Scenario Builder matches the Command
 * Center's visual language instead of reading as a generic SaaS form
 * (Prompt 9.1 §C). */
export function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  required,
  placeholder,
  min,
  max,
  step,
  as = "input",
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const sharedClassName =
    "bg-surface border-hairline-strong text-ink placeholder:text-ink-faint focus-visible:ring-accent-strong rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-soft text-xs font-medium tracking-wide">
        {label}
        {required && (
          <span aria-hidden="true" className="text-accent-strong">
            {" "}
            *
          </span>
        )}
      </label>
      {as === "textarea" ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={sharedClassName}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={sharedClassName}
        />
      )}
      {error && (
        <p id={errorId} className="text-status-critical text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
