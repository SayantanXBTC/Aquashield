import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import { Color } from "three";
import { waterFragmentShader, waterVertexShader } from "../shaders/water";

export const WaterMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmplitude: 0.35,
    uDeepColor: new Color("#040a12"),
    uShallowColor: new Color("#0d3a44"),
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
