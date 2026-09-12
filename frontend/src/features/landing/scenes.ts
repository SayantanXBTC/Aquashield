import scene1 from "./media/scene-1.webp";
import scene2 from "./media/scene-2.webp";
import scene3 from "./media/scene-3.webp";
import scene4 from "./media/scene-4.webp";
import scene5 from "./media/scene-5.webp";
import scene6 from "./media/scene-6.webp";

export interface LandingScene {
  id: string;
  image: string;
  alt: string;
  /** Small tracking-caps line above the title. */
  eyebrow: string;
  title: string;
  copy: string;
  /** Where the image's point of interest sits, as CSS `object-position`. */
  focus: string;
}

/**
 * The six photographic scenes of the landing scroll, in order. The first is
 * the hero (wordmark only), the last carries the sign-in call to action.
 * Copy is deliberately place-free — the platform's demo world is synthetic
 * (CLAUDE.md §25), so no scene names a real location.
 */
export const LANDING_SCENES: readonly LandingScene[] = [
  {
    id: "hero",
    image: scene1,
    alt: "Dark water meeting a silt shoreline, seen from above",
    eyebrow: "Water disaster intelligence",
    title: "AQUASHIELD",
    copy: "See the water coming.",
    focus: "50% 45%",
  },
  {
    id: "simulate",
    image: scene2,
    alt: "A tsunami wave breaking over a coastal treeline",
    eyebrow: "01 — Simulate",
    title: "The wave does not wait.",
    copy:
      "Deterministic demonstration models place a hazard on the water and carry it toward the shore under fixed rules — replayable to the frame, never guessed.",
    focus: "50% 40%",
  },
  {
    id: "hazards",
    image: scene5,
    alt: "A cyclone seen from orbit, its eye centred over open ocean",
    eyebrow: "02 — One world, every hazard",
    title: "Cyclone. Tsunami. Flood. Spill.",
    copy:
      "One shoreline world, one clock, one set of controls. Tune speed, intensity, spread and dispersion while the hazard is live and watch it answer.",
    focus: "50% 50%",
  },
  {
    id: "visualize",
    image: scene3,
    alt: "A cargo ship listing in storm surf beside a breakwater",
    eyebrow: "03 — Visualize",
    title: "Watch it reach the shore.",
    copy:
      "A live 3D shoreline with moving water, wavefronts, storm spirals and slicks. Drag the origin. Scrub the clock. Read the distance to landfall.",
    focus: "50% 55%",
  },
  {
    id: "analyze",
    image: scene6,
    alt: "A fishing vessel carried inland among wrecked houses after a tsunami",
    eyebrow: "04 — Analyze",
    title: "Exposure, never guesses.",
    copy:
      "Place ports, hospitals, fuel terminals and towns. Each is assessed against the hazard by fixed rules — potentially exposed, never invented damage.",
    focus: "50% 50%",
  },
  {
    id: "respond",
    image: scene4,
    alt: "A rescue helicopter hovering low over the sea as a swimmer drops in",
    eyebrow: "05 — Respond",
    title: "Brief the command room.",
    copy:
      "Three AI agents read the simulation, cite every number to evidence, and hand you priorities and actions — each one gated on human approval.",
    focus: "50% 45%",
  },
];
