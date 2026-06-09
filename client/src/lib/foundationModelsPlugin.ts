/**
 * Capacitor bridge to Apple's on-device LLM (FoundationModels, iOS 26+).
 *
 * Four plugin methods, four JS entry points that share a single timeout/
 * cache/diagnostics envelope (`runWithBridge`):
 *
 *   - `tryOnDeviceFirst`            → free-form string text
 *   - `tryOnDeviceIrisLineFirst`    → @Generable IrisLine (typed `{line}`)
 *   - `tryOnDeviceFloorFlavorFirst` → @Generable FloorFlavor (typed `{name, description}`)
 *   - `tryOnDeviceTerminalTakeoverFirst` → @Generable TerminalTakeover (`{line}`)
 *   - `tryOnDeviceTileDressingFirst`    → @Generable TileDressingBatch (legacy; not used by director)
 *   - `tryOnDeviceFirstStreaming`       → free-form `generateStreaming` + chunk
 *     events (`foundationModelsStreamChunk`) for terminal / HUD taps
 *
 * On non-iOS platforms (including web) these are no-ops that resolve null —
 * the caller falls back to a static text pack.
 */

import { registerPlugin, type Plugin } from "@capacitor/core";
import { toast } from "sonner";
import { getPlatform } from "./platform";

export interface FMGenerateOptions {
  /** User prompt. */
  prompt: string;
  /** Optional system instructions handed to LanguageModelSession. */
  systemPrompt?: string;
  /** 0.0 (deterministic) to 1.5+ (creative). Default 0.7. */
  temperature: number;
  /** Maximum tokens to generate. Default 1024. */
  maxTokens: number;
}

export interface FMResponse {
  text: string;
}

export interface FMAvailability {
  available: boolean;
  /** Reason string when unavailable (iOS<26, no Apple Intelligence, framework missing, etc.). */
  reason?: string;
}

/** Native → JS event for `generateStreaming` partial text (aggregated so far). */
export const FOUNDATION_MODELS_STREAM_EVENT = "foundationModelsStreamChunk";

export interface FoundationModelsStreamChunk {
  streamId: string;
  text: string;
}

export interface FoundationModelsPlugin extends Plugin {
  /** Reports whether on-device generation can run on this device + OS. */
  isAvailable(): Promise<FMAvailability>;

  /** Free-form generation. Returns whatever text the model produces. */
  generate(opts: FMGenerateOptions): Promise<FMResponse>;

  /**
   * Free-form generation with incremental `FOUNDATION_MODELS_STREAM_EVENT`
   * listener payloads `{ streamId, text }` (aggregated response text).
   */
  generateStreaming(
    opts: FMGenerateOptions & { streamId: string }
  ): Promise<FMResponse>;

  /**
   * @Generable IrisLine generation. Grammar-constrained so the framework
   * guarantees the JSON shape. Returns `{text: <JSON-encoded IrisLine>}`
   * — JS parses to `{line: string}` via `tryOnDeviceIrisLineFirst`.
   */
  generateIrisLine(opts: FMGenerateOptions): Promise<FMResponse>;

  /**
   * @Generable FloorFlavor generation. Returns JSON-encoded
   * `{name: string, description: string}` in the `text` field.
   */
  generateFloorFlavor(opts: FMGenerateOptions): Promise<FMResponse>;

  /**
   * @Generable TerminalTakeover — one short iris.exe terminal line.
   */
  generateTerminalTakeover(opts: FMGenerateOptions): Promise<FMResponse>;

  /**
   * @Generable TileDressingBatch — director tile labels + iris taunt.
   */
  generateTileDressing(opts: FMGenerateOptions): Promise<FMResponse>;
}

export const FoundationModels =
  registerPlugin<FoundationModelsPlugin>("FoundationModels");

// Per-session cache. JS is single-threaded so the only "race" is two
// concurrent first-callers both seeing null and both probing isAvailable;
// they'll both write the same value back. Idempotent. Cache is invalidated
// on app foreground via the `App` listener wired in main.tsx — Apple
// Intelligence can be toggled in Settings while the app is backgrounded.
let availabilityCache: boolean | null = null;

/**
 * Vitest-only: force the availability cache for contract tests.
 * @throws if not running under Vitest (`import.meta.env.VITEST`).
 */
export function __setAvailabilityCacheForTest(value: boolean | null): void {
  if (!import.meta.env.VITEST) {
    throw new Error("__setAvailabilityCacheForTest: Vitest only");
  }
  availabilityCache = value;
}

/**
 * Cached availability check. Returns false fast on non-iOS platforms.
 * The cache survives until invalidateFoundationModelsCache() is called.
 */
export async function isFoundationModelsAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;
  if (getPlatform() !== "ios") {
    availabilityCache = false;
    return false;
  }
  try {
    const { available } = await FoundationModels.isAvailable();
    availabilityCache = available;
    return available;
  } catch {
    availabilityCache = false;
    return false;
  }
}

