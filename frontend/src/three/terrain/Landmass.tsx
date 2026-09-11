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
 *
 * Prompt 8.1 correction: the previous defaults (radius 70, peakHeight 9)
 * produced a low, wide plateau that was mostly flat "sand" tone — from the
 * command center's default camera distance it read as a pale grey polygon
 * rather than terrain. Fixed by (a) a smaller footprint relative to the
 * water plane and camera framing so it reads as a coastal accent, not the
 * dominant object in frame, (b) a taller peak-to-radius ratio plus a
 * higher-frequency noise octave for visible ridges instead of a smooth
 * dome, and (c) a color ramp that spends most of its range in
 * vegetation/rock tones with only a thin waterline sand fringe that blends
 * toward the water's own shallow color, so the land/water seam reads as a
 * coastline rather than a hard material cutoff.
 */
export function Landmass({ radius = 46, segments = 112, peakHeight = 16 }: LandmassProps) {
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
        Math.cos(y * 0.09 - x * 0.02) * 0.2 +
        Math.sin(x * 0.34 - y * 0.29) * 0.08;
      const height = (noise * 0.5 + 0.5) * peakHeight * falloff ** 1.4 - peakHeight * 0.22;
      position.setZ(i, height);

      const t = Math.max(0, Math.min(1, height / peakHeight));
      // waterline shelf (blends into water) -> vegetation -> weathered rock
      const shelf: [number, number, number] = [0.16, 0.24, 0.26];
      const veg: [number, number, number] = [0.13, 0.22, 0.16];
      const rock: [number, number, number] = [0.29, 0.3, 0.31];
      const mix = t < 0.12 ? lerpColor(shelf, veg, t / 0.12) : lerpColor(veg, rock, (t - 0.12) / 0.88);
      colors[i * 3] = mix[0];
      colors[i * 3 + 1] = mix[1];
      colors[i * 3 + 2] = mix[2];
    }

    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [radius, segments, peakHeight]);

  return (
    <mesh geometry={geometry} position={[38, -0.4, 22]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
