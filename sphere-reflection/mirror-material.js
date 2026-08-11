/**
 * File Purpose: Procedural reflection field beneath the Canvas 2D Hexsweeper sphere.
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
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uPointer;
uniform vec2 uRotation;
uniform float uRadius;

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

vec3 environment(vec3 ray) {
  ray.yz = rotate2(uRotation.y * 0.035 + uPointer.y * 0.055) * ray.yz;
  ray.xz = rotate2(-uRotation.x * 0.028 - uPointer.x * 0.07) * ray.xz;

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

void main() {
  vec2 screen = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  vec3 backgroundRay = normalize(vec3(screen.x * 0.82, screen.y * 0.82, 1.0));
  vec3 weather = environment(backgroundRay);
  vec3 nightField = vec3(0.012, 0.019, 0.024);
  vec3 dayField = vec3(0.72, 0.76, 0.77);
  vec3 field = mix(nightField, dayField, uAppearance);
  float backdropCloud = 0.12 + uAppearance * 0.12;
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
    vec3 reflected = reflect(vec3(0.0, 0.0, -1.0), normal);
    vec3 mirror = environment(reflected);
    float fresnel = pow(1.0 - max(normal.z, 0.0), 2.35);
    float crown = pow(max(dot(normal, normalize(vec3(-0.2, 0.8, 0.56))), 0.0), 12.0);
    mirror *= 0.64 + normal.z * 0.24;
    mirror += vec3(1.0, 0.72, 0.42) * crown * 0.3;
    mirror = mix(mirror, vec3(0.44, 0.58, 0.64), fresnel * 0.46);
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
    constructor(canvas) {
      this.canvas = canvas;
      this.game = null;
      this.gl = null;
      this.program = null;
      this.buffer = null;
      this.uniforms = {};
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
          "uResolution",
          "uCenter",
          "uPointer",
          "uRotation",
          "uRadius",
        ].forEach((name) => {
          this.uniforms[name] = gl.getUniformLocation(this.program, name);
        });
        this.failed = false;
        document.body.classList.remove("reflection-fallback");
        this.resize();
        this.start();
      } catch (error) {
        console.warn("Reflection material fallback:", error);
        this.useFallback();
      }
    }

    bindEvents() {
      this.onResize = () => this.resize();
      this.onPointerMove = (event) => {
        if (this.reduceMotion) return;
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
      const toast = document.getElementById("count-style-toast");
      if (toast) {
        toast.textContent = this.appearance > 0.5 ? "Reflection · Light" : "Reflection · Dark";
        toast.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove("show"), 1200);
      }
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
      const field = light ? "#bcc4c7" : "#070d12";
      const rim = light ? "#d9e0e1" : "#53646c";
      const crown = light ? "#ffd9a4" : "#d99358";
      const abyss = light ? "#263746" : "#00101e";
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
      const dt = Math.min(50, Math.max(0, time - this.lastTimeAt));
      this.lastTimeAt = time;
      if (!this.reduceMotion && !menuOpen) this.materialTime += dt * 0.001;
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
      gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform2f(
        this.uniforms.uCenter,
        disk.cx * sx,
        this.canvas.height - disk.cy * sy
      );
      gl.uniform2f(this.uniforms.uPointer, this.pointer.x, -this.pointer.y);
      gl.uniform2f(this.uniforms.uRotation, state.rotY || 0, state.rotX || 0);
      gl.uniform1f(this.uniforms.uRadius, disk.r * radiusScale * 0.945);
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
    const material = new MaterialRenderer(canvas);
    material.setAppearance(options.appearance || "dark");
    return material;
  }

  global.MirrorMaterial = {
    boot,
    THEME: REFLECTION_THEME,
  };
})(typeof window !== "undefined" ? window : globalThis);
