import { describe, expect, it } from "vitest";
import {
  createRunState,
  defaultProgression,
  finiteProgression,
  floorSeed,
  milestoneBand,
  reduceRun,
} from "./runState";

describe("runState", () => {
  it("starts an active run on floor 1 with infinite progression by default", () => {
    const run = createRunState({ seed: "run-seed", runId: "run-1" });

    expect(run.runId).toBe("run-1");
    expect(run.seed).toBe("run-seed");
    expect(run.floor).toBe(1);
    expect(run.status).toBe("active");
    expect(run.bestFloor).toBe(1);
    expect(run.totalWrongs).toBe(0);
    expect(run.progression).toEqual(defaultProgression());
    expect(run.routeSalt).toBe("none");
    expect(run.sidegrades).toEqual([]);
  });

  it("advances floors and tracks best floor in infinite mode", () => {
    let run = createRunState({ seed: "advance" });

    run = reduceRun(run, { type: "completeFloor" });
    run = reduceRun(run, { type: "completeFloor" });

    expect(run.floor).toBe(3);
    expect(run.bestFloor).toBe(3);
    expect(run.status).toBe("active");
    expect(run.regionalPressure).toBeGreaterThan(0);
  });

  it("escapes after completing the cap floor in finite mode", () => {
    let run = createRunState({
      seed: "escape",
      progression: finiteProgression(12),
    });

    for (let i = 1; i <= 11; i++) {
      run = reduceRun(run, { type: "completeFloor" });
      expect(run.status).toBe("active");
    }
    expect(run.floor).toBe(12);

    run = reduceRun(run, { type: "completeFloor" });
    expect(run.status).toBe("escaped");
    expect(run.floor).toBe(12);
    expect(run.bestFloor).toBe(12);
  });

  it("finite mode respects custom maxFloors", () => {
    let run = createRunState({
      seed: "short",
      progression: finiteProgression(3),
    });
    run = reduceRun(run, { type: "completeFloor" });
    run = reduceRun(run, { type: "completeFloor" });
    expect(run.floor).toBe(3);
    run = reduceRun(run, { type: "completeFloor" });
    expect(run.status).toBe("escaped");
  });

  it("ends the run on any failed floor", () => {
    const run = reduceRun(createRunState({ seed: "caught" }), {
      type: "failRun",
      wrongsOnFloor: 3,
    });

    expect(run.status).toBe("caught");
    expect(run.totalWrongs).toBe(3);
    expect(reduceRun(run, { type: "completeFloor" })).toBe(run);
  });

  it("derives reproducible floor seeds including route salt", () => {
    const a = createRunState({ seed: "same", runId: "a" });
    const b = createRunState({ seed: "same", runId: "b" });
    const c = createRunState({ seed: "different", runId: "c" });

    expect(floorSeed(a)).toBe(floorSeed(b));
    expect(floorSeed(a)).not.toBe(floorSeed(c));

    const routed = reduceRun(a, { type: "setRouteChoice", choice: "loot" });
    expect(floorSeed(routed)).toContain(":route:loot");
  });

  it("setRouteChoice adds sidegrades for loot and risk", () => {
    let run = createRunState({ seed: "sg" });
    run = reduceRun(run, { type: "setRouteChoice", choice: "safe" });
    expect(run.sidegrades).toEqual([]);
    run = reduceRun(run, { type: "setRouteChoice", choice: "loot" });
    expect(run.sidegrades).toContain("route-loot");
    run = reduceRun(run, { type: "setRouteChoice", choice: "risk" });
    expect(run.sidegrades).toContain("route-risk");
  });

  it("milestoneBand buckets depth", () => {
    expect(milestoneBand(1)).toBe("shallow");
    expect(milestoneBand(10)).toBe("mid");
    expect(milestoneBand(20)).toBe("deep");
    expect(milestoneBand(40)).toBe("abyss");
    expect(milestoneBand(99)).toBe("endless");
  });
});
