/**
 * File Purpose: Contract tests for FM bridge envelope (cache, timeout, no-invoke paths).
 * Primary Functions: describe/it for tryOnDeviceFirst + isFoundationModelsAvailable.
 * Inputs/Outputs: Mocked Capacitor plugin + platform; asserts null results and cache rules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fmBehavior = vi.hoisted(() => ({
  isAvailable: vi.fn(async () => ({ available: true })),
  generate: vi.fn(),
  generateStreaming: vi.fn(),
  generateTerminalTakeover: vi.fn(),
  generateTileDressing: vi.fn(),
  addListener: vi.fn(async () => ({
    remove: vi.fn(async () => {}),
  })),
}));

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({
    isAvailable: fmBehavior.isAvailable,
    generate: fmBehavior.generate,
    generateStreaming: fmBehavior.generateStreaming,
    generateIrisLine: vi.fn(),
    generateFloorFlavor: vi.fn(),
  generateTerminalTakeover: fmBehavior.generateTerminalTakeover,
  generateTileDressing: fmBehavior.generateTileDressing,
  addListener: fmBehavior.addListener,
  }),
}));

vi.mock("./platform", () => ({
  getPlatform: () => "ios",
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  tryOnDeviceFirst,
  tryOnDeviceFirstStreaming,
  tryOnDeviceTerminalTakeoverFirst,
  tryOnDeviceTileDressingFirst,
  isFoundationModelsAvailable,
  invalidateFoundationModelsCache,
  __setAvailabilityCacheForTest,
} from "./foundationModelsPlugin";

describe("foundationModelsPlugin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invalidateFoundationModelsCache();
    fmBehavior.isAvailable.mockClear();
    fmBehavior.isAvailable.mockResolvedValue({ available: true });
    fmBehavior.generate.mockReset();
    fmBehavior.generateStreaming.mockReset();
    fmBehavior.generateTerminalTakeover.mockReset();
    fmBehavior.generateTileDressing.mockReset();
    fmBehavior.addListener.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    invalidateFoundationModelsCache();
  });

  it("returns null without calling generate when availability cache is false", async () => {
    __setAvailabilityCacheForTest(false);
    const p = tryOnDeviceFirst({
      prompt: "hello",
      temperature: 0.7,
      maxTokens: 8,
      silentDiagnostics: true,
    });
    await expect(p).resolves.toBeNull();
    expect(fmBehavior.generate).not.toHaveBeenCalled();
    expect(fmBehavior.isAvailable).not.toHaveBeenCalled();
  });

  it("invalidates availability cache after JS-side FM timeout", async () => {
    __setAvailabilityCacheForTest(null);
    await isFoundationModelsAvailable();
    expect(fmBehavior.isAvailable).toHaveBeenCalledTimes(1);

    fmBehavior.generate.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );

    const call = tryOnDeviceFirst({
      prompt: "hello",
      temperature: 0.7,
      maxTokens: 8,
      timeoutMs: 80,
      silentDiagnostics: true,
    });

    await vi.advanceTimersByTimeAsync(80);
    await expect(call).resolves.toBeNull();

    await isFoundationModelsAvailable();
    expect(fmBehavior.isAvailable).toHaveBeenCalledTimes(2);
  });

  it("does not invalidate cache on non-timeout bridge errors", async () => {
    __setAvailabilityCacheForTest(null);
    await isFoundationModelsAvailable();
    expect(fmBehavior.isAvailable).toHaveBeenCalledTimes(1);

    fmBehavior.generate.mockRejectedValue(new Error("native boom"));

    await expect(
      tryOnDeviceFirst({
        prompt: "hello",
        temperature: 0.7,
        maxTokens: 8,
        silentDiagnostics: true,
      })
    ).resolves.toBeNull();

    await isFoundationModelsAvailable();
    expect(fmBehavior.isAvailable).toHaveBeenCalledTimes(1);
  });

  it("parses TerminalTakeover JSON from generateTerminalTakeover", async () => {
    __setAvailabilityCacheForTest(null);
    await isFoundationModelsAvailable();
    fmBehavior.generateTerminalTakeover.mockResolvedValue({
      text: JSON.stringify({ line: "  glitch line  " }),
    });
    const out = await tryOnDeviceTerminalTakeoverFirst({
      prompt: "x",
      temperature: 0.8,
      maxTokens: 40,
      silentDiagnostics: true,
    });
    expect(out).toEqual({ line: "glitch line" });
    expect(fmBehavior.generateTerminalTakeover).toHaveBeenCalledTimes(1);
  });

  it("tryOnDeviceFirstStreaming invokes onStream with final text on success", async () => {
    __setAvailabilityCacheForTest(null);
    await isFoundationModelsAvailable();
    fmBehavior.generateStreaming.mockResolvedValue({ text: "full-json" });
    const chunks: string[] = [];
    const out = await tryOnDeviceFirstStreaming({
      prompt: "p",
      temperature: 0.7,
      maxTokens: 100,
      silentDiagnostics: true,
      onStream: t => chunks.push(t),
    });
    expect(out).toEqual({ text: "full-json" });
    expect(fmBehavior.generateStreaming).toHaveBeenCalledTimes(1);
    expect(chunks).toContain("full-json");
  });

  it("tryOnDeviceTileDressingFirst parses TileDressingBatch JSON", async () => {
    __setAvailabilityCacheForTest(null);
    await isFoundationModelsAvailable();
    fmBehavior.generateTileDressing.mockResolvedValue({
      text: JSON.stringify({
        irisLine: "your edges resolve.",
        pacingBand: "ramp",
        tiles: [
          {
            key: "1,0",
            title: "Cold Lattice",
            flavor: "iris marks the route.",
            threatTone: "pressing",
            visualHint: "flicker",
          },
        ],
      }),
    });
    const out = await tryOnDeviceTileDressingFirst({
      prompt: "dress",
      temperature: 0.8,
      maxTokens: 200,
      silentDiagnostics: true,
    });
    expect(out?.irisLine).toBe("your edges resolve.");
    expect(out?.tiles[0]?.title).toBe("Cold Lattice");
    expect(fmBehavior.generateTileDressing).toHaveBeenCalledTimes(1);
  });
});
