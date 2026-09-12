/** A minor heading inside a panel body. Muted, not accent-colored — the
 * accent is reserved for interactive/active state so it keeps meaning. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-ink-faint text-[10px] font-semibold tracking-[0.18em] uppercase">{children}</span>
  );
}
