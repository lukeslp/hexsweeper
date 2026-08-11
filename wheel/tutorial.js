/* Three-step, image-led Water Wheel tutorial. */
(function (global) {
  "use strict";

  let step = 0;
  let wired = false;

  function nodes() {
    const root = document.getElementById("help-overlay");
    return {
      root,
      panel: document.getElementById("help-panel"),
      steps: root ? Array.from(root.querySelectorAll(".tutorial-step")) : [],
      progress: document.getElementById("tutorial-progress"),
      status: document.getElementById("tutorial-status"),
      back: document.getElementById("tutorial-back"),
      next: document.getElementById("tutorial-next"),
      play: document.getElementById("help-done-btn"),
      skip: document.getElementById("help-close-btn"),
      art: root ? Array.from(root.querySelectorAll(".tutorial-image")) : [],
    };
  }

  function sync(announce) {
    const ui = nodes();
    if (!ui.steps.length) return;
    step = Math.max(0, Math.min(ui.steps.length - 1, step));
    ui.steps.forEach((item, index) => {
      item.hidden = index !== step;
      item.setAttribute("aria-hidden", index === step ? "false" : "true");
    });
    if (ui.progress) ui.progress.textContent = step + 1 + " / " + ui.steps.length;
    if (ui.back) ui.back.hidden = step === 0;
    if (ui.next) ui.next.hidden = step === ui.steps.length - 1;
    if (ui.play) ui.play.hidden = step !== ui.steps.length - 1;
    if (announce && ui.status) {
      const title = ui.steps[step].querySelector("h3");
      ui.status.textContent =
        "Step " + (step + 1) + " of " + ui.steps.length +
        (title ? ": " + title.textContent : "");
    }
  }

  function go(delta) {
    const count = nodes().steps.length;
    if (!count) return;
    step = Math.max(0, Math.min(count - 1, step + delta));
    sync(true);
  }

  function reset() {
    step = 0;
    sync(false);
  }

  function init() {
    if (wired) {
      sync(false);
      return;
    }
    const ui = nodes();
    if (!ui.root || !ui.steps.length) return;
    wired = true;
    ui.back?.addEventListener("click", () => go(-1));
    ui.next?.addEventListener("click", () => go(1));
    let startX = null;
    let swiped = false;
    ui.art.forEach((image) => {
      image.addEventListener("click", () => {
        if (swiped) {
          swiped = false;
          return;
        }
        if (step < ui.steps.length - 1) go(1);
      });
      image.addEventListener(
        "pointerdown",
        (event) => {
          startX = event.clientX;
        },
        { passive: true }
      );
      image.addEventListener(
        "pointerup",
        (event) => {
          if (startX == null) return;
          const distance = event.clientX - startX;
          startX = null;
          if (Math.abs(distance) < 44) return;
          swiped = true;
          go(distance < 0 ? 1 : -1);
        },
        { passive: true }
      );
    });
    ui.panel?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      go(event.key === "ArrowRight" ? 1 : -1);
    });
    sync(false);
  }

  global.WheelTutorial = Object.freeze({ init, reset });
})(typeof window !== "undefined" ? window : globalThis);
