# Launch go / no-go

Use this checklist before widening TestFlight or App Store submission beyond the inner beta.

## Automated gates (must be green)

- `pnpm check`
- `pnpm test`
- `pnpm smoke` (or `pnpm smoke --fast` when skipping Cap sync; use full `pnpm smoke` before a build you ship to testers)

## Device evidence (must be green)

- Complete [DEVICE_VERIFY.md](DEVICE_VERIFY.md) on **at least two** physical iOS devices (different models if possible).
- Paste or attach the **dual-device beta log** section from that doc (dress / fb / circuit / rim + cold launch notes).

## Session diagnostics (beta bar)

- Confirm testers can **restart runs** so prior session rows append to the local log (`hexodus_session_diag_snapshots`).
- Confirm `?diag=1` **Export diag log** produces JSON you can summarize with:

  ```bash
  pnpm beta:diag-summary path/to/export.json
  ```

- Compare HUD / export rates to [VERIFICATION_GATES.md](VERIFICATION_GATES.md) rollout stop triggers (`fb`/`dress`, `circuit`/`dress`, `rim`).

## Value capture (economics stub)

- With `VITE_VALUE_CAPTURE_STUB=1` (or `?commerce=1` on web), confirm the boot **commerce stub** appears and **Grant stub unlock** persists.
- In-game HUD should show **supporter stub** after unlock (local only; no StoreKit yet).

## Apple Intelligence cache

- Background the app, toggle Apple Intelligence in Settings, return foreground — next dressing attempt should re-probe availability (`invalidateFoundationModelsCache` on `appStateChange` in `client/src/main.tsx`).

## Ship decision

Proceed only if automated gates pass, device checklist is signed on hardware, diagnostic rates are within the documented bands, and the minimal value-capture path is present for economics experiments (even if off by default in production builds).
