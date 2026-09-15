/**
 * File Purpose: Reusable, screen-space effects for Hexsweeper Water Wheel.
 * Inputs: named gameplay events plus projected CSS-pixel coordinates.
 * Outputs: wakes, bubbles, pigment wash, caustics, fuse atmosphere, and
 * water-aware detonation overlays. No gameplay or picking state is mutated.
 * Profiles: `calm` preserves the base renderer; `kinetic` composes the current
 * effects pass. Select with `?fx=calm|kinetic` or the public profile setter.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  const PROFILES = Object.freeze({
    calm: Object.freeze({
      id: "calm",
      caustics: 0,
      wake: 0,
      quench: 0,
      wash: 0,
      fuse: 0,
      detonate: 0,
      win: 0,
    }),
    kinetic: Object.freeze({
      id: "kinetic",
      caustics: 0.72,
      wake: 1,
      quench: 1,
      wash: 1,
      fuse: 0.9,
      detonate: 1,
      win: 0.85,
    }),
  });

  const MAX_PARTICLES = 180;
  const MAX_RIPPLES = 18;

  function profileFromLocation() {
    try {
      const id = new URLSearchParams(global.location.search).get("fx");
      if (id && PROFILES[id]) return id;
    } catch (_) {}
    return "kinetic";
  }

  function composeProfile(baseId, overrides) {
    const base = PROFILES[baseId] || PROFILES.calm;
    const next = Object.assign({}, base, overrides || {});
    next.id = overrides && overrides.id
      ? overrides.id
      : `${base.id}-custom`;
    return Object.freeze(next);
  }

  function resolveProfile(value) {
    if (typeof value === "string") return PROFILES[value] || null;
    if (value && typeof value === "object") {
      return composeProfile("calm", value);
    }
    return null;
  }

  function create(opts) {
    opts = opts || {};
    let profile =
      resolveProfile(opts.profile) || PROFILES[profileFromLocation()];
    const reduced =
      typeof opts.reduceMotion === "function"
        ? opts.reduceMotion
        : () => !!opts.reduceMotion;
    const particles = [];
    const ripples = [];
    const flashes = [];
    let armedVisual = null;
    let lastAt = 0;
    let lastFuseParticleAt = 0;

    function cap(list, max) {
      if (list.length > max) list.splice(0, list.length - max);
    }

    function addRipple(event, scale, kind, delay) {
      ripples.push({
        x: event.x,
        surfaceY: event.surfaceY,
        age: -(delay || 0),
        duration: reduced() ? 420 : 760,
        maxR: Math.max(18, (event.r || 24) * scale),
        strength: event.strength == null ? 1 : event.strength,
        kind: kind || "wake",
      });
      cap(ripples, MAX_RIPPLES);
    }

    function addFlash(event, color, scale) {
      flashes.push({
        x: event.x,
        y: event.y,
        age: 0,
        duration: reduced() ? 260 : 520,
        maxR: Math.max(22, (event.r || 24) * scale),
        color,
      });
      cap(flashes, 8);
    }

    function addParticle(kind, event, overrides) {
      const p = Object.assign(
        {
          kind,
          x: event.x,
          y: event.y,
          vx: 0,
          vy: -0.8,
          life: 1,
          decay: 0.018,
          r: 2,
          phase: Math.random() * Math.PI * 2,
          color: "rgba(220,248,255,0.9)",
        },
        overrides || {}
      );
      particles.push(p);
      cap(particles, MAX_PARTICLES);
    }

    function bubbleBurst(event, count, force) {
      if (reduced()) return;
      const n = Math.max(1, Math.round(count));
      for (let i = 0; i < n; i++) {
        const spread = (Math.random() - 0.5) * (event.r || 24) * 1.35;
        addParticle("bubble", event, {
          x: event.x + spread,
          y: event.y + (Math.random() - 0.5) * (event.r || 24) * 0.7,
          vx: (Math.random() - 0.5) * 0.5 * force,
          vy: -(0.45 + Math.random() * 1.35) * force,
          decay: 0.007 + Math.random() * 0.01,
          r: 1.2 + Math.random() * 3.5,
        });
      }
    }

    function pigmentBurst(event, count) {
      if (reduced()) return;
      for (let i = 0; i < count; i++) {
        addParticle("pigment", event, {
          x: event.x + (Math.random() - 0.5) * (event.r || 20),
          y: event.y + (Math.random() - 0.5) * (event.r || 20) * 0.5,
          vx: (Math.random() - 0.5) * 0.42,
          vy: 0.18 + Math.random() * 0.55,
          decay: 0.014 + Math.random() * 0.014,
          r: 1.4 + Math.random() * 3.2,
          color: `rgba(${190 + Math.random() * 45 | 0},38,44,0.78)`,
        });
      }
    }

    function emit(type, event) {
      event = event || {};
      if (!profile) return;
      if (type === "surfaceCross" && profile.wake > 0) {
        addRipple(event, event.entering ? 1.65 : 1.2, "wake");
        if (event.entering) bubbleBurst(event, 4 * profile.wake, 0.75);
      } else if (type === "dousedCross" && profile.wake > 0) {
        addRipple(event, 0.95, "doused");
        bubbleBurst(event, 2 * profile.wake, 0.55);
      } else if (type === "quench" && profile.quench > 0) {
        armedVisual = null;
        addRipple(event, 3.8 * profile.quench, "quench");
        addRipple(event, 5.2 * profile.quench, "quench", 90);
        addFlash(event, "127,224,232", 2.4 * profile.quench);
        bubbleBurst(event, 18 * profile.quench, 1.25);
      } else if (type === "wash" && profile.wash > 0) {
        addRipple(event, 1.7 * profile.wash, "wash");
        pigmentBurst(event, Math.round(16 * profile.wash));
      } else if (type === "detonate" && profile.detonate > 0) {
        armedVisual = null;
        if (event.underwater) {
          addRipple(event, 6.8 * profile.detonate, "blast");
          addRipple(event, 9.5 * profile.detonate, "blast", 100);
          addFlash(event, "226,250,255", 4.2 * profile.detonate);
          bubbleBurst(event, 30 * profile.detonate, 1.75);
        } else if (Math.abs(event.y - event.surfaceY) < (event.r || 24) * 2.8) {
          addRipple(event, 5.4 * profile.detonate, "blast");
        }
      } else if (type === "win" && profile.win > 0) {
        addRipple(event, 11 * profile.win, "win");
        addRipple(event, 15 * profile.win, "win", 130);
      }
    }

    function updateArmed(event) {
      if (!event || profile.fuse <= 0) {
        armedVisual = null;
        return;
      }
      armedVisual = Object.assign({}, event, { seenAt: event.now });
      if (
        reduced() ||
        event.paused ||
        event.submerged ||
        event.now - lastFuseParticleAt < 150 - event.urgency * 55
      ) return;
      lastFuseParticleAt = event.now;
      addParticle("steam", event, {
        x: event.x + (Math.random() - 0.5) * event.r * 0.7,
        y: event.y - event.r * (0.5 + Math.random() * 0.35),
        vx: (Math.random() - 0.5) * 0.24,
        vy: -(0.28 + Math.random() * 0.32),
        decay: 0.018 + Math.random() * 0.012,
        r: 2 + Math.random() * 3,
        color: "rgba(232,244,246,0.55)",
      });
    }

    function step(now, env) {
      const dt = lastAt ? Math.min(40, Math.max(8, now - lastAt)) / 16.67 : 1;
      lastAt = now;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.phase += 0.035 * dt;
        if (p.kind === "bubble") {
          p.x += (p.vx + Math.sin(p.phase) * 0.12) * dt;
          p.y += p.vy * dt;
          p.vy -= 0.006 * dt;
          p.r += 0.006 * dt;
          if (env.surfaceAt && p.y <= env.surfaceAt(p.x)) {
            addRipple(
              { x: p.x, surfaceY: env.surfaceAt(p.x), r: p.r * 3, strength: 0.35 },
              1.6,
              "bubble"
            );
            particles.splice(i, 1);
            continue;
          }
        } else if (p.kind === "pigment") {
          p.x += (p.vx + Math.sin(p.phase) * 0.08) * dt;
          p.y += p.vy * dt;
          p.vx *= Math.pow(0.985, dt);
          p.r += 0.012 * dt;
        } else {
          p.x += (p.vx + Math.sin(p.phase) * 0.05) * dt;
          p.y += p.vy * dt;
          p.r += 0.025 * dt;
        }
        p.life -= p.decay * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].age += dt * 16.67;
        if (ripples[i].age > ripples[i].duration) ripples.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].age += dt * 16.67;
        if (flashes[i].age > flashes[i].duration) flashes.splice(i, 1);
      }
      if (armedVisual && now - armedVisual.seenAt > 180) armedVisual = null;
    }

    function drawCaustics(ctx, now, env) {
      if (profile.caustics <= 0 || reduced()) return;
      const r = env.r;
      const left = env.cx - r;
      const right = env.cx + r;
      ctx.save();
      ctx.beginPath();
      ctx.arc(env.cx, env.cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const phase = now * (0.00042 + i * 0.00007) + i * 1.37;
        const baseY = env.surf + r * (0.12 + i * 0.19);
        ctx.beginPath();
        for (let x = left; x <= right; x += 14) {
          const y =
            baseY +
            Math.sin(x * 0.018 + phase) * r * 0.025 +
            Math.cos(x * 0.009 - phase * 1.3) * r * 0.018;
          if (x === left) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = profile.caustics * (0.045 + (i % 2) * 0.016);
        ctx.strokeStyle = i % 2 ? "#baf4ff" : "#72d6e8";
        ctx.lineWidth = Math.max(5, r * (0.012 + i * 0.002));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawEvents(ctx, now, env) {
      step(now, env);
      ctx.save();

      for (const f of flashes) {
        const u = Math.max(0, Math.min(1, f.age / f.duration));
        const radius = f.maxR * (reduced() ? 0.65 : 0.25 + u * 0.75);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
        g.addColorStop(0, `rgba(${f.color},${(1 - u) * 0.62})`);
        g.addColorStop(0.4, `rgba(${f.color},${(1 - u) * 0.22})`);
        g.addColorStop(1, `rgba(${f.color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of particles) {
        const alpha = Math.max(0, Math.min(1, p.life));
        ctx.globalAlpha = alpha;
        if (p.kind === "bubble") {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.8, p.r * 0.34);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.beginPath();
          ctx.arc(p.x - p.r * 0.28, p.y - p.r * 0.3, p.r * 0.18, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          if (p.kind === "pigment") {
            ctx.ellipse(p.x, p.y, p.r * 1.9, p.r * 0.72, p.phase, 0, Math.PI * 2);
          } else {
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (armedVisual) {
        const a = armedVisual.paused
          ? 0.08
          : 0.1 + armedVisual.urgency * 0.22;
        const wobble = reduced() ? 1 : 1 + Math.sin(now * 0.012) * 0.045;
        ctx.globalAlpha = a * profile.fuse;
        ctx.strokeStyle = armedVisual.submerged ? "#a8fff7" : "#ffc478";
        ctx.lineWidth = Math.max(1.5, armedVisual.r * 0.08);
        ctx.beginPath();
        ctx.arc(
          armedVisual.x,
          armedVisual.y,
          armedVisual.r * 1.18 * wobble,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const ripple of ripples) {
        if (ripple.age < 0) continue;
        const u = Math.max(0, Math.min(1, ripple.age / ripple.duration));
        const eased = 1 - Math.pow(1 - u, 3);
        const r = ripple.maxR * (reduced() ? 0.58 : eased);
        const y = env.surfaceAt ? env.surfaceAt(ripple.x) : ripple.surfaceY;
        const color =
          ripple.kind === "wash"
            ? "215,120,125"
            : ripple.kind === "blast"
              ? "235,252,255"
              : ripple.kind === "quench" || ripple.kind === "win"
                ? "148,242,238"
                : "196,240,250";
        ctx.globalAlpha =
          (1 - u) * 0.72 * (ripple.strength == null ? 1 : ripple.strength);
        ctx.strokeStyle = `rgba(${color},0.95)`;
        ctx.lineWidth = Math.max(1, 2.8 * (1 - u));
        ctx.beginPath();
        ctx.ellipse(ripple.x, y, r, Math.max(1.5, r * 0.16), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function hasActive() {
      return !!(
        particles.length ||
        ripples.length ||
        flashes.length ||
        armedVisual
      );
    }

    function clear() {
      particles.length = 0;
      ripples.length = 0;
      flashes.length = 0;
      armedVisual = null;
      lastAt = 0;
      lastFuseParticleAt = 0;
    }

    function setProfile(idOrProfile) {
      const next = resolveProfile(idOrProfile);
      if (!next) return false;
      profile = next;
      clear();
      return true;
    }

    return {
      emit,
      updateArmed,
      drawCaustics,
      drawEvents,
      hasActive,
      clear,
      setProfile,
      getProfile: () => profile.id,
    };
  }

  global.WheelEffects = {
    PROFILES,
    composeProfile,
    create,
    profileFromLocation,
  };
})(typeof window !== "undefined" ? window : globalThis);
