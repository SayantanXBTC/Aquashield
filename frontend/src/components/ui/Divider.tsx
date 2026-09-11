export function Divider({ className = "" }: { className?: string }) {
  return <div role="separator" className={`border-hairline border-t ${className}`} />;
}
