import * as THREE from "three";

export function sampleCanvasCenterPixel(canvas: HTMLCanvasElement): { r: number; g: number; b: number; a: number } | null {
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return null;
  const pixels = new Uint8Array(4);
  // Read near center of screen (lower third where water is)
  gl.readPixels(
    Math.floor(canvas.width / 2),
    Math.floor(canvas.height / 3),
    1,
    1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );
  return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
}

export function logCameraAndSceneDiagnostics(camera: THREE.Camera, scene: THREE.Scene) {
  const cam = camera as THREE.PerspectiveCamera;
  const terrainPos = new THREE.Vector3(38, -0.4, 22);
  const waterPos = new THREE.Vector3(0, 0, 0);

  const distToTerrain = cam.position.distanceTo(terrainPos);
  const distToWater = cam.position.distanceTo(waterPos);

  console.group("🔍 3D SCENE & CAMERA DIAGNOSTICS");
  console.log("Camera Position:", {
    x: cam.position.x.toFixed(2),
    y: cam.position.y.toFixed(2),
    z: cam.position.z.toFixed(2),
  });
  console.log("Camera FOV:", cam.fov, "Near:", cam.near, "Far:", cam.far);
  console.log("Distance to Terrain Center [38, -0.4, 22]:", distToTerrain.toFixed(2));
  console.log("Distance to Water Center [0, 0, 0]:", distToWater.toFixed(2));

  // Find terrain and water meshes
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry instanceof THREE.PlaneGeometry) {
        const box = new THREE.Box3().setFromObject(obj);
        console.log(`Mesh [${obj.name || "unnamed"}]:`, {
          worldBox: {
            min: [box.min.x.toFixed(1), box.min.y.toFixed(1), box.min.z.toFixed(1)],
            max: [box.max.x.toFixed(1), box.max.y.toFixed(1), box.max.z.toFixed(1)],
          },
          material: obj.material?.type,
        });
      }
    }
  });
  console.groupEnd();
}
