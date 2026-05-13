# Device verification (iOS)

Use this checklist after changing splash assets, the Capacitor splash plugin, `GameApp` dressing flow, or native bridge code.

## Prerequisites

- macOS with Xcode, device on iOS 26+ with Apple Intelligence if testing on-device LLM.
- From repo root: `pnpm cap:build` then `pnpm cap:open` (or open `ios/App/App.xcworkspace`).

## Cold launch

1. Force-quit the app. Relaunch.
2. Confirm **no blank frame** between native splash and the React boot screen (`SplashScreen.hide()` double-rAF in `client/src/main.tsx`).
3. Splash **background** should match near-black `#0a0a0a` (`capacitor.config.ts` + `LaunchScreen.storyboard`).

## Home screen

- App icon shows (1024 universal slot: `AppIcon-512@2x.png`).

## Gameplay (WKWebView)

- **Reveal**: tap a frontier unknown cell — clue / dressing updates.
- **Mark blocked**: **long-press** (~380 ms) on unknown (touch); **right-click** still works on desktop.
- **Pan/zoom**: drag on empty area; dragging from a hex should not steal the gesture after the hex-node canvas fix.

## Diagnostics (`?diag=1`)

Append `?diag=1` to the dev server URL or WebView entry URL (e.g. `capacitor://localhost?diag=1` if your shell supports query on the loaded URL).

- **Burst reveal** — hammers async dressing; session `dress` may exceed applied tiles (expected).
- **Force null ×3** — next three director calls return null; watch `circuit` / `fb` after the third failure + cooldown.
- **Sim rim banner** — amber rim line without generator fallback.

## Repo smoke (before device)

From repo root, `pnpm smoke` (or `pnpm smoke --fast` / `pnpm smoke --no-build`) runs typecheck, tests, native plugin registration, and Phase 7 grep invariants — see [VERIFICATION_GATES.md](VERIFICATION_GATES.md).

## Sign-off

Record date, device model, iOS build, and any anomalies in TestFlight notes or the PR.
