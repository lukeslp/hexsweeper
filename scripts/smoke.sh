#!/usr/bin/env bash
# Hexodus pre-commit / pre-TestFlight smoke
#
# Runs the five regression-class catches that have actually bit us in
# this codebase or that we expect to bite us based on council review.
# Each section exits non-zero on failure with a clear message.
#
# Usage:
#   scripts/smoke.sh             # full smoke
#   scripts/smoke.sh --fast      # skip cap:sync:ios (just vite build)
#   scripts/smoke.sh --no-build  # skip vite build entirely (for CI that builds separately)
#
# Wire as a pre-commit hook or CI step. Designed to be <30s on warm cache.

set -euo pipefail

MODE="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green() { printf '\033[32m%s\033[0m\n'  "$*"; }
gold()  { printf '\033[33m%s\033[0m\n'  "$*"; }
gold "── smoke: $(basename "$REPO_ROOT") at $(git rev-parse --short HEAD 2>/dev/null || echo 'no-git') ──"

# 1. Type-check
gold "[1/5] pnpm check (typecheck)…"
if ! pnpm -s check 2>&1 | tail -10; then
    red "  ✘ typecheck failed"
    exit 1
fi
green "  ✓ typecheck"

# 2. Tests
gold "[2/5] pnpm test (vitest)…"
if ! pnpm -s test 2>&1 | tail -5; then
    red "  ✘ tests failed"
    exit 1
fi
green "  ✓ tests"

# 3. Native iOS plugin registration intact
gold "[3/5] FoundationModelsPlugin registration…"
if ! grep -q "registerPluginInstance.*FoundationModelsPlugin" \
        "$REPO_ROOT/ios/App/App/AppViewController.swift"; then
    red "  ✘ FoundationModelsPlugin not registered in AppViewController.swift"
    red "    This means the JS bridge will silently see 'Plugin not found' on iOS."
    red "    Restore the line: bridge?.registerPluginInstance(FoundationModelsPlugin())"
    exit 1
fi
green "  ✓ FoundationModelsPlugin registered"

# 4. AASA payload integrity (server-served — Cloudflare Worker mirror is verified separately)
gold "[4/5] AASA payload appID match…"
if ! grep -q '596T7J7FB6.app.hexmind.ios' "$REPO_ROOT/server/_core/index.ts"; then
    red "  ✘ AASA appID missing or changed in server/_core/index.ts"
    red "    Universal Links break for already-installed apps if this drifts."
    red "    Expected: 596T7J7FB6.app.hexmind.ios"
    red "    (If you're intentionally renaming the bundle, update this AND deploy"
    red "     the server BEFORE submitting the new build — see Phase 0 plan.)"
    exit 1
fi
green "  ✓ AASA appID intact"

# 5. Build + the dual-React-Internals bundle invariant
if [ "$MODE" = "--no-build" ]; then
    gold "[5/5] skip build (--no-build); React dedupe NOT verified this run"
else
    if [ "$MODE" = "--fast" ]; then
        gold "[5/5] vite build (skipping cap:sync:ios)…"
        if ! pnpm -s exec vite build --logLevel=error 2>&1 | tail -3; then
            red "  ✘ vite build failed"
            exit 1
        fi
    else
        gold "[5/5] pnpm cap:sync:ios (full build + cap copy + plugin sync)…"
        if ! pnpm -s cap:sync:ios 2>&1 | tail -3; then
            red "  ✘ cap:sync:ios failed"
            exit 1
        fi
    fi

    # The smoking-gun invariant: exactly ONE React Internals object in
    # the main bundle. >1 means the dual-React dispatcher-null bug is
    # latent and will crash on first useState. <1 means the bundle is
    # missing React entirely (impossible, but worth the assert).
    MAIN_BUNDLE="$(find "$REPO_ROOT/dist/public/assets" -name 'index-*.js' -size +500k 2>/dev/null | head -1)"
    if [ -z "$MAIN_BUNDLE" ]; then
        red "  ✘ no main bundle found in dist/public/assets/"
        exit 1
    fi
    INTERNALS_COUNT="$(grep -oE 'H:null,A:null' "$MAIN_BUNDLE" | wc -l | tr -d ' ')"
    if [ "$INTERNALS_COUNT" != "1" ]; then
        red "  ✘ DUAL-REACT REGRESSION: $INTERNALS_COUNT React Internals in $(basename "$MAIN_BUNDLE")"
        red "    Expected exactly 1. Multiple Internals = the dispatcher-null"
        red "    bug is back; useState() will crash latently."
        red ""
        red "    Fix: ensure vite.config.ts has:"
        red "      resolve: {"
        red "        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],"
        red "      }"
        red ""
        red "    If dedupe is already there, hunt for orphan packages bundling"
        red "    their own React: ls node_modules/.pnpm/*/node_modules/react"
        exit 1
    fi
    green "  ✓ build clean; React dedupe holding (1 Internals in bundle)"
fi

echo
green "smoke: all gates green"
