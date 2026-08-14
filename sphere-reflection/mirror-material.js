/**
 * File Purpose: Procedural and image-backed reflection fields beneath the Canvas 2D Hexsweeper sphere.
 * Primary Functions/Classes: MirrorMaterial.boot, WebGL reflection renderer, appearance facade.
 * Inputs: reflection canvas + SphereSweeper public API. Outputs: pointer-inert visual material.
 *
 * Visual premise inspired by Matthias Hurrle's “It Is All Just a Reflection”
 * (CodePen @atzedent). This implementation is purpose-built for Hexsweeper:
 * analytic sphere normals replace the reference raymarch, and all gameplay,
 * projection, hit testing, and controls remain Luke Steuber's Canvas 2D engine.
 */
(function (global) {
  "use strict";

  const REFLECTION_THEME = {
    id: "obsidian-mirror",
    name: "Obsidian Mirror",
    chrome: "dark",
    reflectionSurface: true,
    accent: "#eaf8ff",
    pureCovered: false,
    pureRevealed: false,
    bg: "rgba(0,0,0,0)",
    bgGlow: "rgba(0,0,0,0)",
    covered: "rgba(3,9,13,0.08)",
    coveredHi: "rgba(255,255,255,0.08)",
    coveredEdge: "rgba(222,242,250,0.42)",
    coveredShadow: "rgba(0,0,0,0.4)",
    tierCovered: "rgba(3,9,13,0.08)",
    tierFlagged: "#e5222a",
    tierNumbered: "rgba(3,7,10,0.94)",
    tierEmpty: "rgba(0,3,6,0.97)",
    revealed: "rgba(3,7,10,0.94)",
    revealedEmpty: "rgba(0,3,6,0.97)",
    revealedEdge: "rgba(208,232,242,0.34)",
    revealedEmptyEdge: "rgba(150,181,194,0.18)",
    valleyGroove: "rgba(222,242,250,0.28)",
    valleyGrooveDeep: "rgba(0,0,0,0.86)",
    flagFill: "#e5222a",
    flagIcon: "#ffffff",
    flagEdge: "#ff5a5f",
    mine: "#05070a",
    mineCore: "#05070a",
    mineEdge: "#ff3b3f",
    mineBurst: "#ffffff",
    pentagon: "rgba(3,9,13,0.08)",
    pentagonEdge: "rgba(238,248,252,0.62)",
    hoverRing: "#ffffff",
    activeRing: "#9ee8ff",
    backface: "rgba(0,4,8,0.035)",
    backfaceEdge: "rgba(214,237,246,0.14)",
    core: "rgba(0,0,0,0)",
    floatShadow: null,
    text: {
      1: "#f4fbff",
      2: "#bcecff",
      3: "#8ed9f5",
      4: "#ffd7a0",
      5: "#ff9f8f",
      6: "#ff7180",
    },
    label: "#f4fbff",
    labelStroke: "rgba(0,3,7,0.96)",
    revealFlash: "#ffffff",
    revealGlow: "#9ee8ff",
  };

  const MATERIAL_STORAGE_KEY = "hexsweeper-reflection-material-v1";
  const MATERIAL_PRESETS = [
    {
      id: "stormglass",
      label: "Stormglass",
      shortLabel: "Storm",
      fallback: ["#070d12", "#53646c", "#d99358", "#00101e"],
      swatch: "radial-gradient(circle at 58% 24%, #d99358 0 10%, #53646c 32%, #070d12 72%)",
    },
    {
      id: "studio",
      label: "Softbox Orbit",
      shortLabel: "Studio",
      fallback: ["#05080a", "#65747a", "#dca465", "#10181c"],
      swatch: "linear-gradient(135deg, #05080a 20%, #dca465 42%, #65747a 58%, #10181c 80%)",
    },
    {
      id: "mercury",
      label: "Smoked Mercury",
      shortLabel: "Mercury",
      fallback: ["#050708", "#738084", "#b8c7ca", "#101719"],
      swatch: "linear-gradient(165deg, #050708 10%, #b8c7ca 44%, #3d484b 62%, #101719 88%)",
    },
    {
      id: "aurora",
      label: "Aurora Vault",
      shortLabel: "Aurora",
      fallback: ["#02070d", "#2e7f83", "#88d2d0", "#141329"],
      swatch: "linear-gradient(145deg, #02070d 22%, #2e7f83 43%, #88d2d0 51%, #141329 68%)",
    },
    {
      id: "atrium",
      label: "Checker Atrium",
      shortLabel: "Atrium",
      fallback: ["#111416", "#777a77", "#d8d4c9", "#202326"],
      swatch: "conic-gradient(#111416 0 25%, #d8d4c9 0 50%, #202326 0 75%, #777a77 0)",
    },
    {
      id: "canopy",
      label: "Verdant Canopy",
      shortLabel: "Canopy",
      fallback: ["#07100b", "#34563a", "#9ab18d", "#101a13"],
      swatch: "radial-gradient(circle at 62% 24%, #b9c99e 0 8%, #34563a 35%, #07100b 76%)",
      texture: { desktop: "assets/reflections/canopy-2048.webp", mobile: "assets/reflections/canopy-1024.webp", speed: 0.0012, exposure: 0.74, saturation: 0.86, backdrop: 0.46, mapping: "environment", reflectionStrength: 0.24, roughness: 0.12 },
    },
    {
      id: "salon",
      label: "Gallery Bokeh",
      shortLabel: "Bokeh",
      fallback: ["#100b08", "#7c5835", "#d7a45f", "#211610"],
      swatch: "radial-gradient(circle at 32% 42%, #e3b267 0 11%, transparent 12%), radial-gradient(circle at 72% 28%, #ac7744 0 15%, #150d09 42%)",
      texture: { desktop: "assets/reflections/salon-2048.webp", mobile: "assets/reflections/salon-1024.webp", speed: 0.0018, exposure: 0.82, saturation: 0.88, backdrop: 0.56, mapping: "environment", reflectionStrength: 0.30, roughness: 0.08 },
    },
    {
      id: "paisley",
      label: "Midnight Paisley",
      shortLabel: "Paisley",
      fallback: ["#030303", "#242424", "#767676", "#0c0c0c"],
      swatch: "radial-gradient(ellipse at 35% 38%, transparent 0 18%, #505050 19% 23%, transparent 24%), repeating-radial-gradient(ellipse at 70% 60%, #090909 0 6px, #292929 7px 9px, #050505 10px 15px)",
      texture: { desktop: "assets/reflections/paisley-2048.webp", mobile: "assets/reflections/paisley-1024.webp", speed: 0.0007, exposure: 0.70, saturation: 0.42, backdrop: 0.40, mapping: "surface", surfaceMix: 0.92, reflectionStrength: 0.24, roughness: 0.14 },
    },
    {
      id: "portoro",
      label: "Portoro Marble",
      shortLabel: "Portoro",
      fallback: ["#050403", "#604c2c", "#d4b26f", "#15110a"],
      swatch: "linear-gradient(118deg, #030303 0 34%, #ba9656 35% 38%, #f0dfb2 39%, #090807 41% 68%, #745b35 69% 72%, #020202 73%)",
      texture: { desktop: "assets/reflections/portoro-2048.webp", mobile: "assets/reflections/portoro-1024.webp", speed: 0.0005, exposure: 0.76, saturation: 0.76, backdrop: 0.44, mapping: "surface", surfaceMix: 0.90, reflectionStrength: 0.30, roughness: 0.08 },
    },
    {
      id: "deco",
      label: "Deco Lacquer",
      shortLabel: "Deco",
      fallback: ["#030303", "#5b492d", "#c4a26b", "#100e0b"],
      swatch: "repeating-conic-gradient(from 315deg at 50% 100%, #080808 0 7deg, #b28d55 8deg 9deg, #080808 10deg 16deg)",
      texture: { desktop: "assets/reflections/deco-2048.webp", mobile: "assets/reflections/deco-1024.webp", speed: 0.0009, exposure: 0.78, saturation: 0.74, backdrop: 0.44, mapping: "surface", surfaceMix: 0.88, reflectionStrength: 0.28, roughness: 0.10 },
    },
    {
      id: "oculus",
      label: "Stained Oculus",
      shortLabel: "Oculus",
      fallback: ["#030608", "#315f76", "#f0a53c", "#16060a"],
      swatch: "conic-gradient(from 18deg, #ffb32c, #e32d28, #18aee1, #15b86c, #ffdc4b, #ffb32c)",
      texture: { desktop: "assets/reflections/oculus-1280.webp", mobile: "assets/reflections/oculus-768.webp", speed: 0.00035, exposure: 0.90, saturation: 1.08, backdrop: 0.34, mapping: "hybrid", surfaceMix: 0.72, reflectionStrength: 0.28, roughness: 0.06 },
    },
    {
      id: "galaxy",
      label: "Galactic Dust",
      shortLabel: "Galaxy",
      fallback: ["#050714", "#49405c", "#d09a9e", "#08172b"],
      swatch: "radial-gradient(ellipse at 38% 62%, #d7a5a2 0 9%, #65506e 26%, #16345e 52%, #050714 78%)",
      texture: { desktop: "assets/reflections/galaxy-1280.webp", mobile: "assets/reflections/galaxy-768.webp", speed: 0.00018, exposure: 1.10, saturation: 0.92, backdrop: 0.50, mapping: "environment", reflectionStrength: 0.22, roughness: 0.06 },
    },
    {
      id: "night-cabin",
      label: "Night Cabin",
      shortLabel: "Cabin",
      fallback: ["#01050a", "#112844", "#ffb56b", "#020305"],
      swatch: "radial-gradient(circle at 56% 70%, #ffb56b 0 5%, #15253c 7% 23%, #030912 46%, #010204 76%)",
      texture: { desktop: "assets/reflections/night-cabin-1280.webp", mobile: "assets/reflections/night-cabin-768.webp", speed: 0.00010, exposure: 1.18, saturation: 0.90, backdrop: 0.54, mapping: "environment", reflectionStrength: 0.28, roughness: 0.04, offsetX: -0.20, offsetY: 0.18 },
    },
    {
      id: "gilded-ribbon",
      label: "Gilded Ribbon",
      shortLabel: "Ribbon",
      fallback: ["#020103", "#4d3449", "#dfa35f", "#080510"],
      swatch: "repeating-radial-gradient(ellipse at 72% 58%, #060407 0 8px, #c27d38 9px 11px, #16101c 12px 19px, #8c7bb5 20px 21px)",
      texture: { desktop: "assets/reflections/gilded-ribbon-1280.webp", mobile: "assets/reflections/gilded-ribbon-768.webp", speed: 0.00080, exposure: 0.84, saturation: 0.92, backdrop: 0.42, mapping: "surface", surfaceMix: 0.90, reflectionStrength: 0.30, roughness: 0.08 },
    },
    {
      id: "ion-storm",
      label: "Ion Storm",
      shortLabel: "Ion",
      fallback: ["#06142d", "#175fa2", "#c893dc", "#060a19"],
      swatch: "linear-gradient(135deg, #0a75be 12%, #123866 46%, #d39adb 72%, #100c27 92%)",
      texture: { desktop: "assets/reflections/ion-storm-1280.webp", mobile: "assets/reflections/ion-storm-768.webp", speed: 0.00045, exposure: 0.98, saturation: 1.04, backdrop: 0.48, mapping: "hybrid", surfaceMix: 0.68, reflectionStrength: 0.34, roughness: 0.10, motion: 1, motionAmount: 0.030, motionRate: 0.095, pulse: 0.06 },
    },
    {
      id: "amber-tempest",
      label: "Amber Tempest",
      shortLabel: "Tempest",
      fallback: ["#071018", "#70472d", "#f1a14e", "#0c1721"],
      swatch: "radial-gradient(circle at 60% 35%, #ffd082 0 7%, #b6602d 28%, #17232c 62%, #05090d 88%)",
      texture: { desktop: "assets/reflections/amber-tempest-1280.webp", mobile: "assets/reflections/amber-tempest-768.webp", speed: -0.00035, exposure: 0.94, saturation: 0.92, backdrop: 0.48, mapping: "hybrid", surfaceMix: 0.64, reflectionStrength: 0.36, roughness: 0.10, motion: 1, motionAmount: 0.026, motionRate: 0.080, pulse: 0.05 },
    },
    {
      id: "heat-lightning",
      label: "Heat Lightning",
      shortLabel: "Heat",
      fallback: ["#0d1017", "#7a3f53", "#ffb05b", "#190f16"],
      swatch: "radial-gradient(circle at 53% 44%, #fff1cf 0 5%, #ff9f45 14%, #7e3b5d 34%, #11131d 72%)",
      texture: { desktop: "assets/reflections/heat-lightning-1280.webp", mobile: "assets/reflections/heat-lightning-768.webp", speed: 0.00025, exposure: 0.96, saturation: 0.98, backdrop: 0.46, mapping: "hybrid", surfaceMix: 0.66, reflectionStrength: 0.36, roughness: 0.08, motion: 1, motionAmount: 0.026, motionRate: 0.090, pulse: 0.07, offsetY: 0.02 },
    },
    {
      id: "stratosphere",
      label: "Stratosphere",
      shortLabel: "Sky",
      fallback: ["#e7f2fa", "#74b5df", "#ffffff", "#1d6fa9"],
      swatch: "linear-gradient(180deg, #137ec2 0%, #77c1ec 42%, #ffffff 63%, #dbeef8 100%)",
      texture: { desktop: "assets/reflections/stratosphere-1280.webp", mobile: "assets/reflections/stratosphere-768.webp", speed: 0.00020, exposure: 0.88, saturation: 0.82, backdrop: 0.50, mapping: "environment", reflectionStrength: 0.20, roughness: 0.16, motion: 1, motionAmount: 0.012, motionRate: 0.045, pulse: 0.0, offsetY: -0.04 },
    },
    {
      id: "chromatic-ink",
      label: "Chromatic Ink",
      shortLabel: "Ink",
      fallback: ["#132ccb", "#00d9d2", "#f3ef16", "#ff16a8"],
      swatch: "conic-gradient(from 35deg, #1529c9, #04d7c8, #f0ef13, #fe7416, #f014a8, #1529c9)",
      texture: { desktop: "assets/reflections/chromatic-ink-1280.webp", mobile: "assets/reflections/chromatic-ink-768.webp", speed: 0.00015, exposure: 0.82, saturation: 1.08, backdrop: 0.38, mapping: "surface", surfaceMix: 0.94, reflectionStrength: 0.24, roughness: 0.12, motion: 2, motionAmount: 0.22, motionRate: 0.075, pulse: 0.0, scaleX: 0.86, scaleY: 0.92 },
    },
    {
      id: "amber-cells",
      label: "Amber Cells",
      shortLabel: "Cells",
      fallback: ["#1c0b02", "#95500e", "#f5bd4e", "#40200a"],
      swatch: "radial-gradient(circle at 28% 32%, #f4bd56 0 16%, #9b5417 17% 21%, transparent 22%), radial-gradient(circle at 68% 61%, #d98724 0 25%, #2b1205 27% 100%)",
      texture: { desktop: "assets/reflections/amber-cells-1280.webp", mobile: "assets/reflections/amber-cells-768.webp", speed: -0.00012, exposure: 0.88, saturation: 0.90, backdrop: 0.44, mapping: "surface", surfaceMix: 0.92, reflectionStrength: 0.26, roughness: 0.14, motion: 3, motionAmount: 0.016, motionRate: 0.055, pulse: 0.0, scaleX: 0.92, scaleY: 0.96 },
    },
  ];
  const MATERIAL_INDEX = new Map(
    MATERIAL_PRESETS.map((preset, index) => [preset.id, index])
  );

  function materialIndex(value) {
    if (Number.isFinite(value)) {
      return Math.max(0, Math.min(MATERIAL_PRESETS.length - 1, value | 0));
    }
    return MATERIAL_INDEX.has(value) ? MATERIAL_INDEX.get(value) : 0;
  }

  function initialMaterial(options) {
    if (options && MATERIAL_INDEX.has(options.material)) return options.material;
    try {
      const query = new URLSearchParams(location.search).get("material");
      if (MATERIAL_INDEX.has(query)) return query;
    } catch (_) {}
    if (MATERIAL_INDEX.has(global.HEXSWEEPER_REFLECTION_MATERIAL)) {
      return global.HEXSWEEPER_REFLECTION_MATERIAL;
    }
    try {
      const stored = localStorage.getItem(MATERIAL_STORAGE_KEY);
      if (MATERIAL_INDEX.has(stored)) return stored;
    } catch (_) {}
    return MATERIAL_PRESETS[0].id;
  }

  const VERTEX_SOURCE = `#version 300 es
precision highp float;
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

  // Original analytic material for this experiment. The known sphere silhouette
  // makes a raymarch unnecessary: one screen-space normal and reflect() produce
  // the continuous mirrored orb at a fraction of the reference shader's cost.
  const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 outColor;

uniform float uTime;
uniform float uAppearance;
uniform float uMaterial;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uPointer;
uniform vec2 uRotation;
uniform float uRadius;
uniform sampler2D uEnvironmentMap;
uniform float uTextureReady;
uniform vec4 uTextureParams;
uniform vec4 uTextureTransform;
uniform vec4 uTextureMotion;
uniform vec4 uTextureMapping;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.52;
  mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);
  for (int i = 0; i < 4; i++) {
    sum += valueNoise(p) * amp;
    p = turn * p * 2.03 + vec2(2.7, -1.9);
    amp *= 0.5;
  }
  return sum;
}

mat2 rotate2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

vec3 cameraEnvironmentRay(vec3 ray) {
  ray.yz = rotate2(uPointer.y * 0.025) * ray.yz;
  ray.xz = rotate2(-uPointer.x * 0.025) * ray.xz;
  return normalize(ray);
}

vec3 inverseSphereRotation(vec3 direction) {
  // sphere.js rotates object points around Y first, then X. Undo that exact
  // transform in reverse so material landmarks remain attached to the tiles.
  direction.yz = rotate2(uRotation.y) * direction.yz;
  direction.xz = rotate2(-uRotation.x) * direction.xz;
  return normalize(direction);
}

float softRect(vec2 point, vec2 center, vec2 halfSize, float feather) {
  vec2 outside = abs(point - center) - halfSize;
  return 1.0 - smoothstep(0.0, feather, max(outside.x, outside.y));
}

vec3 stormglassEnvironment(vec3 ray) {
  float longitude = atan(ray.z, ray.x);
  float latitude = asin(clamp(ray.y, -1.0, 1.0));
  vec2 weatherUv = vec2(longitude * 0.85, latitude * 3.2 - uTime * 0.018);
  float broad = fbm(weatherUv * vec2(0.9, 1.65));
  float detail = fbm(weatherUv * vec2(1.75, 3.1) + vec2(4.0, -2.0));
  float cloud = smoothstep(0.43, 0.78, broad * 0.72 + detail * 0.5);

  vec3 nightLow = vec3(0.008, 0.018, 0.027);
  vec3 nightHigh = vec3(0.26, 0.36, 0.42);
  vec3 dayLow = vec3(0.23, 0.29, 0.32);
  vec3 dayHigh = vec3(0.78, 0.84, 0.85);
  vec3 low = mix(nightLow, dayLow, uAppearance);
  vec3 high = mix(nightHigh, dayHigh, uAppearance);
  vec3 color = mix(low, high, cloud * 0.68);

  vec3 keyLight = normalize(vec3(-0.16, 0.86, 0.48));
  float crown = pow(max(dot(ray, keyLight), 0.0), 15.0);
  float horizon = exp(-pow((ray.y - 0.2) * 3.4, 2.0));
  vec3 warm = mix(vec3(1.0, 0.52, 0.22), vec3(1.0, 0.79, 0.47), uAppearance);
  color += warm * crown * (0.9 + cloud * 0.7);
  color += warm * horizon * cloud * 0.14;

  float abyss = smoothstep(0.22, 0.95, -ray.y);
  color = mix(color, vec3(0.0, 0.025, 0.055), abyss * (0.72 - uAppearance * 0.22));
  return color;
}

vec3 studioEnvironment(vec3 ray) {
  ray.xz = rotate2(uTime * 0.055) * ray.xz;
  vec2 uv = vec2(atan(ray.z, ray.x) / 3.14159265, asin(clamp(ray.y, -1.0, 1.0)));
  vec3 low = mix(vec3(0.006, 0.010, 0.012), vec3(0.22, 0.245, 0.25), uAppearance);
  vec3 pearl = mix(vec3(0.58, 0.64, 0.66), vec3(0.96, 0.98, 0.97), uAppearance);
  vec3 warm = mix(vec3(0.82, 0.48, 0.22), vec3(1.0, 0.75, 0.42), uAppearance);
  float key = softRect(uv, vec2(-0.30, 0.40), vec2(0.24, 0.20), 0.13);
  float fill = softRect(uv, vec2(0.52, 0.03), vec2(0.18, 0.34), 0.16);
  float rim = softRect(uv, vec2(-0.76, -0.30), vec2(0.10, 0.27), 0.12);
  float sweep = exp(-pow((uv.y + 0.50) * 5.0, 2.0));
  vec3 color = low;
  color += pearl * (key * 0.82 + fill * 0.45 + rim * 0.22);
  color += warm * key * 0.34;
  color += mix(vec3(0.05, 0.08, 0.09), vec3(0.35), uAppearance) * sweep * 0.4;
  return color;
}

vec3 mercuryEnvironment(vec3 ray) {
  float latitude = asin(clamp(ray.y, -1.0, 1.0));
  float longitude = atan(ray.z, ray.x);
  float broad = 0.5 + 0.5 * sin(latitude * 5.2 + sin(longitude * 1.5) * 0.8);
  float shoulder = pow(max(dot(ray, normalize(vec3(-0.64, 0.42, 0.64))), 0.0), 4.5);
  float edge = pow(max(dot(ray, normalize(vec3(0.72, -0.12, 0.68))), 0.0), 7.0);
  vec3 charcoal = mix(vec3(0.008, 0.012, 0.014), vec3(0.28, 0.30, 0.30), uAppearance);
  vec3 nickel = mix(vec3(0.30, 0.36, 0.37), vec3(0.75, 0.79, 0.78), uAppearance);
  vec3 silver = mix(vec3(0.66, 0.75, 0.76), vec3(0.97), uAppearance);
  vec3 color = mix(charcoal, nickel, smoothstep(0.18, 0.82, broad) * 0.72);
  color += silver * shoulder * 0.52;
  color += vec3(0.72, 0.84, 0.86) * edge * 0.2;
  return color;
}

vec3 auroraEnvironment(vec3 ray) {
  float longitude = atan(ray.z, ray.x);
  float latitude = asin(clamp(ray.y, -1.0, 1.0));
  float fold = fbm(vec2(longitude * 0.72 - uTime * 0.018, latitude * 1.8 + uTime * 0.012));
  float ribbonCenter = 0.18 * sin(longitude * 1.35 - uTime * 0.08) + (fold - 0.5) * 0.34;
  float ribbon = exp(-pow((latitude - ribbonCenter) * 2.9, 2.0));
  float echo = exp(-pow((latitude + 0.62 + 0.08 * sin(longitude * 2.0)) * 6.5, 2.0));
  float phase = 0.5 + 0.5 * sin(longitude * 1.7 + uTime * 0.04);
  vec3 midnight = mix(vec3(0.003, 0.012, 0.022), vec3(0.18, 0.23, 0.28), uAppearance);
  vec3 cyan = mix(vec3(0.08, 0.62, 0.62), vec3(0.32, 0.82, 0.79), uAppearance);
  vec3 violet = mix(vec3(0.24, 0.10, 0.38), vec3(0.43, 0.28, 0.58), uAppearance);
  vec3 color = midnight;
  color += mix(cyan, violet, phase) * ribbon * (0.76 + fold * 0.38);
  color += cyan * echo * 0.18;
  return color;
}

vec3 atriumEnvironment(vec3 ray) {
  float longitude = atan(ray.z, ray.x) / 3.14159265;
  float latitude = asin(clamp(ray.y, -1.0, 1.0)) / 1.57079633;
  vec2 gridUv = vec2(longitude * 4.0, latitude * 3.0);
  vec2 cell = floor(gridUv);
  vec2 within = abs(fract(gridUv) - 0.5);
  float mortar = 1.0 - smoothstep(0.38, 0.47, max(within.x, within.y));
  float checker = mod(cell.x + cell.y, 2.0);
  vec3 darkStone = mix(vec3(0.025, 0.03, 0.032), vec3(0.34, 0.35, 0.34), uAppearance);
  vec3 paleStone = mix(vec3(0.34, 0.35, 0.33), vec3(0.79, 0.77, 0.71), uAppearance);
  vec3 color = mix(darkStone, paleStone, checker * 0.72 + 0.12);
  color = mix(vec3(0.005, 0.008, 0.009), color, mortar);
  float skylight = pow(max(dot(ray, normalize(vec3(-0.1, 0.92, 0.36))), 0.0), 8.0);
  color += mix(vec3(0.42, 0.48, 0.48), vec3(0.95, 0.91, 0.82), uAppearance) * skylight * 0.42;
  return color;
}

vec3 imageEnvironment(vec3 ray, float lod) {
  float longitude = atan(ray.z, ray.x) / 6.28318531 + 0.5;
  float latitude = asin(clamp(ray.y, -1.0, 1.0)) / 3.14159265 + 0.5;
  vec2 centered = vec2(longitude, latitude) - 0.5;
  vec2 uv = centered * uTextureTransform.xy + 0.5 + uTextureTransform.zw;
  uv.x = fract(uv.x + uTime * uTextureParams.x);

  // Image plates opt into one of three restrained motion families. Motion is
  // applied before sampling so the sphere remains geometrically authoritative:
  // weather drifts, ink folds around itself, and oil cells gently refract.
  float motionMode = uTextureMotion.x;
  float motionAmount = uTextureMotion.y;
  float motionTime = uTime * uTextureMotion.z;
  vec2 motionCenter = uv - 0.5;
  if (motionMode > 0.5 && motionMode < 1.5) {
    float cloudX = fbm(motionCenter * 3.2 + vec2(motionTime, -motionTime * 0.57));
    float cloudY = fbm(motionCenter.yx * 3.7 + vec2(-motionTime * 0.43, motionTime * 0.71));
    uv += (vec2(cloudX, cloudY) - 0.5) * motionAmount;
  } else if (motionMode > 1.5 && motionMode < 2.5) {
    float radius = length(motionCenter);
    float eddy = fbm(motionCenter * 4.4 + vec2(motionTime * 0.7, -motionTime * 0.5)) - 0.5;
    float angle = motionTime + (0.58 - radius) * motionAmount * 3.4 + eddy * motionAmount * 1.8;
    motionCenter = rotate2(angle) * motionCenter;
    vec2 current = vec2(
      fbm(motionCenter * 5.0 + vec2(motionTime, 1.7)),
      fbm(motionCenter.yx * 5.3 + vec2(-motionTime * 0.8, 3.1))
    ) - 0.5;
    uv = motionCenter + 0.5 + current * motionAmount * 0.12;
  } else if (motionMode > 2.5) {
    vec2 wobble = vec2(
      sin((uv.y + motionTime) * 17.0),
      cos((uv.x - motionTime * 0.73) * 15.0)
    );
    float lens = fbm(motionCenter * 4.0 + vec2(motionTime * 0.5, -motionTime * 0.4)) - 0.5;
    uv += (wobble * 0.55 + lens) * motionAmount;
  }

  uv.x = fract(uv.x);
  uv.y = clamp(uv.y, 0.002, 0.998);
  vec3 sampleColor = textureLod(uEnvironmentMap, uv, lod).rgb;
  float luma = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
  sampleColor = mix(vec3(luma), sampleColor, uTextureParams.z) * uTextureParams.y;
  float breathe = 0.5 + 0.5 * sin(uTime * 0.58 + longitude * 6.28318531);
  sampleColor *= 1.0 + uTextureMotion.w * (breathe - 0.35);
  sampleColor = mix(sampleColor, vec3(luma * 0.72 + 0.26), uAppearance * 0.24);
  return sampleColor;
}

vec3 environment(vec3 ray, float lod) {
  if (uMaterial < 0.5) return stormglassEnvironment(ray);
  if (uMaterial < 1.5) return studioEnvironment(ray);
  if (uMaterial < 2.5) return mercuryEnvironment(ray);
  if (uMaterial < 3.5) return auroraEnvironment(ray);
  if (uMaterial < 4.5) return atriumEnvironment(ray);
  if (uTextureReady > 0.5) return imageEnvironment(ray, lod);
  return mix(vec3(0.015, 0.018, 0.017), vec3(0.58, 0.60, 0.57), uAppearance);
}

vec3 materialField() {
  if (uMaterial < 0.5) return mix(vec3(0.012, 0.019, 0.024), vec3(0.72, 0.76, 0.77), uAppearance);
  if (uMaterial < 1.5) return mix(vec3(0.008, 0.012, 0.014), vec3(0.67, 0.69, 0.68), uAppearance);
  if (uMaterial < 2.5) return mix(vec3(0.014, 0.017, 0.018), vec3(0.60, 0.62, 0.61), uAppearance);
  if (uMaterial < 3.5) return mix(vec3(0.004, 0.011, 0.019), vec3(0.48, 0.55, 0.59), uAppearance);
  if (uMaterial < 4.5) return mix(vec3(0.018, 0.021, 0.022), vec3(0.70, 0.69, 0.65), uAppearance);
  return mix(vec3(0.008, 0.010, 0.009), vec3(0.64, 0.65, 0.62), uAppearance);
}

vec3 materialAccent() {
  if (uMaterial < 0.5) return vec3(1.0, 0.72, 0.42);
  if (uMaterial < 1.5) return vec3(1.0, 0.77, 0.48);
  if (uMaterial < 2.5) return vec3(0.72, 0.84, 0.86);
  if (uMaterial < 3.5) return vec3(0.22, 0.82, 0.79);
  if (uMaterial < 4.5) return vec3(0.92, 0.88, 0.76);
  if (uMaterial < 5.5) return vec3(0.67, 0.79, 0.59);
  if (uMaterial < 6.5) return vec3(0.96, 0.72, 0.39);
  if (uMaterial < 7.5) return vec3(0.72, 0.72, 0.70);
  if (uMaterial < 9.5) return vec3(0.86, 0.70, 0.42);
  if (uMaterial < 10.5) return vec3(0.22, 0.78, 0.95);
  if (uMaterial < 11.5) return vec3(0.70, 0.52, 0.92);
  if (uMaterial < 12.5) return vec3(1.0, 0.58, 0.24);
  if (uMaterial < 13.5) return vec3(0.92, 0.62, 0.34);
  if (uMaterial < 14.5) return vec3(0.42, 0.69, 1.0);
  if (uMaterial < 15.5) return vec3(1.0, 0.61, 0.28);
  if (uMaterial < 16.5) return vec3(1.0, 0.55, 0.35);
  if (uMaterial < 17.5) return vec3(0.58, 0.82, 1.0);
  if (uMaterial < 18.5) return vec3(0.18, 0.94, 0.86);
  return vec3(1.0, 0.64, 0.20);
}

void main() {
  vec2 screen = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  vec3 backgroundRay = normalize(vec3(screen.x * 0.82, screen.y * 0.82, 1.0));
  vec3 weather = environment(cameraEnvironmentRay(backgroundRay), 5.0);
  vec3 field = materialField();
  float backdropCloud = uMaterial > 4.5
    ? uTextureParams.w
    : 0.12 + uAppearance * 0.12;
  vec3 color = mix(field, weather, backdropCloud);

  float vignette = smoothstep(0.82, 0.08, length(screen));
  color *= mix(0.56, 1.0, vignette);

  vec2 orb = (gl_FragCoord.xy - uCenter) / max(1.0, uRadius);
  float radius2 = dot(orb, orb);
  float distanceFromCenter = sqrt(radius2);

  // A soft contact shadow belongs to the orb, not the gameplay overlay.
  vec2 shadowUv = (gl_FragCoord.xy - (uCenter + vec2(0.0, -uRadius * 0.86))) /
    vec2(uRadius * 1.08, uRadius * 0.24);
  float shadow = (1.0 - smoothstep(0.12, 1.0, dot(shadowUv, shadowUv))) *
    (1.0 - smoothstep(0.96, 1.04, distanceFromCenter));
  color *= 1.0 - shadow * (0.28 - uAppearance * 0.12);

  if (radius2 < 1.035) {
    float z = sqrt(max(0.0, 1.0 - min(radius2, 1.0)));
    vec3 normal = normalize(vec3(orb, z));
    if (uMaterial > 1.5 && uMaterial < 2.5) {
      vec2 liquid = vec2(
        sin(orb.y * 11.0 + uTime * 0.72),
        cos(orb.x * 9.0 - uTime * 0.58)
      ) * 0.012 * normal.z;
      normal = normalize(vec3(normal.xy + liquid, normal.z));
    }
    vec3 reflected = cameraEnvironmentRay(reflect(vec3(0.0, 0.0, -1.0), normal));
    float fresnel = pow(1.0 - max(normal.z, 0.0), 2.35);
    vec3 mirror;
    if (uMaterial > 4.5 && uTextureReady > 0.5 && uTextureMapping.x > 0.5) {
      vec3 surfaceRay = inverseSphereRotation(normal);
      vec3 surfaceColor = imageEnvironment(
        surfaceRay,
        0.65 + uTextureMapping.w * 2.0
      );
      vec3 reflectionColor = uTextureMapping.x < 1.5
        ? studioEnvironment(reflected)
        : imageEnvironment(reflected, 0.65 + uTextureMapping.w * 4.0);
      float surfaceWeight = clamp(
        uTextureMapping.y * (1.0 - fresnel * 0.65),
        0.0,
        1.0
      );
      mirror = mix(reflectionColor, surfaceColor, surfaceWeight);
    } else {
      mirror = environment(reflected, 0.65);
    }
    float crown = pow(max(dot(normal, normalize(vec3(-0.2, 0.8, 0.56))), 0.0), 12.0);
    mirror *= 0.64 + normal.z * 0.24;
    float reflectionStrength = uMaterial > 4.5
      ? uTextureMapping.z
      : 0.24;
    mirror += materialAccent() * crown * (0.18 + reflectionStrength * 0.52);
    mirror = mix(
      mirror,
      vec3(0.44, 0.58, 0.64),
      fresnel * (0.30 + reflectionStrength * 0.50)
    );
    mirror += vec3(0.72, 0.88, 0.95) * pow(fresnel, 2.0) * 0.2;

    float mask = 1.0 - smoothstep(0.986, 1.018, distanceFromCenter);
    color = mix(color, mirror, mask);
  }

  // Keep the brightest environment feature below UI-white so seams/counts win.
  color = color / (1.0 + color * 0.5);
  color = pow(max(color, 0.0), vec3(0.92));
  outColor = vec4(color, 1.0);
}
`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function programFor(gl) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || "Unknown shader link error";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  class MaterialRenderer {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.game = null;
      this.gl = null;
      this.program = null;
      this.buffer = null;
      this.texture = null;
      this.textureReady = 0;
      this.textureLoadToken = 0;
      this.uniforms = {};
      this.materialIndex = materialIndex(initialMaterial(options));
      this.appearance = 0;
      this.axes = { field: "dark", shell: "dark", well: "light" };
      this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      this.startedAt = performance.now();
      this.materialTime = 0;
      this.lastTimeAt = this.startedAt;
      this.lastPaintAt = 0;
      this.frame = 0;
      this.failed = false;
      this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.mobile = matchMedia("(max-width: 700px), (pointer: coarse)").matches;
      document.body.dataset.reflectionMaterial = this.getMaterial().id;
      this.canvas.setAttribute("aria-hidden", "true");
      this.canvas.tabIndex = -1;
      this.bindEvents();
      this.initialize();
    }

    initialize() {
      try {
        const gl = this.canvas.getContext("webgl2", {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          // The game can export a share card at any point; retaining the last
          // composed frame lets Canvas 2D capture the material reliably.
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        });
        if (!gl) throw new Error("WebGL2 is unavailable");
        this.gl = gl;
        this.program = programFor(gl);
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          gl.STATIC_DRAW
        );
        const position = gl.getAttribLocation(this.program, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        [
          "uTime",
          "uAppearance",
          "uMaterial",
          "uResolution",
          "uCenter",
          "uPointer",
          "uRotation",
          "uRadius",
          "uEnvironmentMap",
          "uTextureReady",
          "uTextureParams",
          "uTextureTransform",
          "uTextureMotion",
          "uTextureMapping",
        ].forEach((name) => {
          this.uniforms[name] = gl.getUniformLocation(this.program, name);
        });
        this.texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([8, 10, 9, 255])
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform1i(this.uniforms.uEnvironmentMap, 0);
        this.failed = false;
        document.body.classList.remove("reflection-fallback");
        this.resize();
        this.start();
        this.loadSelectedTexture();
      } catch (error) {
        console.warn("Reflection material fallback:", error);
        this.useFallback();
      }
    }

    bindEvents() {
      this.onResize = () => this.resize();
      this.onPointerMove = (event) => {
        if (this.isMotionReduced()) return;
        this.pointer.tx = (event.clientX / Math.max(1, innerWidth)) * 2 - 1;
        this.pointer.ty = (event.clientY / Math.max(1, innerHeight)) * 2 - 1;
      };
      this.onVisibility = () => {
        if (document.hidden) this.stop();
        else this.start();
      };
      addEventListener("resize", this.onResize, { passive: true });
      addEventListener("pointermove", this.onPointerMove, { passive: true });
      document.addEventListener("visibilitychange", this.onVisibility);
      this.canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        this.stop();
        this.useFallback();
      });
      this.canvas.addEventListener("webglcontextrestored", () => {
        this.gl = null;
        this.program = null;
        this.initialize();
      });
    }

    isMotionReduced() {
      return this.reduceMotion || document.documentElement.dataset.effects === "reduced";
    }

    getMaterial() {
      return MATERIAL_PRESETS[this.materialIndex] || MATERIAL_PRESETS[0];
    }

    getMaterials() {
      return MATERIAL_PRESETS.map((preset) => Object.assign({}, preset));
    }

    textureURL(preset) {
      if (!preset.texture) return null;
      const embedded = global.HEXSWEEPER_REFLECTION_TEXTURES &&
        global.HEXSWEEPER_REFLECTION_TEXTURES[preset.id];
      const source = embedded || preset.texture;
      return this.mobile ? source.mobile : source.desktop;
    }

    loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load reflection texture: ${url}`));
        image.src = url;
      });
    }

    async loadSelectedTexture() {
      const token = ++this.textureLoadToken;
      const preset = this.getMaterial();
      const url = this.textureURL(preset);
      this.textureReady = 0;
      if (!url || !this.gl || !this.texture) {
        this.render(performance.now(), true);
        return;
      }
      try {
        const image = await this.loadImage(url);
        if (token !== this.textureLoadToken || !this.gl || !this.texture) return;
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        this.textureReady = 1;
        this.render(performance.now(), true);
      } catch (error) {
        if (token !== this.textureLoadToken) return;
        console.warn(`Reflection texture fallback (${preset.id}):`, error);
        this.textureReady = 0;
        this.render(performance.now(), true);
      }
    }

    announce(message) {
      const toast = document.getElementById("count-style-toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove("show"), 1200);
    }

    setMaterial(value, options) {
      options = options || {};
      this.materialIndex = materialIndex(value);
      const preset = this.getMaterial();
      document.body.dataset.reflectionMaterial = preset.id;
      if (options.persist !== false) {
        try { localStorage.setItem(MATERIAL_STORAGE_KEY, preset.id); } catch (_) {}
      }
      if (options.updateURL) {
        try {
          const next = new URL(location.href);
          next.searchParams.set("material", preset.id);
          history.replaceState(history.state, "", next);
        } catch (_) {}
      }
      this.loadSelectedTexture();
      if (this.failed) this.paintFallback();
      else this.render(performance.now(), true);
      document.dispatchEvent(new CustomEvent("hexsweeper:reflection-material", {
        detail: { id: preset.id, label: preset.label },
      }));
      if (options.announce) this.announce(`Surface · ${preset.label}`);
      return preset;
    }

    cycleMaterial(options) {
      const next = (this.materialIndex + 1) % MATERIAL_PRESETS.length;
      return this.setMaterial(next, Object.assign({
        persist: true,
        updateURL: true,
        announce: true,
      }, options));
    }

    attach(game) {
      this.game = game;
      this.resize();
      const material = this;
      const facade = Object.assign({}, game, {
        getAppearance() {
          const base = typeof game.getAppearance === "function" ? game.getAppearance() : {};
          return Object.assign({}, base, { axes: Object.assign({}, material.axes) });
        },
        setAppearanceAxes(axes) {
          material.setAppearance(axes && axes.field === "light" ? "light" : "dark");
        },
        getThemeIndex() {
          return material.appearance > 0.5 ? 0 : 2;
        },
        setThemeIndex(index) {
          const themes = global.SphereSweeper && global.SphereSweeper.THEMES;
          const theme = themes && themes[index];
          material.setAppearance(theme && theme.chrome === "light" ? "light" : "dark");
        },
      });
      this.facade = facade;
      return facade;
    }

    setAppearance(mode) {
      const light = mode === "light";
      this.appearance = light ? 1 : 0;
      this.axes = light
        ? { field: "light", shell: "light", well: "dark" }
        : { field: "dark", shell: "dark", well: "light" };
      document.body.dataset.reflectionAppearance = light ? "light" : "dark";
      document.body.dataset.sphereChrome = light ? "light" : "dark";
      this.render(performance.now(), true);
    }

    cycleAppearance() {
      this.setAppearance(this.appearance > 0.5 ? "dark" : "light");
      this.announce(this.appearance > 0.5 ? "Reflection · Light" : "Reflection · Dark");
    }

    resize() {
      const cssWidth = this.canvas.clientWidth || innerWidth;
      const cssHeight = this.canvas.clientHeight || innerHeight;
      if (!cssWidth || !cssHeight) return;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const quality = this.mobile ? 0.58 : 0.74;
      const edgeCap = this.mobile ? 820 : 1280;
      let scale = dpr * quality;
      scale = Math.min(scale, edgeCap / Math.max(cssWidth, cssHeight));
      scale = Math.max(0.5, scale);
      const width = Math.max(2, Math.round(cssWidth * scale));
      const height = Math.max(2, Math.round(cssHeight * scale));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      if (this.gl) this.gl.viewport(0, 0, width, height);
      if (this.failed) this.paintFallback();
    }

    useFallback() {
      this.failed = true;
      document.body.classList.add("reflection-fallback");
      this.paintFallback();
    }

    paintFallback() {
      if (!this.game) return;
      const disk = this.game.getSphereScreen();
      const light = this.appearance > 0.5;
      const fallback = this.getMaterial().fallback;
      const field = light ? "#bcc4c7" : fallback[0];
      const rim = light ? "#d9e0e1" : fallback[1];
      const crown = light ? "#ffd9a4" : fallback[2];
      const abyss = light ? "#263746" : fallback[3];
      this.canvas.style.background =
        `radial-gradient(circle ${disk.r}px at ${disk.cx}px ${disk.cy}px, ` +
        `${crown} 0%, ${rim} 25%, ${abyss} 72%, #020609 98%, transparent 100%), ` +
        `linear-gradient(180deg, ${field}, ${light ? "#8f999e" : "#020507"})`;
    }

    start() {
      if (this.frame || document.hidden) return;
      this.lastTimeAt = performance.now();
      this.frame = requestAnimationFrame((time) => this.loop(time));
    }

    stop() {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    loop(time) {
      this.frame = 0;
      const menuOpen = document.body.classList.contains("hex-bloom-open");
      const frameMs = menuOpen ? 120 : this.mobile ? 33 : 22;
      if (time - this.lastPaintAt >= frameMs) {
        this.render(time, false);
        this.lastPaintAt = time;
      }
      this.start();
    }

    render(time, force) {
      if (this.failed) {
        this.paintFallback();
        return;
      }
      const gl = this.gl;
      if (!gl || !this.program || !this.game) return;
      const menuOpen = document.body.classList.contains("hex-bloom-open");
      const motionReduced = this.isMotionReduced();
      const dt = Math.min(50, Math.max(0, time - this.lastTimeAt));
      this.lastTimeAt = time;
      if (!motionReduced && !menuOpen) this.materialTime += dt * 0.001;
      if (motionReduced) {
        this.pointer.tx = 0;
        this.pointer.ty = 0;
      }
      this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.08;
      this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.08;

      const disk = this.game.getSphereScreen();
      const state = this.game.getState();
      const sx = this.canvas.width / Math.max(1, this.canvas.clientWidth);
      const sy = this.canvas.height / Math.max(1, this.canvas.clientHeight);
      const radiusScale = (sx + sy) * 0.5;
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.uniform1f(this.uniforms.uTime, this.materialTime);
      gl.uniform1f(this.uniforms.uAppearance, this.appearance);
      gl.uniform1f(this.uniforms.uMaterial, this.materialIndex);
      const texture = this.getMaterial().texture || {};
      gl.uniform1f(this.uniforms.uTextureReady, this.textureReady);
      gl.uniform4f(
        this.uniforms.uTextureParams,
        texture.speed || 0,
        texture.exposure || 1,
        texture.saturation == null ? 1 : texture.saturation,
        texture.backdrop || 0.2
      );
      gl.uniform4f(
        this.uniforms.uTextureTransform,
        texture.scaleX || 1,
        texture.scaleY || 1,
        texture.offsetX || 0,
        texture.offsetY || 0
      );
      gl.uniform4f(
        this.uniforms.uTextureMotion,
        texture.motion || 0,
        texture.motionAmount || 0,
        texture.motionRate || 0,
        texture.pulse || 0
      );
      const mappingMode = texture.mapping === "surface"
        ? 1
        : texture.mapping === "hybrid" ? 2 : 0;
      gl.uniform4f(
        this.uniforms.uTextureMapping,
        mappingMode,
        texture.surfaceMix || 0,
        texture.reflectionStrength == null ? 0.24 : texture.reflectionStrength,
        texture.roughness || 0
      );
      gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform2f(
        this.uniforms.uCenter,
        disk.cx * sx,
        this.canvas.height - disk.cy * sy
      );
      gl.uniform2f(this.uniforms.uPointer, this.pointer.x, -this.pointer.y);
      gl.uniform2f(this.uniforms.uRotation, state.rotY || 0, state.rotX || 0);
      gl.uniform1f(this.uniforms.uRadius, disk.r * radiusScale * 0.945);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.canvas.style.opacity = menuOpen ? "0.64" : "1";
      this.canvas.style.filter = menuOpen ? "blur(3px) saturate(.72)" : "none";
      if (force) gl.flush();
    }
  }

  function boot(options) {
    options = options || {};
    const canvas = document.getElementById(options.canvasId || "reflectionCanvas");
    if (!canvas) throw new Error("MirrorMaterial: canvas not found");
    const material = new MaterialRenderer(canvas, options);
    material.setAppearance(options.appearance || "dark");
    return material;
  }

  global.MirrorMaterial = {
    boot,
    MATERIALS: MATERIAL_PRESETS.map((preset) => Object.assign({}, preset)),
    THEME: REFLECTION_THEME,
  };
})(typeof window !== "undefined" ? window : globalThis);
