import observe from "@/assets/landing/image1.jpg";
import cyclone from "@/assets/landing/image5.jpg";
import tsunami from "@/assets/landing/image2.jpg";
import flood from "@/assets/landing/image6.jpg";
import marine from "@/assets/landing/image3.jpg";
import rescue from "@/assets/landing/image4.jpg";

export interface LandingBeat {
  id: string;
  src: string;
  alt: string;
  eyebrow: string;
  headline: string;
  body: string;
}

/**
 * Explicit asset -> beat mapping, kept in one place instead of scattering
 * import paths through ScrollSequence.tsx. These are the six images
 * provided for this phase — resized/re-encoded for web delivery
 * (frontend/src/assets/landing/*.jpg, originals in repo-root assets/) but
 * not replaced or substituted. Each is real photography of a real
 * disaster/response category, not a generated placeholder.
 */
export const LANDING_BEATS: LandingBeat[] = [
  {
    id: "enter",
    src: observe,
    alt: "A duck resting on the still, dark surface of a river, seen from directly above.",
    eyebrow: "AQUASHIELD",
    headline: "Simulate. Understand. Respond.",
    body: "A disaster-agnostic platform for water-related emergencies — before, during, and after they happen.",
  },
  {
    id: "cyclone",
    src: cyclone,
    alt: "A tropical cyclone viewed from orbit, its eye fully formed over open ocean.",
    eyebrow: "Cyclone",
    headline: "Track the storm as it forms.",
    body: "Wind intensity, track, and hazard radius, modeled from the moment a system develops.",
  },
  {
    id: "tsunami",
    src: tsunami,
    alt: "A tsunami wave breaking violently over a stand of coastal trees.",
    eyebrow: "Tsunami",
    headline: "See the wave before it arrives.",
    body: "Propagation, wave height, and coastal arrival time — from source to shoreline.",
  },
  {
    id: "flood",
    src: flood,
    alt: "An inundated coastal town, streets buried under storm and wave debris.",
    eyebrow: "Flood",
    headline: "Watch the water rise.",
    body: "Inundation extent and water level, evolving hour by hour across the affected area.",
  },
  {
    id: "oil_spill",
    src: marine,
    alt: "A grounded vessel breaking apart in heavy surf.",
    eyebrow: "Marine Pollution",
    headline: "Contain what the sea won't.",
    body: "Slick drift, spreading concentration, and windage — from spill to shoreline threat.",
  },
  {
    id: "search_rescue",
    src: rescue,
    alt: "A U.S. Coast Guard helicopter hoisting a swimmer from open water.",
    eyebrow: "Search & Rescue",
    headline: "Narrow the search, faster.",
    body: "Drift trajectory and probable-area modeling to focus a response before conditions change.",
  },
];

export const LANDING_IMAGE_CREDIT =
  "Historical and illustrative disaster photography — not live simulation output.";
