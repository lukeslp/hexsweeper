#!/bin/bash
# Store screenshots of Hexsweeper on the iPhone Duo simulator, outer or inner screen.
#
#   scripts/capture-duo.sh <udid> <outer|inner> <outdir> [path/to/Hexsweeper.app]
#
# Needs a Debug build: the scenes come from the Debug-only `-HexShot "<query>"`
# launch argument (HexBridgeViewController in ios/App/App/AppDelegate.swift),
# which reloads the game with that query (?theme=..&deal=1&fresh=1), so no taps
# are needed. A Release build ignores it, and the script refuses its shots.
#
#   outer  folded Duo, `simctl io --display=1`, 1398x2034
#   inner  unfolded Duo (Device Hub), `--display=LCD-1`, 2007x2853 portrait or
#          2853x2007 landscape
#
# Shots: 01-light.png, 02-mercury.png, 03-heat-lightning.png (a fresh sphere with
# a dig already open). Each one is refused when it is the wrong size, black, not
# painted, identical to the previous scene, or when the app did not log the scene.
# Kept shots are flattened to opaque sRGB, as App Store Connect wants. Build with:
#   pnpm install && npx cap sync ios
#   cd ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
#     -destination "id=<udid>" -derivedDataPath <dd> CODE_SIGNING_ALLOWED=NO build
#   # App: <dd>/Build/Products/Debug-iphonesimulator/Hexsweeper.app
#
# Env: HEXSWEEPER_TIMEOUT seconds per scene (default 90).
set -uo pipefail

usage() { echo "usage: $0 <udid> <outer|inner> <outdir> [path/to/Hexsweeper.app]" >&2; exit 2; }
[ $# -ge 3 ] || usage
UDID=$1; SCREEN=$2; OUT=$3; APP=${4:-}
BUNDLE=app.hexodus.ios
TIMEOUT=${HEXSWEEPER_TIMEOUT:-90}
case "$SCREEN" in
  outer) DISPLAY_ARG=1;     SIZES="1398x2034" ;;
  inner) DISPLAY_ARG=LCD-1; SIZES="2007x2853 2853x2007" ;;
  *) usage ;;
esac
command -v magick >/dev/null || { echo "needs ImageMagick 7 (magick)" >&2; exit 1; }
fail() { echo "REFUSED: $*" >&2; exit 1; }

xcrun simctl list devices | grep -q "($UDID) (Booted)" || fail "simulator $UDID is not booted"
if [ "$SCREEN" = inner ]; then
  if info=$(xcrun devicectl device info displays --device "$UDID" 2>/dev/null); then
    echo "$info" | awk '/LCD-1/{f=1} f&&/ active:/{print; exit}' | grep -q "active: true" \
      || fail "inner display LCD-1 is not active: unfold the Duo in Device Hub first"
  fi
fi
if [ -n "$APP" ]; then
  id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist" 2>/dev/null)
  [ "$id" = "$BUNDLE" ] || fail "$APP is not $BUNDLE (got '$id')"
  xcrun simctl install "$UDID" "$APP" || fail "install failed"
fi

mkdir -p "$OUT"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/hexsweeper-duo.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

shot() { xcrun simctl io "$UDID" screenshot --display="$DISPLAY_ARG" --mask=ignored "$1" >/dev/null 2>&1; }
stats() { magick "$1" -alpha off -format '%w %h %[fx:mean] %[fx:standard_deviation]' info: 2>/dev/null; }
logged() {
  xcrun simctl spawn "$UDID" log show --start "$1" --style compact \
    --predicate 'eventMessage CONTAINS "HexShot: "' 2>/dev/null | grep -q "HexShot: $2"
}

prev_shot=""; n=0
for scene in light mercury heat-lightning; do
  n=$((n + 1))
  case "$scene" in
    light)           name=01-light ;;
    mercury)         name=02-mercury ;;
    heat-lightning)  name=03-heat-lightning ;;
  esac
  query="theme=$scene&deal=1&fresh=1"
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
  start=$(date '+%Y-%m-%d %H:%M:%S')
  xcrun simctl launch "$UDID" "$BUNDLE" -HexShot "$query" >/dev/null || fail "launch failed for $scene"
  prev=""; ok=""; t0=$SECONDS
  while [ $((SECONDS - t0)) -lt "$TIMEOUT" ]; do
    sleep 3
    cur="$WORK/$scene-$SECONDS.png"
    shot "$cur" || continue
    read -r w h mean sd <<<"$(stats "$cur")"
    # Painted and nearly still for two frames (Mercury's liquid metal drifts a little).
    if awk -v s="$sd" 'BEGIN{exit !(s > 0.1)}' && [ -n "$prev" ] \
       && awk -v d="$(magick compare -metric AE -fuzz 3% "$prev" "$cur" null: 2>&1 | cut -d' ' -f1)" 'BEGIN{exit !(d+0 < 20000)}'; then
      ok=$cur; break
    fi
    prev=$cur
  done
  logged "$start" "$query" || fail "$scene: the app never logged 'HexShot: $query' (a Release build, or the hook is gone)"
  [ -n "$ok" ] || fail "$scene: no steady, painted screen within ${TIMEOUT}s (last: ${w:-?}x${h:-?} mean ${mean:-?} sd ${sd:-?})"
  read -r w h mean sd <<<"$(stats "$ok")"
  echo " $SIZES " | grep -q " ${w}x${h} " || fail "$scene: ${w}x${h}, expected one of: $SIZES"
  awk -v m="$mean" 'BEGIN{exit !(m > 0.02)}' || fail "$scene: black screen (mean $mean)"
  if [ -n "$prev_shot" ] && [ "$(magick compare -metric AE -fuzz 2% "$prev_shot" "$ok" null: 2>&1 | cut -d' ' -f1)" = "0" ]; then
    fail "$scene: identical to the previous scene (the theme did not change)"
  fi
  prev_shot=$ok
  magick "$ok" -background black -alpha remove -alpha off -define png:color-type=2 "$OUT/$name.png" || fail "flatten failed"
  ch=$(magick identify -format '%[channels]' "$OUT/$name.png")
  [ "${ch%% *}" = srgb ] || fail "$scene: expected opaque sRGB after flattening, got '$ch'"
  printf '%s  %sx%s  mean %.3f  sd %.3f  %s\n' "$OUT/$name.png" "$w" "$h" "$mean" "$sd" "$ch"
done
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
echo "ok: $n $SCREEN shots in $OUT"
