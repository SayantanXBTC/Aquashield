/**
 * Static legibility gradient over the image stage — bottom-up for the
 * typography block, a subtle left darken for the eyebrow/headline column.
 * Never animated: it's the one visual constant that keeps the six scenes
 * feeling like one continuous stage rather than six independent images.
 */
export function OverlayGradient() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="from-void/95 via-void/45 absolute inset-0 bg-gradient-to-t to-transparent" />
      <div className="from-void/75 absolute inset-0 bg-gradient-to-r to-transparent" />
    </div>
  );
}
