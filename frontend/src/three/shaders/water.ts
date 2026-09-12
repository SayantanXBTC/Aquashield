/**
 * VISUAL DEMONSTRATION — ocean surface shader.
 *
 * This is a rendering treatment, NOT a hydrodynamic simulation and not a
 * claim about sea state anywhere. Nothing here feeds the simulation engine
 * or any analysis; the only data the scene reads arrives through
 * src/propagation (a mirror of the demo models) via three/hazard/
 * hazardChannel.ts. (CLAUDE.md §27: every water/terrain/visualizer file
 * carries this distinction in its own comment.)
 *
 * What the surface does (Prompt 12 rewrite):
 *
 *  1. GERSTNER swell + short chop with analytic normals, Schlick fresnel,
 *     sky reflection, sun glitter, crest foam, distance fade — as before.
 *  2. WATERTIGHT SHORELINE. Every fragment evaluates the same
 *     `terrainHeightKm` the terrain mesh was built from (three/world/
 *     demoWorld.ts). Where that surface is above the water it is
 *     `discard`ed; swell amplitude is also damped to zero over the last
 *     25 km so no crest can pierce the beach.
 *  3. HAZARD OVERLAYS driven by hazardChannel uniforms:
 *       - tsunami: a raised crest (Gaussian ring segment from the origin,
 *         masked to ±40° of the heading) with two trailing ripples, foam
 *         on the crest, brighter body under it;
 *       - oil spill: swell flattened inside the slick, body colour pulled
 *         to dark oil with an iridescent yellow-brown rim, noise-broken edge;
 *       - cyclone: chop amplitude and foam boosted inside the wind field,
 *         strongest near the eyewall;
 *       - coastal flood: the water surface extends inland by
 *         `uInundationKm`, riding on the terrain surface plus the water
 *         level, so the flood visibly climbs the land and recedes.
 */
import { DEMO_WORLD_GLSL } from "../world/demoWorld";

const NOISE_CHUNK = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      total += valueNoise(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.5;
    }
    return total;
  }
`;

const HAZARD_UNIFORMS = /* glsl */ `
  uniform int uHazardKind;          // 0 none, 1 tsunami, 2 oil, 3 cyclone, 4 flood
  uniform vec2 uHazardOrigin;       // scene xz
  uniform vec2 uHazardPos;          // scene xz
  uniform float uHazardRadius;      // scene units
  uniform float uHazardFront;       // scene units (tsunami front distance)
  uniform float uHazardIntensity;   // 0-1
  uniform float uHazardHeading;     // radians, from +x toward +z
  uniform float uInundationKm;      // flood reach inland
  uniform float uWaterLevelM;       // flood level
  uniform float uWaveHeight;        // tsunami crest, scene units
  uniform float uHazardLateralKm;   // flood: half-width of the inundated stretch of coast (km)

  // Angular mask: 1 within ±40° of the heading as seen from the origin,
  // fading to 0 by ±70°. Used by the tsunami front.
  float headingMask(vec2 fromOrigin) {
    if (length(fromOrigin) < 0.001) return 1.0;
    vec2 dir = vec2(cos(uHazardHeading), sin(uHazardHeading));
    float c = dot(normalize(fromOrigin), dir);
    return smoothstep(0.34, 0.77, c); // cos 70° .. cos 40°
  }

  // How much of the model's inland reach applies at this point: a tsunami
  // floods only the coast inside its front's heading sector; a surge floods
  // a stretch of coast either side of the landfall line.
  float inlandReachMask(vec2 sceneXZ) {
    if (uHazardKind == 1) return headingMask(sceneXZ - uHazardOrigin);
    if (uHazardKind == 4) {
      vec2 dir = vec2(cos(uHazardHeading), sin(uHazardHeading));
      vec2 rel = sceneXZ - uHazardOrigin;
      float lateral = abs(rel.x * dir.y - rel.y * dir.x);
      return 1.0 - smoothstep(uHazardLateralKm * 0.8, uHazardLateralKm * 1.05, lateral);
    }
    return 0.0;
  }

  // Oil slick coverage 0..1 at a scene xz. The slick is stretched along the
  // drift heading (tendrils trail behind the centre) and its edge is broken
  // by domain-warped noise so it reads as a spreading, ragged sheet.
  float slickShape(vec2 sceneXZ, float t) {
    vec2 rel = sceneXZ - uHazardPos;
    vec2 dir = vec2(cos(uHazardHeading), sin(uHazardHeading));
    vec2 nrm = vec2(-dir.y, dir.x);
    float along = dot(rel, dir);
    float across = dot(rel, nrm);
    // Elongate 1.6x behind the centre, 0.9x ahead.
    float stretch = along < 0.0 ? 1.6 : 0.9;
    vec2 q = vec2(along / stretch, across);
    float r = max(uHazardRadius, 0.001);
    vec2 warp = vec2(fbm(q * 0.12 + t * 0.015), fbm(q * 0.12 + 7.3 - t * 0.012)) - 0.5;
    float d = length(q + warp * r * 0.55) / r;
    float tendrils = fbm(q * 0.25 + warp * 2.0) - 0.5;
    return d + tendrils * 0.35;
  }

  float slickMask(vec2 sceneXZ, float t) {
    if (uHazardKind != 2 || uHazardRadius <= 0.0) return 0.0;
    return smoothstep(1.0, 0.55, slickShape(sceneXZ, t));
  }
