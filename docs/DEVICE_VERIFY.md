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

## Dual-device beta log (post Phase 7.1)

Run the same short session on **two** physical devices after a clean install or force-quit cold start. For each device, copy the HUD **session** line after ~5 minutes of play (or use `?diag=1` → **Export diag log** and note the `current` block).

| Field                                        | Device A | Device B |
| -------------------------------------------- | -------- | -------- |
| Date                                         |          |          |
| Model + iOS build                            |          |          |
| Cold launch OK (no blank frame)              | ☐        | ☐        |
| Long-press mark reliable                     | ☐        | ☐        |
| `dress` (session)                            |          |          |
| `fb` / `dress` (approx %)                    |          |          |
| `circuit` / `dress` (approx %)               |          |          |
| `rim` (count; target 0)                      |          |          |
| `?diag=1` burst / null×3 / rim sim exercised | ☐        | ☐        |
| Anomalies / notes                            |          |          |

Attach this table (or the exported JSON + `pnpm beta:diag-summary` output) to the TestFlight build notes or PR.

## Sign-off

Record date, device model, iOS build, and any anomalies in TestFlight notes or the PR.
