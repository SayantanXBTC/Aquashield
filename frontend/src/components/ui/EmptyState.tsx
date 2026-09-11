interface EmptyStateProps {
  title: string;
  detail?: string;
}

/** For an async area that loaded successfully but has nothing to show yet
 * (e.g. a scenario with no simulation run) — distinct from ErrorState. */
export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="text-ink-soft text-xs font-semibold tracking-[0.14em] uppercase">{title}</span>
      {detail ? <p className="text-ink-faint max-w-xs text-xs">{detail}</p> : null}
    </div>
  );
}
