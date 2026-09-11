export function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-accent-strong/80 text-[10px] font-semibold tracking-[0.2em] uppercase">
      {children}
    </span>
  );
}
