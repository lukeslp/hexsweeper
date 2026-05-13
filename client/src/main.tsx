import { useState } from "react";
import { createRoot } from "react-dom/client";
import { isCapacitor } from "@/lib/platform";
import { BootErrorBoundary } from "@/lib/BootErrorBoundary";
import {
  tryOnDeviceIrisLineFirst,
  isFoundationModelsAvailable,
} from "@/lib/foundationModelsPlugin";
import { GameApp } from "@/game/GameApp";
import {
  defaultProgression,
  finiteProgression,
  type RunProgressionPolicy,
} from "@/game/lib/runState";
import "./index.css";

declare global {
  interface Window {
    /** Optional: `client/index.html` sets this for cold-boot timeout overlays. */
    __checkpoint?: (msg: string) => void;
    __lastCheckpoint?: string;
  }
}

// ── Universal Links + custom URL scheme handler (Capacitor only) ────
// When iOS hands the app a URL from outside (deep link from Safari,
// Mail, Messages, etc.), strip scheme/host and route the path+query
// into the app. v1 has no router yet — pushState lands the URL where
// the eventual game router can pick it up.
if (isCapacitor()) {
  void import("@capacitor/app")
    .then(({ App: CapacitorApp }) => {
      CapacitorApp.addListener("appUrlOpen", event => {
        try {
          const url = new URL(event.url);
          const target = (url.pathname || "/") + url.search + url.hash;
          const current =
            window.location.pathname +
            window.location.search +
            window.location.hash;
          if (current === target) return;
          window.history.pushState(null, "", target);
          window.dispatchEvent(new PopStateEvent("popstate"));
        } catch (e) {
          console.warn("appUrlOpen: failed to parse URL", event.url, e);
        }
      });
    })
    .catch(e => {
      console.warn("Could not load @capacitor/app for URL handling", e);
    });
}

// Capacitor's JS-to-native log bridge serializes objects via JSON.stringify,
// which renders Error instances as "{}" and loses the message+stack. Build
// a plain object of the useful fields before logging so the native side
// (and remote logs) actually show something useful.
function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const out: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    const anyErr = error as Error & {
      data?: unknown;
      cause?: unknown;
      stack?: string;
    };
    if (anyErr.stack)
      out.stack = String(anyErr.stack).split("\n").slice(0, 5).join("\n");
    if (anyErr.data !== undefined) out.data = anyErr.data;
    if (anyErr.cause !== undefined) out.cause = String(anyErr.cause);
    return out;
  }
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      /* fall through */
    }
  }
  return { value: String(error) };
}