/** Drop the cached availability so the next caller re-probes the bridge. */
export function invalidateFoundationModelsCache(): void {
  availabilityCache = null;
}

export interface OnDeviceFirstOptions extends FMGenerateOptions {
  /**
   * Per-call timeout in milliseconds. Defaults to 20 seconds — the Swift
   * side has its own 15s budget per call, and the JS race must run
   * longer so native errors propagate instead of getting masked by an
   * earlier JS abort.
   */
  timeoutMs?: number;
  /**
   * Suppress diagnostic toasts. Off by default — useful during the
   * on-device verification phase. Pass true for paths where the caller
   * has its own UX.
   */
  silentDiagnostics?: boolean;
}

// ── Typed @Generable payload shapes ─────────────────────────────────
// Mirror the Swift structs in ios/App/App/FoundationModelsPlugin.swift.
// Keep in sync.

export interface IrisLine {
  /** Single 6-14 word in-character taunt. */
  line: string;
}

export interface FloorFlavor {
  /** Evocative floor name, 1-3 words. */
  name: string;
  /** Single biome-flavor sentence, 6-18 words. */
  description: string;
}

export interface TerminalTakeover {
  /** One short iris.exe terminal line (max ~14 words). */
  line: string;
}

/** Single tile in a director dressing batch (mirrors Swift TileDressingItem). */
export interface TileDressingItemPayload {
  key: string;
  title: string;
  flavor: string;
  threatTone: string;
  visualHint: string;
}

/** Director expansion output from @Generable TileDressingBatch. */
export interface TileDressingBatch {
  irisLine: string;
  pacingBand?: string;
  tiles: TileDressingItemPayload[];
}

// ── Bridge call envelope ────────────────────────────────────────────

/**
 * Shared envelope: cache check + timeout race + diagnostic toasts +
 * cache-invalidation-on-timeout. All `tryOnDevice*First` helpers funnel
 * through here so the operational behavior (timeouts, error surfacing,
 * retry signaling) stays identical regardless of which plugin method runs.
 */
