# Iris physical tile distortion — design north star (2026-05-16)

## Product intent

As **iris.exe** “approaches,” the player should feel a **physical field** moving
across the board: something that **enters the play surface and distorts the
actual tiles** (not only a decorative scrim). Intensity should track game
pressure (`irisControl` / related state), not arbitrary UI.

This document **stores the original interaction prototype** (mouse-driven
focus) and explains how it maps to Hexodus.

## Shipped baseline (today)

- **`IrisApproachOverlay`** in `client/src/game/GameApp.tsx` — full-screen
  Canvas2D **decorative** hex mesh: stroke thickness + shimmer + optional iris
  blob, driven by **`pressure`** (`floor.irisControl`). Does **not** warp DOM
  hex tiles under the board.

## Target evolution (phased)

1. **Overlay parity with prototype** — optional: randomized pass order,
   per-cell `seed` / `freq` / `amp` like the sketch, pupil ring, parallax on
   focus derived from pointer or from a **synthetic focus** tied to last
   expansion / frontier centroid (gameplay-readable, not raw mouse in ship).
2. **True tile coupling** — each `GameTile` (or its wrapper) receives a **2D
   offset + scale skew** from the same field sample at the tile’s **screen
   position** (requires mapping hex world → client coords under pan/zoom).
   Prefer **transform-only** (GPU-friendly) over reflowing layout.
3. **Accessibility** — respect `prefers-reduced-motion`: skip tear animation,
   cap displacement, or show static low-alpha overlay only.

## Reference prototype (author: Luke)

Saved verbatim intent: pointer moves a **focus point**; distance from a
parallax-shifted origin drives **stroke width** (“thick” hex wire = distorted
mesh); time-based cosine adds **live tear** on a subset of cells; inner shapes
read as an **iris**.

Below is a **cleaned** copy of the sketch (fixes: stray `*/*`, `</canvas>`,
redundant `var` on `lineWidth`). Original used black page + white wire; game
theme may remap colors.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Iris hex field prototype</title>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      canvas {
        position: absolute;
        background-color: black;
        z-index: 1;
      }
    </style>
  </head>
  <body>
    <canvas></canvas>
    <script>
      const canvas = document.querySelector("canvas");
      const pen = canvas.getContext("2d");

      let hexes = [];
      const hexR = 30;
      const hexW = 2 * hexR;
      const hexH = 2 * hexR * Math.sin(Math.PI / 3);
      const largeRadius = 6 * hexR;
      const closeRadius = 3 * hexR;

      let focusPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      init();
      draw();

      window.onresize = init;
      window.onpointermove = event => {
        focusPoint = { x: event.clientX, y: event.clientY };
      };

      function init() {
        hexes = [];
        pen.canvas.width = window.innerWidth;
        pen.canvas.height = window.innerHeight;

        const col = Math.ceil(pen.canvas.width / (1.5 * hexW)) + 1;
        const row = Math.ceil(pen.canvas.height / (0.5 * hexH)) + 1;

        for (let i = 0; i < col; i++) {
          for (let j = 0; j < row; j++) {
            const hOffset = j % 2 === 0 ? 0 : 0.75 * hexW;
            const x = i * 1.5 * hexW + hOffset;
            const y = (j * hexH) / 2;
            const pts = [];
            for (let ptIdx = 0; ptIdx < 6; ptIdx++) {
              pts.push({
                x: x + hexR * Math.cos((ptIdx * Math.PI) / 3),
                y: y + hexR * Math.sin((ptIdx * Math.PI) / 3),
              });
            }
            hexes.push({
              idxX: i,
              idxY: j,
              posX: x,
              posY: y,
              points: pts,
              seed: Math.random(),
              freq: Math.random(),
              amp: Math.random() * 10,
            });
          }
        }

        hexes.sort(() => 0.5 - Math.random());
      }

      function draw() {
        const t = Date.now() / 1000;

        const maxRadius = 0.7;
        const Ox =
          (focusPoint.x - canvas.width / 2) * maxRadius + canvas.width / 2;
        const Oy =
          (focusPoint.y - canvas.height / 2) * maxRadius + canvas.height / 2;

        pen.clearRect(0, 0, canvas.width, canvas.height);

        hexes.forEach(h => {
          pen.beginPath();
          pen.moveTo(h.points[0].x, h.points[0].y);
          for (let ptIdx = 1; ptIdx < 6; ptIdx++) {
            pen.lineTo(h.points[ptIdx].x, h.points[ptIdx].y);
          }
          pen.closePath();

          const distToMouse = Math.hypot(h.posX - Ox, h.posY - Oy);

          let radius = (distToMouse - closeRadius) / (largeRadius - closeRadius);
          radius += (2 * h.seed - 1) * 0.4 * radius;
          radius = clamp(radius, 0, 1);

          let lineWidth;
          if (radius === 1) {
            lineWidth = 1;
          } else {
            const maxWidth = 2 * hexR * 0.87;
            lineWidth =
              maxWidth * radius +
              (2 * h.seed - 1) * (maxWidth / 2) * radius;
            lineWidth +=
              Math.cos(t * h.freq + h.seed * 10) *
              (h.seed > 0.8 ? 1 : 0) *
              100;
            lineWidth = clamp(lineWidth, 1, maxWidth);
          }

          pen.lineWidth = lineWidth;
          pen.strokeStyle =
            radius === 0 ? "rgb(0,0,0)" : "rgb(255,255,255)";
          pen.filter = "none";
          pen.lineCap = "butt";
          pen.stroke();

          pen.fillStyle = "rgba(0,0,0,1)";
          pen.fill();
        });

        pen.beginPath();
        const irisR = 1.3 * hexR;
        pen.moveTo(Ox + irisR, Oy);
        for (let ptIdx = 1; ptIdx < 6; ptIdx++) {
          pen.lineTo(
            Ox + irisR * Math.cos((ptIdx * Math.PI) / 3),
            Oy + irisR * Math.sin((ptIdx * Math.PI) / 3),
          );
        }
        pen.closePath();
        const irisGrad = pen.createRadialGradient(
          Ox,
          Oy,
          0,
          Ox,
          Oy,
          1.3 * irisR,
        );
        irisGrad.addColorStop(0, "hsl(120,80%,15%)");
        irisGrad.addColorStop(1, "rgb(0,0,0)");
        pen.fillStyle = irisGrad;
        pen.filter = "blur(5px)";
        pen.fill();
        pen.filter = "none";

        pen.beginPath();
        const pupilR = hexR / 4;
        pen.moveTo(Ox + pupilR, Oy);
        for (let ptIdx = 1; ptIdx < 6; ptIdx++) {
          pen.lineTo(
            Ox + pupilR * Math.cos((ptIdx * Math.PI) / 3),
            Oy + pupilR * Math.sin((ptIdx * Math.PI) / 3),
          );
        }
        pen.closePath();
        pen.strokeStyle = "hsl(120,80%,50%)";
        pen.lineWidth = 3;
        pen.stroke();

        requestAnimationFrame(draw);
      }

      function clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
      }
    </script>
  </body>
</html>
```

## Notes for implementers

- **Single source of truth for “field strength”** at a screen point should
  eventually feed **both** overlay strokes **and** tile `transform`, so motion
  reads as one phenomenon.
- **Pan/zoom** (`useCanvasInteraction`) means tile positions are not fixed
  CSS boxes; sample distortion in **viewport space** after transforms, or apply
  inverse transform to the focus point.
- Performance: avoid per-frame React state for every tile; use CSS variables on
  a container + `transform` on tile wrappers, or a **small** set of layered
  canvases if we ever unify board + field.
