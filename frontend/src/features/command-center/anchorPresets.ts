import type { GeoAnchor } from "@/three/map/geoAnchor";

/**
 * Real, user-chosen locations for the "real_map" world profile — unlike
 * `presets.ts`'s disaster presets, real place names are correct here: this
 * profile's whole point is a real basemap (CLAUDE.md's rule against
 * real-world names in scenario data exists because the other profiles'
 * world is fictional; this one explicitly is not).
 */
export interface AnchorPreset {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

export const ANCHOR_PRESETS: AnchorPreset[] = [
  { id: "mumbai", label: "Mumbai coast, India", lat: 18.9388, lon: 72.8354 },
  { id: "sf-bay", label: "San Francisco Bay, USA", lat: 37.8199, lon: -122.4783 },
  { id: "singapore", label: "Singapore Strait", lat: 1.2644, lon: 103.8222 },
];

export const DEFAULT_ANCHOR: GeoAnchor = { lat: ANCHOR_PRESETS[0].lat, lon: ANCHOR_PRESETS[0].lon };
