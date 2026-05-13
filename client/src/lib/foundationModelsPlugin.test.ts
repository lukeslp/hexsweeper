/**
 * File Purpose: Contract tests for FM bridge envelope (cache, timeout, no-invoke paths).
 * Primary Functions: describe/it for tryOnDeviceFirst + isFoundationModelsAvailable.
 * Inputs/Outputs: Mocked Capacitor plugin + platform; asserts null results and cache rules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fmBehavior = vi.hoisted(() => ({
  isAvailable: vi.fn(async () => ({ available: true })),
  generate: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({
    isAvailable: fmBehavior.isAvailable,
    generate: fmBehavior.generate,
    generateIrisLine: vi.fn(),
    generateFloorFlavor: vi.fn(),
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
});
