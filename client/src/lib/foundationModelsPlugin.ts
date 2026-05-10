/**
 * Capacitor bridge to Apple's on-device LLM (FoundationModels, iOS 26+).
 *
 * Three plugin methods, three JS entry points that share a single timeout/
 * cache/diagnostics envelope (`runWithBridge`):
 *
 *   - `tryOnDeviceFirst`            → free-form string text
 *   - `tryOnDeviceIrisLineFirst`    → @Generable IrisLine (typed `{line}`)
 *   - `tryOnDeviceFloorFlavorFirst` → @Generable FloorFlavor (typed `{name, description}`)
 *
 * On non-iOS platforms (including web) these are no-ops that resolve null —
 * the caller falls back to a static text pack.
 */

import { registerPlugin } from "@capacitor/core";
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

export interface FoundationModelsPlugin {
    /** Reports whether on-device generation can run on this device + OS. */
    isAvailable(): Promise<FMAvailability>;

    /** Free-form generation. Returns whatever text the model produces. */
    generate(opts: FMGenerateOptions): Promise<FMResponse>;

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
}

export const FoundationModels = registerPlugin<FoundationModelsPlugin>(
    "FoundationModels"
);

// Per-session cache. JS is single-threaded so the only "race" is two
// concurrent first-callers both seeing null and both probing isAvailable;
// they'll both write the same value back. Idempotent. Cache is invalidated
// on app foreground via the `App` listener wired in main.tsx — Apple
// Intelligence can be toggled in Settings while the app is backgrounded.
let availabilityCache: boolean | null = null;

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

// ── Bridge call envelope ────────────────────────────────────────────

/**
 * Shared envelope: cache check + timeout race + diagnostic toasts +
 * cache-invalidation-on-timeout. All `tryOnDevice*First` helpers funnel
 * through here so the operational behavior (timeouts, error surfacing,
 * retry signaling) stays identical regardless of which plugin method runs.
 */
async function runWithBridge(
    opts: OnDeviceFirstOptions,
    invoke: (fm: FoundationModelsPlugin, payload: FMGenerateOptions) => Promise<FMResponse>,
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
            timeoutMs,
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
    opts: OnDeviceFirstOptions,
): Promise<{ text: string } | null> {
    return runWithBridge(opts, (fm, payload) => fm.generate(payload));
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
    opts: OnDeviceFirstOptions,
): Promise<IrisLine | null> {
    const result = await runWithBridge(
        opts,
        (fm, payload) => fm.generateIrisLine(payload),
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
    opts: OnDeviceFirstOptions,
): Promise<FloorFlavor | null> {
    const result = await runWithBridge(
        opts,
        (fm, payload) => fm.generateFloorFlavor(payload),
    );
    if (result === null) return null;
    try {
        const parsed = JSON.parse(result.text) as FloorFlavor;
        if (
            typeof parsed.name === "string" && parsed.name.trim().length > 0 &&
            typeof parsed.description === "string" && parsed.description.trim().length > 0
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
