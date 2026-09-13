/**
 * Bundled curated real-city data (architecture.md ADR-009). Auto-discovers
 * whatever `shared/constants/towns/<city_id>.json` files are actually
 * committed — never a hardcoded 5-entry list, so a partially-built rollout
 * (today: Chennai only) never breaks the build for the other four.
 */
import type { CityId, TownProfile } from "@shared/types";

const modules = import.meta.glob("@shared/constants/towns/*.json", { eager: true }) as Record<string, { default: TownProfile }>;

export const TOWNS: Partial<Record<CityId, TownProfile>> = {};
for (const [path, mod] of Object.entries(modules)) {
  const id = path.split("/").pop()?.replace(".json", "") as CityId | undefined;
  if (id) TOWNS[id] = mod.default;
}

export function getTown(cityId: CityId | null | undefined): TownProfile | undefined {
  return cityId ? TOWNS[cityId] : undefined;
}
