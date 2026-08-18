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
| 1 | Cold launch | Launch screen hands off to Sphere with no blank frame between and no prompt; an unfinished sphere run restores in place | |
| 1a | Corner glyphs | Menu (bottom left) and Help (bottom right) are visible on the closed board, at least 44 pt each, clear of the home indicator; no Games pill anywhere | |
| 1b | Menu first tap | One tap on the corner Menu opens the center flower; one tap on a flower tile (Undo, Flag, Size…) acts — no second tap needed; the corner glyph reads × while open and closes it | |
| 1c | Theme tile | The flower's swatch tile cycles Light → Dark → Stratosphere → Mercury → Ion Storm → Aurora → Galaxy → Gilded Ribbon → Heat Lightning; the choice persists across relaunch | |
| 1c′ | Textured materials | Stratosphere shows the drifting sky on the mirror (light chrome, dark glass wells); Ion Storm shows the storm cloud trailing the rotation; Galaxy, Gilded Ribbon, Heat Lightning show their textures; Aurora its curtains — all offline, in airplane mode | |
| 1d | Mercury | Mirrored WebGL body under an etched crust, liquid-metal wells on dig, gilded flags; share card includes the mirror | |
| 2 | Sphere size | On a phone in portrait the sphere spans roughly 85% of the width; margins above and below still open the flower on tap | |
| 3 | Help sheet | Help opens wide enough to read (≥340 pt on a phone), no keyboard hints, Settings pills and Done at least 44 pt tall, closes with × / Done / outside tap and never blocks the board afterwards | |
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
| 21 | Rotation | Portrait ↔ landscape reflows without losing the run or hiding the corner glyphs or the open flower | |
| 22 | Android Back | System Back closes the flower or help sheet when open, otherwise exits or follows documented platform behaviour without losing the run | |
| 23 | Android system bars | Content clears status/navigation/gesture insets in both orientations | |

## iPad gates

The app ships `TARGETED_DEVICE_FAMILY = "1,2"`, so iPad is a supported device
and Apple reviews it as one. These gates were missing entirely until
2026-08-11; nothing below has ever been checked on a tablet.

| # | Check | Pass criteria | Result |
|---|---|---|---|
| 22 | iPad launch | Launch screen and sphere fill the display; no letterboxing or phone-sized layout stranded in a corner | |
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
