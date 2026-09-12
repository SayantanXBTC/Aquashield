import type { ReactElement, SVGProps } from "react";

/**
 * The application's only icon set — inline, single-stroke SVG paths on a
 * shared 24x24 grid at a uniform 1.6 stroke width.
 *
 * Three rules this file exists to enforce (CLAUDE.md §27 / ui-ux-pro-max
 * "Icons & Visual Elements"):
 *  1. NEVER an emoji as a structural icon — emoji are font-dependent and
 *     can't be driven by a design token.
 *  2. One family, one stroke width, one grid. A new icon is added here, not
 *     inlined ad hoc in a feature component.
 *  3. Icons are decorative by default (`aria-hidden`); a caller that uses an
 *     icon as the *only* content of a control must supply its own accessible
 *     name (see IconButton).
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconWave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 15c2.5 0 2.5-2.5 5-2.5S9.5 15 12 15s2.5-2.5 5-2.5S19.5 15 22 15" />
      <path d="M2 19.5c2.5 0 2.5-2.5 5-2.5s2.5 2.5 5 2.5 2.5-2.5 5-2.5 2.5 2.5 5 2.5" />
      <path d="M5 10.5C5 6.9 8 4 12 4s7 2.9 7 6.5" />
    </Svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Svg>
  );
}

export function IconFootprint(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 20 9v8l-8 4.5L4 17V9l8-5.5Z" />
      <circle cx="12" cy="12.5" r="3" />
    </Svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 21V6.5L11 3v18" />
      <path d="M11 10h9v11" />
      <path d="M7 9.5h.01M7 13.5h.01M7 17.5h.01M15 14h.01M15 17.5h.01" />
    </Svg>
  );
}

export function IconHospital(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M12 9v7M8.5 12.5h7" />
    </Svg>
  );
}

export function IconPort(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="4.75" r="1.75" />
      <path d="M12 6.5V20" />
      <path d="M8 10h8" />
      <path d="M4.5 14.5A7.5 7.5 0 0 0 12 20a7.5 7.5 0 0 0 7.5-5.5" />
    </Svg>
  );
}

export function IconPower(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2.5 5.5 13.5H11l-1 8 8.5-11.5H13l1-7.5Z" />
    </Svg>
  );
}

export function IconRoad(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3 5 21M16 3l3 18" />
      <path d="M12 4v3M12 10.5v3M12 17v3" />
    </Svg>
  );
}

export function IconCoastline(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8c3 0 4-3 7-3s4 3 5.5 3H21" />
      <path d="M3 13.5c3.5 0 3.5 2.5 7 2.5s4.5-2.5 8-2.5" />
      <path d="M3 19c3.5 0 3.5 2 7 2s4.5-2 8-2" />
    </Svg>
  );
}

export function IconTerrain(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m2 19 6-9 4 5.5 3-4L22 19H2Z" />
    </Svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </Svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx="12" cy="10.5" r="2.5" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 21.5 20H2.5L12 3.5Z" />
      <path d="M12 10v4M12 17h.01" />
    </Svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 4.75 19 12 7.5 19.25V4.75Z" />
    </Svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.5 5v14M15.5 5v14" />
    </Svg>
  );
}

export function IconSkipStart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 5.5v13L8 12l10-6.5Z" />
      <path d="M6 5v14" />
    </Svg>
  );
}

export function IconSkipEnd(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 5.5v13L16 12 6 5.5Z" />
      <path d="M18 5v14" />
    </Svg>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </Svg>
  );
}

export function IconSatellite(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M3.5 12a8.5 8.5 0 0 1 8.5-8.5M20.5 12a8.5 8.5 0 0 1-8.5 8.5" />
      <path d="M6.5 17.5 3 21M17.5 6.5 21 3" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.75 20 6v6c0 5-3.4 8.2-8 9.25C7.4 20.2 4 17 4 12V6l8-3.25Z" />
      <path d="M8.5 12.5c1.6 0 1.6-1.6 3.5-1.6s1.9 1.6 3.5 1.6" />
    </Svg>
  );
}

/** disaster_type -> icon. Mirrors three/disasters/registry.ts's reuse
 * decisions so a disaster reads with the same glyph everywhere in the app. */
export const DISASTER_ICON: Record<string, (props: IconProps) => ReactElement> = {
  flood: IconWave,
  flash_flood: IconWave,
  coastal_flood: IconWave,
  storm_surge: IconWave,
  cyclone: IconTarget,
  tsunami: IconWave,
  oil_spill: IconFootprint,
  chemical_pollution: IconFootprint,
  search_rescue: IconPin,
};

/** asset_type -> icon, for exposure/infrastructure listings. Falls back to a
 * generic building glyph rather than rendering nothing. */
export function assetIcon(assetType: string | null | undefined) {
  switch ((assetType ?? "").toLowerCase()) {
    case "hospital":
      return IconHospital;
    case "port":
    case "harbour":
    case "harbor":
      return IconPort;
    case "power_plant":
    case "power_station":
    case "substation":
      return IconPower;
    case "road":
    case "highway":
    case "bridge":
      return IconRoad;
    default:
      return IconBuilding;
  }
}
