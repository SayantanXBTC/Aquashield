import { useMemo } from "react";
import { BufferAttribute, PlaneGeometry } from "three";

interface LandmassProps {
  /** Radius, in scene units, beyond which the terrain sinks below the water
   * plane — this is what gives the landmass its rough coastline, not an
   * explicit outline. */
  radius?: number;
  segments?: number;
  peakHeight?: number;
}

/**
 * A procedurally displaced terrain patch representing "land" near the
 * scenario's coastline. Deliberately not real GIS/DEM data — a cheap
 * multi-octave sine pseudo-noise (no extra noise-library dependency,
 * CLAUDE.md §16) shaped by a radial falloff so the edges submerge under
 * WaterSurface, reading as a coastline rather than a floating disc.
 * VISUAL DEMONSTRATION ONLY — see docs/development/command-center.md.
 */
export function Landmass({ radius = 70, segments = 96, peakHeight = 9 }: LandmassProps) {
  const geometry = useMemo(() => {
    const size = radius * 2.4;
    const geo = new PlaneGeometry(size, size, segments, segments);
    const position = geo.attributes.position as BufferAttribute;
    const colors = new Float32Array(position.count * 3);

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i); // local Y before rotation -> world Z-ish plane axis
      const distance = Math.sqrt(x * x + y * y);
      const falloff = Math.max(0, 1 - distance / radius);
      const noise =
        Math.sin(x * 0.05) * Math.cos(y * 0.06) * 0.5 +
        Math.sin(x * 0.12 + y * 0.03) * 0.3 +
        Math.cos(y * 0.09 - x * 0.02) * 0.2;
      const height = (noise * 0.5 + 0.5) * peakHeight * falloff ** 1.6 - peakHeight * 0.18;
      position.setZ(i, height);

      const t = Math.max(0, Math.min(1, height / peakHeight));
      // sand (low) -> vegetation (mid) -> rock (high)
      const sand: [number, number, number] = [0.63, 0.56, 0.42];
      const veg: [number, number, number] = [0.16, 0.27, 0.2];
      const rock: [number, number, number] = [0.32, 0.33, 0.34];
      const mix = t < 0.4 ? lerpColor(sand, veg, t / 0.4) : lerpColor(veg, rock, (t - 0.4) / 0.6);
      colors[i * 3] = mix[0];
      colors[i * 3 + 1] = mix[1];
      colors[i * 3 + 2] = mix[2];
    }

    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [radius, segments, peakHeight]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
