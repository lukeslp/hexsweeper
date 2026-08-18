# Device verification

Run on real hardware before any TestFlight, App Store, or Play release. Simulators
do not reproduce touch precision, thermal behaviour, or true safe-area geometry.

Record one row per device. Attach to the build notes.

| Field | Value |
|---|---|
| Platform / device / OS | |
| iOS build or Android version code | |
| Tester / date | |

## Gates

Everything below must pass **in airplane mode** — the payload is fully offline
and any network dependency is a defect.

| # | Check | Pass criteria | Result |
|---|---|---|---|
| 1 | Cold launch | Launch screen hands off to Sphere with no blank frame between; no dialog when nothing is saved | |
| 1a | Resume gate | With an unfinished Infinite, Classic, or Sphere run saved, cold launch shows the resume dialog naming the newest run; Resume reopens it, the other button dismisses and stays on Sphere; Escape / outside tap dismiss | |
| 1b | Mercury | Theme cycles to Mercury: mirrored WebGL body under an etched crust, liquid-metal wells on dig, gilded flags; share card includes the mirror | |
| 2 | Launcher | **‹ Games** on Sphere opens the launcher: Infinite, Classic, and Sphere are three clear hexes; each caption shows the setting that will load | |
| 3 | Launcher routes | Each hex opens the right game with its last-used settings; **‹ Games** returns to the launcher; the Sphere hex returns to the root without the dialog | |
| 3a | Launcher Resume | An unfinished Infinite, Classic, or Sphere run appears in the center with that mode's name and accent; the newest run opens intact, while pristine and finished boards leave the center empty | |
| 3b | Launcher appearance | Launcher follows the system light/dark setting, or the appearance chosen inside a game, on the next visit | |
| 4 | Infinite | Dig, flag, chord, pan, pinch, Light/Dark, and run persistence work | |
| 5 | Classic | Fixed board opens; S/M/L, dig, flag, chord, reset, and completion work | |
| 6 | Sphere render | Sphere is centred and fully visible; no clipping at any edge | |
| 7 | Sphere dig | Single tap reveals the intended tile — not a neighbour | |
| 8 | Sphere flag | Long-press flags; flag stands proud of the shell | |
| 9 | Sphere chord | Tapping a satisfied number opens its neighbours | |
| 10 | Sphere camera | One-finger drag tumbles freely; pinch zooms; no accidental digs while dragging | |
| 11 | Sphere flood | Clearing an empty region animates outward and settles correctly | |
| 12 | Sphere sizes | XS through XL all render; **note the smallest size you can still tap reliably** | |
| 13 | Sphere themes | All seven cycle; no theme shows a missing texture or flat grey | |
| 14 | Customize panel | Opens, changes apply live, undo reverts one step | |
| 15 | Share card | Produces an image; content matches the current board | |
| 16 | Safe areas | Launcher and game chrome clear the notch/Dynamic Island and home indicator in both orientations | |
| 17 | Autosave | Force-quit mid-run, relaunch, and resumable runs return intact through the correctly labeled center Resume face | |
| 18 | Backgrounding | Background 30s and return; no blank WebView, no reset | |
| 19 | Reduced Motion | Launcher and endgame effects become instant states | |
| 20 | Outbound links | Credits open in the system browser and return cleanly; the game is never replaced in-place | |
| 21 | Rotation | Portrait ↔ landscape reflows without losing the run or obscuring the mode, Resume, or expanded theme choices | |
| 22 | Android Back | From a game, **‹ Games** returns to the launcher; system Back exits or follows documented platform behaviour without losing state | |
| 23 | Android system bars | Content clears status/navigation/gesture insets in both orientations | |

## iPad gates

The app ships `TARGETED_DEVICE_FAMILY = "1,2"`, so iPad is a supported device
and Apple reviews it as one. These gates were missing entirely until
2026-08-11; nothing below has ever been checked on a tablet.

| # | Check | Pass criteria | Result |
|---|---|---|---|
| 22 | iPad launch | Launch screen and launcher fill the display; no letterboxing or phone-sized layout stranded in a corner | |
| 23 | iPad sphere | Sphere scales to the larger canvas rather than staying phone-sized; still centred and unclipped | |
| 24 | Split View / Slide Over | Resizing does not break the canvas or lose the run | |
| 25 | iPad rotation | All four orientations reflow (iPad allows upside-down, unlike iPhone) | |
| 26 | Pointer / trackpad | If a Magic Keyboard or mouse is attached, hover and click behave sanely | |
| 27 | Apple Pencil | Tap and long-press register as touch; no stray digs while resting a hand | |

## Known open question

Gate 12 is the one most likely to fail. `pickTile` uses exact polygon hit-testing
with no touch padding, and XL is 2252 faces. If small boards are comfortable but
XL is not, the fix is a per-device board cap in hexsweeper, not here.

Note that iPad's larger display cuts the other way on gate 12 — the same face
count is far more tappable on a 13-inch panel, so a phone-only cap may be the
right shape of fix.

## Sign-off

- [ ] All gates pass, or failures are recorded with issue links
- [ ] iOS build number exceeds the latest App Store Connect build (currently 33)
- [ ] Android `versionCode` exceeds the latest Play build (currently no Play listing; project starts at 1)
