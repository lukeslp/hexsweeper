import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cycleDressingMode,
  getDressingMode,
  readDressingModeFromUrl,
  setDressingMode,
} from "./dressingMode";

function mockStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    clear: () => map.clear(),
  };
}

describe("dressingMode", () => {
  beforeEach(() => {
    const storage = mockStorage();
    vi.stubGlobal("window", {
      localStorage: storage,
      location: { search: "" },
    });
    vi.stubGlobal("localStorage", storage);
  });

  it("defaults to procedural", () => {
    expect(getDressingMode()).toBe("procedural");
  });

  it("persists mode in localStorage", () => {
    setDressingMode("generable");
    expect(getDressingMode()).toBe("generable");
    expect(cycleDressingMode()).toBe("procedural");
  });

  it("reads URL override when diag=1", () => {
    window.location.search = "?diag=1&dressing=generable";
    expect(readDressingModeFromUrl()).toBe("generable");
    expect(getDressingMode()).toBe("generable");
  });
});
