import type { DisasterType } from "@shared/types";

const DISASTER_LABEL: Record<DisasterType, string> = {
  flood: "Flood",
  flash_flood: "Flash Flood",
  coastal_flood: "Coastal Flood",
  storm_surge: "Storm Surge",
  cyclone: "Cyclone",
  tsunami: "Tsunami",
  oil_spill: "Oil Spill",
  chemical_pollution: "Chemical Pollution",
  search_rescue: "Search & Rescue",
};

export function hazardLabel(disasterType: DisasterType): string {
  return DISASTER_LABEL[disasterType];
}
