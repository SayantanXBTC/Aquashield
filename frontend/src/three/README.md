# three/ — 3D Visualization Subsystem

React Three Fiber / Three.js code. First-class subsystem — disaster-specific visuals plug into a common scene, never the other way around. Do not put Three.js logic inside frontend/src/components or features/.

- core/ — renderer, camera, scene setup shared across all scenarios
- scenes/ — top-level scene compositions
- terrain/ — terrain/bathymetry rendering
- water/ — water surface rendering
- particles/ — generic GPU particle systems
- currents/ — current vector fields
- waves/ — wave rendering primitives
- disasters/ — disaster-specific visual layers (see disasters/README.md)
- markers/ — location/asset markers
- overlays/ — heatmaps, risk zones, 2D-over-3D overlays
- shaders/ — GLSL/shader code
- effects/ — post-processing effects
