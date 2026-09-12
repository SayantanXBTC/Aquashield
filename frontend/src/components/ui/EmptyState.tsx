interface EmptyStateProps {
  title: string;
  detail?: string;
  /** Compact form for a panel body that sits in a dense rail. */
  dense?: boolean;
}

/** For an async area that loaded successfully but has nothing to show yet
 * (e.g. a scenario with no simulation run) — distinct from ErrorState. */
export function EmptyState({ title, detail, dense = false }: EmptyStateProps) {
  return (
    <div
      className={`border-hairline bg-abyss-2/60 flex flex-col gap-1.5 rounded-[var(--radius-control)] border border-dashed ${
        dense ? "px-3 py-3" : "px-4 py-5"
      }`}
    >
      <span className="text-ink-soft text-[11px] font-semibold tracking-[0.1em] uppercase">{title}</span>
      {detail ? <p className="text-ink-faint text-[11px] leading-relaxed">{detail}</p> : null}
    </div>
  );
}