`;

export const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vElevation;
  varying float vSteepness;
  varying float vShoreDepth;   // land depth in km at this vertex (negative offshore)
  varying float vCrest;        // tsunami crest weight 0..1
  varying float vFloodLift;    // 1 where the surface is riding on flooded land

  ${NOISE_CHUNK}
  ${DEMO_WORLD_GLSL}
  ${HAZARD_UNIFORMS}

  void gerstner(
    vec2 planePos, vec2 direction, float steepness, float wavelength, float speed,
    inout vec3 offset, inout vec3 normalAccum
  ) {
    float k = 6.28318530718 / wavelength;
    float amplitude = steepness / k;
    vec2 d = normalize(direction);
    float f = k * dot(d, planePos) - uTime * speed;
    float c = cos(f);
    float s = sin(f);
    offset.xy += d * (amplitude * c);
    offset.z += amplitude * s;
    float wa = k * amplitude;
    normalAccum.xy -= d * (wa * c);
    normalAccum.z -= steepness * wa * s;
  }

  void main() {
    vec2 planePos = position.xy;
    // Plane local (x, y) -> scene (x, z) under the mesh's [-PI/2,0,0] rotation.
    vec2 sceneXZ = vec2(planePos.x, -planePos.y);
    vec2 km = sceneToKm(sceneXZ);
    float depth = landDepthKm(km.x, km.y);
    vShoreDepth = depth;

    // Swell dies over the last 25 km before the beach so nothing can
    // pierce the land; inside an oil slick it is flattened as well.
    float shoreFade = smoothstep(0.0, 25.0, -depth);
    float slick = slickMask(sceneXZ, uTime);
    float amp = clamp(uAmplitude, 0.0, 4.0) * shoreFade * (1.0 - slick * 0.75);

    // Cyclone: chop is boosted inside the wind field, most near the eyewall.
    float chopBoost = 1.0;
    if (uHazardKind == 3 && uHazardRadius > 0.0) {
      float dEye = length(sceneXZ - uHazardPos) / uHazardRadius;
      float field = 1.0 - smoothstep(0.85, 1.15, dEye);
      float eyewall = 1.0 - smoothstep(0.0, 0.5, abs(dEye - 0.3));
      chopBoost += uHazardIntensity * (1.6 * field + 1.4 * eyewall);
    }

    vec3 offset = vec3(0.0);
    vec3 normalAccum = vec3(0.0, 0.0, 1.0);
    gerstner(planePos, vec2( 1.00,  0.22), 0.145 * amp, 58.0, 0.62, offset, normalAccum);
    gerstner(planePos, vec2( 0.55,  0.83), 0.105 * amp, 33.0, 0.83, offset, normalAccum);
    gerstner(planePos, vec2(-0.72,  0.69), 0.075 * amp, 19.0, 1.08, offset, normalAccum);
    gerstner(planePos, vec2( 0.18, -0.98), 0.055 * amp, 11.5, 1.42, offset, normalAccum);
    // Chop wavelengths stay above ~4 vertex spacings (plane is ~1.9 units
    // per vertex) so the surface never aliases into moiré at distance.
    gerstner(planePos, vec2( 0.92, -0.39), 0.040 * amp * chopBoost, 10.5, 1.65, offset, normalAccum);
    gerstner(planePos, vec2(-0.31, -0.95), 0.030 * amp * chopBoost,  7.5, 2.10, offset, normalAccum);

    float ripple = (fbm(planePos * 0.09 + vec2(uTime * 0.08, uTime * 0.05)) - 0.5) * 0.3 * amp;
    offset.z += ripple;

    // Tsunami crest: a Gaussian ring at uHazardFront from the origin, masked
    // to the heading, plus two trailing ripples. Purely visual height.
    float crest = 0.0;
    if (uHazardKind == 1 && uHazardFront > 0.0) {
      vec2 fromOrigin = sceneXZ - uHazardOrigin;
      float r = length(fromOrigin);
      float mask = headingMask(fromOrigin) * shoreFade;
      float w = max(2.5, uHazardRadius * 0.25 + 3.0);
      float g0 = exp(-pow((r - uHazardFront) / w, 2.0));
      float g1 = exp(-pow((r - uHazardFront + w * 2.6) / (w * 1.2), 2.0)) * 0.35;
      float g2 = exp(-pow((r - uHazardFront + w * 5.0) / (w * 1.4), 2.0)) * 0.15;
      crest = (g0 + g1 + g2) * mask;
      offset.z += crest * uWaveHeight;
      // Tilt the normal down the front face so the crest catches light.
      vec2 outward = r > 0.001 ? fromOrigin / r : vec2(0.0);
      float slope = -2.0 * (r - uHazardFront) / (w * w) * g0 * uWaveHeight * mask;
      normalAccum.xy -= outward * slope * 0.9;
    }
    vCrest = clamp(crest, 0.0, 1.0);

    vec3 displaced = vec3(planePos + offset.xy, position.z + offset.z);

    // Coastal flood: on land within the inundation reach, the surface rides
    // on the terrain plus a level-dependent lift, sloping down toward the
    // inland edge so the flood reads as a sheet climbing the shore.
    float floodLift = 0.0;
    float reachHere = uInundationKm * inlandReachMask(sceneXZ);
    if ((uHazardKind == 4 || uHazardKind == 1) && reachHere > 0.05 && depth > -1.0) {
      float reach = clamp(1.0 - depth / reachHere, 0.0, 1.0);
      float terrain = terrainHeightKm(km.x, km.y);
      float lift = terrain + 0.12 + reach * uWaterLevelM * 0.32;
      float blend = smoothstep(-1.0, 0.5, depth);
      displaced.z = mix(displaced.z, max(displaced.z, lift), blend);
      floodLift = blend;
    }
    vFloodLift = floodLift;

    vElevation = offset.z;
    vSteepness = clamp(1.0 - normalAccum.z, 0.0, 1.0);

    vec3 localNormal = normalize(normalAccum);
    vNormal = normalize(mat3(modelMatrix) * localNormal);

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vElevation;
  varying float vSteepness;
  varying float vShoreDepth;
  varying float vCrest;
  varying float vFloodLift;

  ${NOISE_CHUNK}
  ${DEMO_WORLD_GLSL}
  ${HAZARD_UNIFORMS}

  void main() {
    vec2 sceneXZ = vWorldPosition.xz;
    vec2 km = sceneToKm(sceneXZ);
    float depth = landDepthKm(km.x, km.y);

    // WATERTIGHT SHORELINE. Land above the surface is not water. A flood
    // may extend the surface inland, but only up to its reach.
    bool floods = (uHazardKind == 4 || uHazardKind == 1);
    float allowedInland = floods ? uInundationKm * inlandReachMask(sceneXZ) : 0.0;
    if (depth > allowedInland + 0.35) discard;
    if (depth > 0.0 && !floods && terrainHeightKm(km.x, km.y) > vWorldPosition.y) discard;

    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float viewDistance = length(cameraPosition - vWorldPosition);

    float distanceFlatten = clamp(viewDistance / 420.0, 0.0, 1.0);

    // Procedural detail normals: two scrolling fbm layers perturb the
    // vertex normal so the surface has ripples finer than the mesh can carry.
    // Faded with distance so they don't alias into sparkle.
    float detailScale = 1.0 - distanceFlatten;
    if (detailScale > 0.02) {
      vec2 p1 = sceneXZ * 0.9 + vec2(uTime * 0.11, -uTime * 0.07);
      vec2 p2 = sceneXZ * 2.3 - vec2(uTime * 0.05, uTime * 0.09);
      float e = 0.35;
      float hx = (fbm(p1 + vec2(e, 0.0)) - fbm(p1 - vec2(e, 0.0))) + 0.5 * (fbm(p2 + vec2(e, 0.0)) - fbm(p2 - vec2(e, 0.0)));
      float hz = (fbm(p1 + vec2(0.0, e)) - fbm(p1 - vec2(0.0, e))) + 0.5 * (fbm(p2 + vec2(0.0, e)) - fbm(p2 - vec2(0.0, e)));
      normal = normalize(normal + vec3(-hx, 0.0, -hz) * 0.55 * detailScale);
    }
    normal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), distanceFlatten * 0.75));

    float NdotV = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fresnel = 0.02 + 0.55 * pow(1.0 - NdotV, 5.0);

    // Body colour from sea-floor depth: turquoise shallows over the shelf,
    // navy offshore, a touch lighter on the wave faces.
    float floorDepth = max(0.0, -terrainHeightKm(km.x, km.y));   // scene units below the surface
    float shallowness = 1.0 - smoothstep(0.4, 5.5, floorDepth);
    vec3 turquoise = vec3(0.14, 0.55, 0.6);
    vec3 shelfColor = mix(uShallowColor, turquoise, shallowness * 0.6);
    float bodyMix = clamp(vElevation * 0.55 + 0.45, 0.0, 1.0);
    vec3 body = mix(uDeepColor, shelfColor, 1.0 - smoothstep(0.3, 6.5, floorDepth));
    body = mix(body, body * 1.18, bodyMix * 0.35);
    // Sub-surface tint: light bouncing off a sandy floor in the shallows.
    body += vec3(0.03, 0.06, 0.05) * shallowness;

    float NdotL = dot(normal, uSunDirection);
    float wrapped = clamp((NdotL + 0.35) / 1.35, 0.0, 1.0);
    body *= 0.72 + 0.4 * wrapped;

    float backScatter = pow(clamp(dot(viewDir, -uSunDirection), 0.0, 1.0), 3.0);
    body += uShallowColor * backScatter * clamp(vElevation, 0.0, 1.0) * 0.55;

    // Tsunami: the crest body is brighter and greener (light through the wave).
    body += uShallowColor * vCrest * 0.9 + uFoamColor * vCrest * vCrest * 0.25;

    vec3 reflectDir = reflect(-viewDir, normal);
    float skyBlend = clamp(reflectDir.y * 1.4 + 0.25, 0.0, 1.0);
    vec3 reflection = mix(uHorizonColor, uSkyColor, skyBlend);

    vec3 color = mix(body, reflection, fresnel);

    // Oil slick: a thick black core, a dark brown body, a yellow-brown
    // weathered band and a thin rainbow-iridescent sheen at the fringe —
    // all keyed to the same stretched, noise-broken shape.
    float slick = slickMask(sceneXZ, uTime);
    if (uHazardKind == 2 && uHazardRadius > 0.0) {
      float shape = slickShape(sceneXZ, uTime);            // ~0 centre .. 1 edge
      float conc = 0.35 + 0.65 * uHazardIntensity;
      float core = smoothstep(0.78, 0.25, shape) * conc;
      float bodyMask = smoothstep(1.0, 0.6, shape);
      float weathered = smoothstep(0.82, 0.98, shape) * (1.0 - smoothstep(0.98, 1.08, shape));
      float sheenBand = smoothstep(1.0, 1.06, shape) * (1.0 - smoothstep(1.06, 1.16, shape));
      float swirl = fbm(sceneXZ * 0.4 + vec2(uTime * 0.03, -uTime * 0.02));
      vec3 oilBlack = vec3(0.03, 0.026, 0.022);
      vec3 oilBrown = vec3(0.16, 0.11, 0.06);
      vec3 mousse = vec3(0.58, 0.42, 0.14);
      color = mix(color, oilBrown, bodyMask * (0.6 + 0.4 * conc));
      color = mix(color, oilBlack, core * 0.98);
      color = mix(color, mousse, weathered * (0.25 + 0.45 * swirl) * conc * 0.8);
      // Thin-film iridescence at the fringe: a faint hue cycle, mostly
      // visible in the sun glint rather than as a painted ring.
      float phase = swirl * 2.0 + shape * 6.0;
      vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
      color = mix(color, mix(color, rainbow, 0.45), sheenBand * 0.45 * conc);
      // Oil kills the glitter and flattens reflections inside the body.
      fresnel *= 1.0 - bodyMask * 0.55;
    }

    // Sun response: tight specular plus a noise-broken glitter lobe.
    vec3 halfDir = normalize(uSunDirection + viewDir);
    float NdotH = clamp(dot(normal, halfDir), 0.0, 1.0);
    float specular = pow(NdotH, 260.0) * 0.55;
    float glitterNoise = fbm(sceneXZ * 1.6 + uTime * 0.35);
    float glitter = pow(NdotH, 48.0) * 0.16 * smoothstep(0.5, 0.95, glitterNoise);
    color += uSunColor * (specular + glitter) * (1.0 - distanceFlatten * 0.5) * (1.0 - slick * 0.7);

    // Foam: crest steepness, tsunami crest, cyclone wind field, shore break.
    float foamNoise = fbm(sceneXZ * 3.2 + vec2(uTime * 0.22, -uTime * 0.17));
    float foamFine = fbm(sceneXZ * 9.0 - vec2(uTime * 0.4, uTime * 0.3));
    float foamMask = smoothstep(0.72, 1.0, vSteepness * (0.45 + foamNoise * 0.8));
    // Tsunami: whitewater on the crest, turning into a breaking wall as the
    // crest reaches the beach (where the swell damping shoreFade -> 0).
    float nearBeach = 1.0 - smoothstep(0.0, 18.0, -depth);
    float crestFoam = smoothstep(0.35, 1.0, vCrest) * (0.45 + 0.55 * foamNoise) * (0.6 + 1.2 * nearBeach);
    crestFoam += vCrest * vCrest * nearBeach * foamFine * 0.7;
    foamMask = max(foamMask, clamp(crestFoam, 0.0, 1.0));
    if (uHazardKind == 3 && uHazardRadius > 0.0) {
      float dEye = length(sceneXZ - uHazardPos) / uHazardRadius;
      float ang = atan(sceneXZ.y - uHazardPos.y, sceneXZ.x - uHazardPos.x);
      float spiral = sin(ang * 3.0 - dEye * 14.0 + uTime * 1.8) * 0.5 + 0.5;
      float field = (1.0 - smoothstep(0.9, 1.15, dEye)) * smoothstep(0.08, 0.25, dEye);
      foamMask = max(foamMask, field * spiral * uHazardIntensity * (0.35 + foamNoise * 0.5));
    }
    // Shore break: sets of breakers rolling toward the beach (bands in
    // depth that advance with time), foam thickening toward the sand, and a
    // pulsing swash line right at the waterline.
    float breakZone = smoothstep(-9.0, -0.3, depth);
    float bands = sin(depth * 1.9 + uTime * 1.6 + foamNoise * 2.5) * 0.5 + 0.5;
    float breakers = smoothstep(0.62, 0.95, bands) * breakZone * (0.35 + 0.65 * foamFine);
    float swash = (1.0 - smoothstep(0.0, 1.4, abs(depth + 0.4 + sin(uTime * 0.9) * 0.35))) * (0.5 + 0.5 * foamNoise);
    float shoreBreak = max(breakers * 0.55, swash * 0.8) * (1.0 - vFloodLift);
    foamMask = max(foamMask, shoreBreak);
    // Flood / run-up: a churning foam edge at the inundation reach line.
    if (floods && allowedInland > 0.0) {
      float reachEdge = 1.0 - smoothstep(0.0, 0.9, abs(depth - allowedInland + 0.2));
      foamMask = max(foamMask, reachEdge * (0.4 + 0.6 * foamFine) * 0.8);
    }
    color = mix(color, uFoamColor, foamMask * 0.4);

    // Flooded land: silt-laden water — a murky teal-brown that still carries
    // the sky reflection so it reads as water lying on the land, with
    // streaks of debris foam and a darker seam along the reach line.
    if (vFloodLift > 0.0) {
      vec3 silt = vec3(0.30, 0.31, 0.24);
      float churn = 0.5 + 0.5 * fbm(sceneXZ * 0.6 + uTime * 0.05);
      vec3 floodBody = mix(vec3(0.10, 0.24, 0.27), silt, 0.6 + 0.25 * churn);
      floodBody = mix(floodBody, reflection * 0.8, fresnel * 0.6 + 0.04);
      floodBody *= 0.8 + 0.3 * wrapped;
      float debris = smoothstep(0.6, 0.85, fbm(sceneXZ * 2.4 - vec2(uTime * 0.12, uTime * 0.06)));
      floodBody = mix(floodBody, vec3(0.62, 0.58, 0.48), debris * 0.45);
      color = mix(color, floodBody, vFloodLift);
    }
    // Cyclone: the sea darkens and roughens under the storm.
    if (uHazardKind == 3 && uHazardRadius > 0.0) {
      float dEye = length(sceneXZ - uHazardPos) / uHazardRadius;
      float storm = (1.0 - smoothstep(0.7, 1.25, dEye)) * uHazardIntensity;
      color = mix(color, color * vec3(0.55, 0.6, 0.68), storm * 0.6);
    }

    // Dissolve the plane's far edge into the atmosphere.
    float horizonFade = smoothstep(700.0, 1500.0, viewDistance);
    color = mix(color, uHorizonColor, horizonFade * 0.85);

    // Soft transparent edge right at the beach / flood reach.
    float edge = 1.0 - smoothstep(allowedInland - 0.6, allowedInland + 0.35, depth);
    gl_FragColor = vec4(color, mix(0.35, 1.0, edge));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
