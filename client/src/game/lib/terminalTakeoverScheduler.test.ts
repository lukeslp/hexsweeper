import { describe, expect, it } from "vitest";
import {
  MIN_EVENTS_BETWEEN_TAKEOVERS,
  createTakeoverSchedulerState,
  fallbackTakeoverLine,
  stepTakeoverScheduler,
} from "./terminalTakeoverScheduler";

describe("terminalTakeoverScheduler", () => {
  it("emits wrong takeover on wrong-reveal when rate allows", () => {
    let s = createTakeoverSchedulerState();
    for (let i = 0; i < MIN_EVENTS_BETWEEN_TAKEOVERS; i++) {
      const step = stepTakeoverScheduler(s, {
        floor: 1,
        floorEvent: "correct-reveal",
        irisControl: 0.1,
      });
      s = step.next;
    }
    const hit = stepTakeoverScheduler(s, {
      floor: 1,
      floorEvent: "wrong-reveal",
      irisControl: 0.5,
    });
    expect(hit.kind).toBe("wrong");
    expect(hit.allowFm).toBe(true);
    expect(hit.fmPrompt?.prompt).toContain("wrong-reveal");
    expect(
      fallbackTakeoverLine("wrong", hit.next.eventCount).length
    ).toBeGreaterThan(5);
  });

  it("stops scheduling takeovers after the per-floor cap", () => {
    let s = createTakeoverSchedulerState();
    const kinds: Array<string | null> = [];
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < MIN_EVENTS_BETWEEN_TAKEOVERS; i++) {
        const st = stepTakeoverScheduler(s, {
          floor: 1,
          floorEvent: "correct-reveal",
          irisControl: 0.1,
        });
        s = st.next;
      }
      const hit = stepTakeoverScheduler(s, {
        floor: 1,
        floorEvent: "wrong-reveal",
        irisControl: 0.5,
      });
      s = hit.next;
      kinds.push(hit.kind);
    }
    expect(kinds.filter(Boolean)).toHaveLength(3);
    expect(kinds[3]).toBeNull();
  });
});
