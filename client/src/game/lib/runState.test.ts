import { describe, expect, it } from "vitest";
import { createRunState, floorSeed, reduceRun } from "./runState";

describe("runState", () => {
  it("starts an active run on floor 1", () => {
    const run = createRunState({ seed: "run-seed", runId: "run-1" });

    expect(run).toEqual({
      runId: "run-1",
      seed: "run-seed",
      floor: 1,
      status: "active",
      bestFloor: 1,
      totalWrongs: 0,
    });
  });

  it("advances floors and tracks best floor", () => {
    let run = createRunState({ seed: "advance" });

    run = reduceRun(run, { type: "completeFloor" });
    run = reduceRun(run, { type: "completeFloor" });

    expect(run.floor).toBe(3);
    expect(run.bestFloor).toBe(3);
    expect(run.status).toBe("active");
  });

  it("escapes after completing floor 12", () => {
    let run = createRunState({ seed: "escape" });

    for (let i = 1; i <= 12; i++) {
      run = reduceRun(run, { type: "completeFloor" });
    }

    expect(run.floor).toBe(12);
    expect(run.bestFloor).toBe(12);
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

  it("derives reproducible floor seeds", () => {
    const a = createRunState({ seed: "same", runId: "a" });
    const b = createRunState({ seed: "same", runId: "b" });
    const c = createRunState({ seed: "different", runId: "c" });

    expect(floorSeed(a)).toBe(floorSeed(b));
    expect(floorSeed(a)).not.toBe(floorSeed(c));
  });
});
