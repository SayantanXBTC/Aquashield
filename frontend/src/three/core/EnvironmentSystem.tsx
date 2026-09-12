import { Sky } from "@react-three/drei";
import { useDiagnostics } from "../diagnostics/diagnosticStore";

/**
 * VISUAL DEMONSTRATION ATMOSPHERE — entirely synthetic, and not a claim
 * about real weather, visibility or lighting conditions at any location.
 *
 * drei's `Sky` is a procedural Preetham sky dome (geometry + shader, no
 * texture download), tuned for a clear high-altitude daylight rather than a
 * coloured sunset: a command centre needs the ground legible, and a heavy
 * orange horizon fights every hazard colour in the scene. `fogExp2` fades
 * distant water and terrain into the same horizon value the water shader
 * fades to (`uHorizonColor`), so the plate's far edge and the sky dome meet
 * instead of the geometry clipping in against it.
 */
export function EnvironmentSystem() {
  const { fogEnabled } = useDiagnostics();
  return (
    <>
      <Sky
        distance={2600}
        sunPosition={[-48, 58, 30]}
        turbidity={6}
        rayleigh={3}
        mieCoefficient={0.004}
        mieDirectionalG={0.82}
      />
      {fogEnabled && <fogExp2 attach="fog" args={["#9fb6c6", 0.0006]} />}
    </>
  );
}
