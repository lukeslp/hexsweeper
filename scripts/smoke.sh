#!/usr/bin/env bash
# Hexsweeper pre-commit / native-build smoke
#
# www/ is a prebuilt payload vendored from lukeslp/hexsweeper. The lightweight
# smoke checks source integrity and both Capacitor shells; Gradle/Xcode builds
# remain separate release gates.
#
# Usage:
#   scripts/smoke.sh              # payload integrity + cap sync
#   scripts/smoke.sh --with-source /path/to/hexsweeper
#                                 # also regenerate from source and diff
#
# CI passes --with-source after checking out hexsweeper (it is public).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SOURCE_CHECKOUT=""
if [ "${1:-}" = "--with-source" ]; then
    SOURCE_CHECKOUT="${2:?--with-source needs a path to a hexsweeper checkout}"
fi

red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green() { printf '\033[32m%s\033[0m\n'  "$*"; }
gold()  { printf '\033[33m%s\033[0m\n'  "$*"; }

TOTAL=3
[ -n "$SOURCE_CHECKOUT" ] && TOTAL=4
gold "── smoke: $(basename "$REPO_ROOT") at $(git rev-parse --short HEAD 2>/dev/null || echo 'no-git') ──"

# 1. The vendored payload matches the checksums recorded when it was vendored.
#    Catches hand-edits of www/ — the failure mode the "do not hand-edit"
#    note alone cannot prevent.
gold "[1/$TOTAL] vendored payload integrity…"
if [ ! -f WWW_SOURCE.txt ]; then
    red "  ✘ WWW_SOURCE.txt missing — cannot verify www/"
    exit 1
fi
# Checksum lines are "<sha256>  <path-relative-to-www>"; comments and the
# source_repo/source_commit keys are skipped.
if ! grep -E '^[0-9a-f]{64}  ' WWW_SOURCE.txt | (cd www && shasum -a 256 -c --status -); then
    red "  ✘ www/ does not match the checksums in WWW_SOURCE.txt"
    red "    Either www/ was hand-edited, or it was re-vendored without"
    red "    refreshing WWW_SOURCE.txt. Regenerate both together."
    exit 1
fi
RECORDED_FILES="$(grep -cE '^[0-9a-f]{64}  ' WWW_SOURCE.txt)"
ACTUAL_FILES="$(find www -type f | wc -l | tr -d ' ')"
if [ "$RECORDED_FILES" != "$ACTUAL_FILES" ]; then
    red "  ✘ www/ has $ACTUAL_FILES files but WWW_SOURCE.txt records $RECORDED_FILES"
    red "    A file was added to or removed from the payload without re-vendoring."
    exit 1
fi
green "  ✓ payload matches WWW_SOURCE.txt ($ACTUAL_FILES files)"

# 2. Capacitor can still stage the iOS project from www/.
gold "[2/$TOTAL] npx cap sync ios…"
if ! npx cap sync ios >/tmp/hexsweeper-capsync.log 2>&1; then
    red "  ✘ cap sync failed"
    tail -20 /tmp/hexsweeper-capsync.log >&2
    exit 1
fi
if [ ! -f ios/App/App/public/index.html ]; then
    red "  ✘ cap sync reported success but ios/App/App/public/index.html is missing"
    exit 1
fi
green "  ✓ cap sync; payload staged into the iOS project"

# 3. Capacitor can stage the same sealed payload into Android without adding
#    network permission to this intentionally offline app.
gold "[3/$TOTAL] npx cap sync android…"
if ! npx cap sync android >/tmp/hexsweeper-capsync-android.log 2>&1; then
    red "  ✘ Android cap sync failed"
    tail -20 /tmp/hexsweeper-capsync-android.log >&2
    exit 1
fi
if [ ! -f android/app/src/main/assets/public/index.html ]; then
    red "  ✘ cap sync reported success but Android public/index.html is missing"
    exit 1
fi
if grep -q 'android.permission.INTERNET' android/app/src/main/AndroidManifest.xml; then
    red "  ✘ offline Android shell unexpectedly requests INTERNET permission"
    exit 1
fi
green "  ✓ cap sync; offline payload staged into the Android project"

# 4. Optional: regenerate from a hexsweeper checkout and confirm the vendored
#    payload is still what that source produces. This is the gate that catches
#    hexsweeper moving on without a re-vendor here.
if [ -n "$SOURCE_CHECKOUT" ]; then
    gold "[4/$TOTAL] payload matches hexsweeper source…"
    if [ ! -x "$SOURCE_CHECKOUT/tools/export-collection.py" ] && [ ! -f "$SOURCE_CHECKOUT/tools/export-collection.py" ]; then
        red "  ✘ no tools/export-collection.py under $SOURCE_CHECKOUT"
        exit 1
    fi
    ( cd "$SOURCE_CHECKOUT" && python3 tools/export-collection.py --app >/dev/null )
    if ! diff -rq "$SOURCE_CHECKOUT/build/app" www >/tmp/hexsweeper-payload-diff.log 2>&1; then
        red "  ✘ vendored www/ differs from what hexsweeper currently produces:"
        sed 's/^/      /' /tmp/hexsweeper-payload-diff.log >&2
        red "    Re-vendor: cp -R $SOURCE_CHECKOUT/build/app/. www/ && refresh WWW_SOURCE.txt"
        exit 1
    fi
    RECORDED_COMMIT="$(awk '/^source_commit/{print $2}' WWW_SOURCE.txt)"
    ACTUAL_COMMIT="$(git -C "$SOURCE_CHECKOUT" rev-parse HEAD)"
    if [ "$RECORDED_COMMIT" != "$ACTUAL_COMMIT" ]; then
        gold "  ! payload is byte-identical, but WWW_SOURCE.txt records"
        gold "    $RECORDED_COMMIT and source is at $ACTUAL_COMMIT"
        gold "    (harmless if the sphere was untouched; refresh when convenient)"
    fi
    green "  ✓ payload matches hexsweeper source"
fi

green ""
green "smoke: all gates green"
