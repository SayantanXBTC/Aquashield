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
 * via aria-describedby (§38) — not just visually placed nearby. */
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
    "rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
        {required && <span aria-hidden="true"> *</span>}
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
        <p id={errorId} className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
