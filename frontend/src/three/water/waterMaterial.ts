import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import { Color, Vector3 } from "three";
import { waterFragmentShader, waterVertexShader } from "../shaders/water";

// Matches LightingSystem's directional "sun" position (40, 60, 20),
// normalized — kept as a literal here rather than importing LightingSystem
// (which would couple a shader module to a component) since it only needs
// the direction, not the light itself.
const SUN_DIRECTION = new Vector3(40, 60, 20).normalize();

export const WaterMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmplitude: 0.35,
    uDeepColor: new Color("#040a12"),
    uShallowColor: new Color("#0d3a44"),
    uSunDirection: SUN_DIRECTION,
  },
  waterVertexShader,
  waterFragmentShader,
);

extend({ WaterMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    waterMaterial: ThreeElement<typeof WaterMaterial>;
  }
}