async function runWithBridge(
  opts: OnDeviceFirstOptions,
  invoke: (
    fm: FoundationModelsPlugin,
    payload: FMGenerateOptions
  ) => Promise<FMResponse>
): Promise<{ text: string } | null> {
  const available = await isFoundationModelsAvailable();
  if (!available) return null;

  const timeoutMs = opts.timeoutMs ?? 20000;
  const silent = opts.silentDiagnostics ?? false;

  if (!silent) {
    toast.info("✦ Trying on-device…", { duration: 800 });
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`FM timeout after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    const fmCall = invoke(FoundationModels, {
      prompt: opts.prompt,
      systemPrompt: opts.systemPrompt,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    });
    const result = await Promise.race([fmCall, timeoutPromise]);
    return { text: result.text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[FM] on-device failed, caller will fall back:", msg);
    if (!silent) {
      toast.error("On-device threw: " + msg, { duration: 4000 });
    }
    if (msg.startsWith("FM timeout")) {
      invalidateFoundationModelsCache();
    }
    return null;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

// ── Free-form text ──────────────────────────────────────────────────

/**
 * Try the on-device path for free-form text. Returns `{text}` on success
 * or null on any failure (unavailable, timeout, native reject). Caller
 * owns the fallback (static text pack, cloud, whatever).
 */
export async function tryOnDeviceFirst(
  opts: OnDeviceFirstOptions
): Promise<{ text: string } | null> {
  return runWithBridge(opts, (fm, payload) => fm.generate(payload));
}

export interface OnDeviceStreamOptions extends OnDeviceFirstOptions {
  /** Correlate native chunks; a random id is assigned when omitted. */
  streamId?: string;
  /** Called with aggregated model text whenever a chunk arrives (iOS streaming). */
  onStream?: (aggregatedText: string) => void;
}

/**
 * Same contract as `tryOnDeviceFirst`, but on iOS uses `generateStreaming`
 * and forwards partial text through `onStream`. Web/other platforms call
 * `onStream` once after `tryOnDeviceFirst` completes (if text is non-null).
 */
export async function tryOnDeviceFirstStreaming(
  opts: OnDeviceStreamOptions
): Promise<{ text: string } | null> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const silent = opts.silentDiagnostics ?? false;
  const streamId =
    opts.streamId ??
    `fm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  if (getPlatform() !== "ios") {
    const r = await tryOnDeviceFirst(opts);
    if (r?.text && opts.onStream) opts.onStream(r.text);
    return r;
  }

  const available = await isFoundationModelsAvailable();
  if (!available) return null;

  if (!silent) {
    toast.info("✦ Trying on-device…", { duration: 800 });
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`FM timeout after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  let listener: { remove: () => Promise<void> } | undefined;
  if (opts.onStream) {
    listener = await FoundationModels.addListener(
      FOUNDATION_MODELS_STREAM_EVENT,
      (info: FoundationModelsStreamChunk) => {
        if (info.streamId === streamId && typeof info.text === "string") {
          opts.onStream!(info.text);
        }
      }
    );
  }

  try {
    const fmCall = FoundationModels.generateStreaming({
      prompt: opts.prompt,
      systemPrompt: opts.systemPrompt,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      streamId,
    });
    const result = await Promise.race([fmCall, timeoutPromise]);
    if (result.text && opts.onStream) {
      opts.onStream(result.text);
    }
    return { text: result.text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[FM] streaming failed, caller will fall back:", msg);
    if (!silent) {
      toast.error("On-device threw: " + msg, { duration: 4000 });
    }
    if (msg.startsWith("FM timeout")) {
      invalidateFoundationModelsCache();
      return null;
    }
    const fb = await tryOnDeviceFirst({
      prompt: opts.prompt,
      systemPrompt: opts.systemPrompt,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs,
      silentDiagnostics: true,
    });
    if (fb?.text && opts.onStream) opts.onStream(fb.text);
    return fb;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    if (listener) void listener.remove();
  }
}

// ── Typed @Generable helpers ────────────────────────────────────────
// These route through the structured plugin methods and parse the
// JSON-encoded result to a typed object. On parse failure (which should
// never happen since @Generable grammar-constrains decoding, but defense
// in depth), they return null and let the caller fall through to static.

/**
 * @Generable IrisLine. Returns parsed `{line}` on success, null otherwise.
 * Recommended maxTokens for callers: ~80 (taunts are short).
 */
export async function tryOnDeviceIrisLineFirst(
  opts: OnDeviceFirstOptions
): Promise<IrisLine | null> {
  const result = await runWithBridge(opts, (fm, payload) =>
    fm.generateIrisLine(payload)
  );
  if (result === null) return null;
  try {
    const parsed = JSON.parse(result.text) as IrisLine;
    if (typeof parsed.line === "string" && parsed.line.trim().length > 0) {
      return { line: parsed.line.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @Generable FloorFlavor. Returns parsed `{name, description}` on success.
 * Recommended maxTokens for callers: ~120.
 */
export async function tryOnDeviceFloorFlavorFirst(
  opts: OnDeviceFirstOptions
): Promise<FloorFlavor | null> {
  const result = await runWithBridge(opts, (fm, payload) =>
    fm.generateFloorFlavor(payload)
  );
  if (result === null) return null;
  try {
    const parsed = JSON.parse(result.text) as FloorFlavor;
    if (
      typeof parsed.name === "string" &&
      parsed.name.trim().length > 0 &&
      typeof parsed.description === "string" &&
      parsed.description.trim().length > 0
    ) {
      return {
        name: parsed.name.trim(),
        description: parsed.description.trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @Generable TerminalTakeover. Short iris disruption line for the terminal.
 */
export async function tryOnDeviceTerminalTakeoverFirst(
  opts: OnDeviceFirstOptions
): Promise<TerminalTakeover | null> {
  const result = await runWithBridge(opts, (fm, payload) =>
    fm.generateTerminalTakeover(payload)
  );
  if (result === null) return null;
  try {
    const parsed = JSON.parse(result.text) as TerminalTakeover;
    if (typeof parsed.line === "string" && parsed.line.trim().length > 0) {
      return { line: parsed.line.trim().slice(0, 160) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @Generable TileDressingBatch — director per-cell labels + iris taunt.
 */
export async function tryOnDeviceTileDressingFirst(
  opts: OnDeviceFirstOptions
): Promise<TileDressingBatch | null> {
  const result = await runWithBridge(opts, (fm, payload) =>
    fm.generateTileDressing(payload)
  );
  if (result === null) return null;
  try {
    const parsed = JSON.parse(result.text) as TileDressingBatch;
    if (
      typeof parsed.irisLine !== "string" ||
      parsed.irisLine.trim().length === 0 ||
      !Array.isArray(parsed.tiles) ||
      parsed.tiles.length === 0
    ) {
      return null;
    }
    const tiles = parsed.tiles
      .filter(
        t =>
          typeof t.key === "string" &&
          typeof t.title === "string" &&
          typeof t.flavor === "string"
      )
      .map(t => ({
        key: t.key.trim(),
        title: t.title.trim(),
        flavor: t.flavor.trim(),
        threatTone:
          typeof t.threatTone === "string" ? t.threatTone.trim() : "watching",
        visualHint:
          typeof t.visualHint === "string" ? t.visualHint.trim() : "none",
      }));
    if (tiles.length === 0) return null;
    return {
      irisLine: parsed.irisLine.trim(),
      pacingBand:
        typeof parsed.pacingBand === "string"
          ? parsed.pacingBand.trim()
          : undefined,
      tiles,
    };
  } catch {
    return null;
  }
}
