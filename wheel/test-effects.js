"use strict";

require("./effects.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const API = global.WheelEffects;
assert(API, "WheelEffects global is missing");
assert(API.PROFILES.calm, "calm profile is missing");
assert(API.PROFILES.kinetic, "kinetic profile is missing");
const bubblesOnly = API.composeProfile("calm", {
  id: "bubbles-only",
  quench: 1,
});
const customFx = API.create({ profile: bubblesOnly, reduceMotion: false });
customFx.emit("quench", { x: 100, y: 140, surfaceY: 90, r: 20 });
assert(customFx.hasActive(), "custom channel composition produced no effects");

const fx = API.create({ profile: "kinetic", reduceMotion: false });
assert(fx.getProfile() === "kinetic", "kinetic profile did not load");
fx.emit("quench", { x: 100, y: 140, surfaceY: 90, r: 20 });
assert(fx.hasActive(), "kinetic quench produced no effect state");

const gradient = { addColorStop() {} };
const ctx = new Proxy(
  {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  },
  {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }
);
fx.drawCaustics(ctx, performance.now(), {
  cx: 100,
  cy: 100,
  r: 80,
  surf: 100,
});
fx.drawEvents(ctx, performance.now(), {
  surfaceAt: () => 90,
});

assert(fx.setProfile("calm"), "calm profile was rejected");
assert(!fx.hasActive(), "profile switch did not clear prior effects");
fx.emit("quench", { x: 100, y: 140, surfaceY: 90, r: 20 });
assert(!fx.hasActive(), "calm profile should preserve the base renderer");
assert(!fx.setProfile("missing"), "unknown profile should be rejected");
assert(fx.getProfile() === "calm", "rejected profile changed active profile");

console.log("Wheel effect profile tests — OK");