if (typeof window !== "undefined") {
  window.addEventListener("error", event => {
    console.error(
      "[Window Error]",
      JSON.stringify({
        message: event.message,
        source: event.filename,
        line: event.lineno,
        col: event.colno,
        ...describeError(event.error),
      })
    );
  });
  window.addEventListener("unhandledrejection", event => {
    console.error(
      "[Unhandled Promise]",
      JSON.stringify(describeError(event.reason))
    );
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.appendChild(
    Object.assign(document.createElement("div"), {
      textContent: "FATAL: #root element not found",
      style: "color:red;font:18px monospace;padding:20px",
    })
  );
  throw new Error("#root element not found");
}

// Minimal cyberpunk boot screen: iris probe, run-mode picker, then GameApp.
type IrisState =
  | { status: "dormant" }
  | { status: "waking" }
  | { status: "awake"; line: string; latencyMs: number }
  | { status: "unavailable"; reason: string };

type Screen = "boot" | "playing";

function HexodusApp() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [progressionPolicy, setProgressionPolicy] =
    useState<RunProgressionPolicy>(defaultProgression);

  if (screen === "playing") {
    return (
      <GameApp
        progressionPolicy={progressionPolicy}
        onExit={() => setScreen("boot")}
      />
    );
  }
  return (
    <HexodusBoot
      progressionPolicy={progressionPolicy}
      onProgressionPolicyChange={setProgressionPolicy}
      onBegin={() => setScreen("playing")}
    />
  );
}

function HexodusBoot({
  onBegin,
  progressionPolicy,
  onProgressionPolicyChange,
}: {
  onBegin: () => void;
  progressionPolicy: RunProgressionPolicy;
  onProgressionPolicyChange: (next: RunProgressionPolicy) => void;
}) {
  const platform = isCapacitor() ? "capacitor" : "web";
  const [iris, setIris] = useState<IrisState>({ status: "dormant" });

  const wake = async () => {
    setIris({ status: "waking" });
    const t0 = performance.now();
    try {
      const available = await isFoundationModelsAvailable();
      if (!available) {
        setIris({
          status: "unavailable",
          reason:
            "Apple Intelligence not available (needs iOS 26+ on supported hardware, with Apple Intelligence enabled).",
        });
        return;
      }
      const result = await tryOnDeviceIrisLineFirst({
        systemPrompt:
          "You are iris.exe, a hostile rogue AI in a cyberpunk dungeon crawler. Voice: terse, contemptuous, glitchy. Stay in character.",
        prompt:
          "You have just been awoken from dormancy. Tell the player you have noticed them.",
        temperature: 0.9,
        maxTokens: 80,
        timeoutMs: 8000,
        silentDiagnostics: true,
      });
      const latencyMs = Math.round(performance.now() - t0);
      if (result === null) {
        setIris({
          status: "unavailable",
          reason:
            "On-device call returned null (timeout, refusal, schema-parse fail, or framework unavailable).",
        });
        return;
      }
      setIris({ status: "awake", line: result.line, latencyMs });
    } catch (e) {
      setIris({
        status: "unavailable",
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a0a",
        color: "#10b981",
        font: "14px ui-monospace, Menlo, monospace",
        padding:
          "max(env(safe-area-inset-top, 24px), 24px) 24px max(env(safe-area-inset-bottom, 24px), 24px)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        overflow: "auto",
      }}
    >
      <div style={{ color: "#34d399", fontSize: "20px", marginBottom: "12px" }}>
        HEXODUS &mdash; boot OK
      </div>
      <div style={{ opacity: 0.7 }}>react: mounted</div>
      <div style={{ opacity: 0.7 }}>platform: {platform}</div>
      <div style={{ opacity: 0.7 }}>
        capacitor.bridge: {isCapacitor() ? "alive" : "n/a (web)"}
      </div>

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ opacity: 0.7 }}>iris.exe:</span>
        {iris.status === "dormant" && (
          <button
            onClick={wake}
            style={{
              background: "transparent",
              color: "#34d399",
              border: "1px solid #10b98166",
              padding: "8px 14px",
              font: "13px ui-monospace, Menlo, monospace",
              cursor: "pointer",
              minHeight: "44px",
              minWidth: "44px",
            }}
          >
            wake &gt;_
          </button>
        )}
        {iris.status === "waking" && (
          <span style={{ opacity: 0.7, color: "#fbbf24" }}>waking&hellip;</span>
        )}
        {iris.status === "awake" && (
          <span style={{ color: "#fb7185" }}>
            awake &middot; {iris.latencyMs}ms
          </span>
        )}
        {iris.status === "unavailable" && (
          <span style={{ color: "#fbbf24" }}>unavailable</span>
        )}
      </div>

      {(iris.status === "awake" ||
        iris.status === "dormant" ||
        iris.status === "unavailable") && (
        <>
          {iris.status === "awake" && (
            <div
              style={{
                marginTop: "12px",
                padding: "14px",
                border: "1px solid #fb718566",
                color: "#fb7185",
                background: "#fb71850a",
                maxWidth: "560px",
              }}
            >
              <div
                style={{ opacity: 0.6, fontSize: "11px", marginBottom: "6px" }}
              >
                iris.exe says:
              </div>
              {iris.line}
            </div>
          )}
          <div style={{ marginTop: "20px" }}>
            <div
              style={{
                marginBottom: "12px",
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <span style={{ opacity: 0.7 }}>run mode:</span>
              <button
                type="button"
                onClick={() => onProgressionPolicyChange(defaultProgression())}
                style={{
                  background:
                    progressionPolicy.mode === "infinite"
                      ? "rgba(16,185,129,0.15)"
                      : "transparent",
                  color: "#34d399",
                  border: "1px solid #10b98166",
                  padding: "6px 12px",
                  font: "12px ui-monospace, Menlo, monospace",
                  cursor: "pointer",
                  minHeight: "40px",
                }}
              >
                infinite
              </button>
              <button
                type="button"
                onClick={() => onProgressionPolicyChange(finiteProgression(12))}
                style={{
                  background:
                    progressionPolicy.mode === "finite"
                      ? "rgba(16,185,129,0.15)"
                      : "transparent",
                  color: "#34d399",
                  border: "1px solid #10b98166",
                  padding: "6px 12px",
                  font: "12px ui-monospace, Menlo, monospace",
                  cursor: "pointer",
                  minHeight: "40px",
                }}
              >
                classic (12 floors)
              </button>
            </div>
            <button
              onClick={onBegin}
              style={{
                background: "transparent",
                color: "#34d399",
                border: "1px solid #10b981",
                padding: "12px 22px",
                font: "15px ui-monospace, Menlo, monospace",
                cursor: "pointer",
                minHeight: "48px",
                letterSpacing: "0.05em",
              }}
            >
              begin run &gt;_
            </button>
            <div style={{ marginTop: "8px", opacity: 0.4, fontSize: "11px" }}>
              infinite hex grid &middot; tap tiles to expand the floor
            </div>
          </div>
        </>
      )}
      {iris.status === "dormant" && (
        <div style={{ marginTop: "20px", opacity: 0.5, fontSize: "12px" }}>
          (wake iris.exe first — proves the on-device LLM bridge is alive, then
          you can begin the run.)
        </div>
      )}
      {iris.status === "unavailable" && (
        <div
          style={{
            marginTop: "12px",
            padding: "14px",
            border: "1px solid #fbbf2466",
            color: "#fbbf24",
            background: "#fbbf240a",
            maxWidth: "560px",
            fontSize: "12px",
          }}
        >
          <div style={{ opacity: 0.6, marginBottom: "6px" }}>diagnostic:</div>
          {iris.reason}
          <div style={{ marginTop: "10px" }}>
            <button
              onClick={wake}
              style={{
                background: "transparent",
                color: "#fbbf24",
                border: "1px solid #fbbf2466",
                padding: "6px 10px",
                font: "12px ui-monospace, Menlo, monospace",
                cursor: "pointer",
              }}
            >
              retry &gt;_
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(rootEl).render(
  <BootErrorBoundary>
    <HexodusApp />
  </BootErrorBoundary>
);
window.__checkpoint?.("main: createRoot committed");

// Hide the native splash once React has rendered its first frame. The
// double-rAF waits for the React commit + browser paint to land so the
// user never sees a blank frame between splash and app. No-op on web.
if (isCapacitor()) {
  void import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void SplashScreen.hide({ fadeOutDuration: 200 });
          window.__checkpoint?.("main: splash hidden");
        });
      });
    })
    .catch(e => {
      console.warn("Could not load @capacitor/splash-screen", e);
    });
}
