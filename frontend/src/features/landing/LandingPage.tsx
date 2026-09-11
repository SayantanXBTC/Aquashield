import { Link } from "react-router-dom";
import { ScrollSequence } from "./ScrollSequence";
import { LANDING_IMAGE_CREDIT } from "./landingAssets";

/** The landing route ("/") — the six-beat scroll sequence, ending in a
 * link into the dedicated "/explore" gateway (its own route, not a modal,
 * per Prompt 8's routing architecture). */
export function LandingPage() {
  return (
    <main className="bg-void relative">
      <div aria-hidden="true" className="text-ink-soft fixed top-5 left-5 z-20 text-xs font-bold tracking-[0.25em]">
        AQUASHIELD
      </div>

      <ScrollSequence />

      <section className="flex h-[40vh] w-full flex-col items-center justify-center gap-4 text-center">
        <Link
          to="/explore"
          className="text-accent-strong hover:text-accent-strong focus-visible:ring-accent-strong rounded-full text-xs font-semibold tracking-[0.3em] uppercase transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
        >
          Continue →
        </Link>
      </section>

      <footer className="text-ink-faint px-6 py-6 text-center text-[10px] tracking-wide">
        {LANDING_IMAGE_CREDIT}
      </footer>
    </main>
  );
}
