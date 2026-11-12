# Device verification

Run on real hardware before any TestFlight, App Store, or Play release. Simulators
do not reproduce touch precision, thermal behavior, or true safe-area geometry.

Record one row per device. Attach to the build notes.

The current source payload pins `d65b9a2`. It keeps the native first-launch
tutorial; the web game's board-first entry is a separate browser policy.
October 4 browser, exporter, smoke, and CI checks passed, but the result
column below remains blank until the candidate binary is tested on hardware.

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
| 1 | Cold launch | With no saved run or tutorial-seen marker, launch screen hands off to Sphere with no blank frame and nothing opens by itself; ? → Play → Show the tutorial opens the short tutorial and Play dismisses it; an unfinished run restores in place | |
| 1a | Quiet bar | Undo · New sphere · Flag (bottom left) and ? (bottom right) are visible, ≥ 44 pt each, clear of the home indicator; mines-left · seconds readout at the top; no Games pill, no menu | |
| 1b | Bar first tap | One tap on Undo takes back the last move; one tap on Flag arms flag mode and the glyph turns red (board taps then flag; tap again to disarm); New sphere restarts | |
| 1c | Cleared faces | Mercury liquid metal; Ion Storm cobalt, Gilded Ribbon gold, Heat Lightning copper, all with seamless interiors. Aurora has dark wells with seams; Stratosphere white wells with dark digits and seams. Galaxy has a central black hole and white nested-ring counts. **Spin every theme with faces cleared: nothing paints past the rim.** Flags red on Stratosphere and Gilded Ribbon, steel blue on Heat Lightning; holding a face flags it visibly during the hold | |
| 1c′ | Textured materials | Stratosphere shows the drifting sky on the mirror (light chrome, dark glass wells); Ion Storm shows the storm cloud trailing the rotation; Galaxy, Gilded Ribbon, Heat Lightning show their textures; Aurora its curtains — all offline, in airplane mode | |
| 1d | Mercury | Mirrored WebGL body under an etched crust, liquid-metal wells on dig, gilded flags; share card includes the mirror | |
| 2 | Sphere size | On a phone in portrait the sphere spans roughly 85% of the width | |
| 2a | Mercury clears | On Mercury, clear a face and keep playing: liquid-metal wells (the build-50 look), sphere keeps answering drag and tap (build 51 froze here; build 52 had the wrong cores) | |
| 2d | Tabbed sheet | ? opens on the last-used tab; Play · Themes · Board · Settings each ≥ 44 pt; one panel at a time; Done/× on every tab | |
| 2b | Best times | Win an XS sphere: banner reads *First clear at this size*; ? shows *Best …* under XS; a slower win keeps the old best | |
| 2c | Water Wheel | Hold the mine count at the top (water rises through it) **or** tap the wave button on the sheet's Board tab → the Water Wheel opens without an automatic tutorial, with its help available on demand and a Sphere pill top-left clear of the status bar; the wheel bobs on the water, dips when spun, hops on a quench, slams on a detonation, and taps land on the intended face; Sphere returns to the resumed run | |
| 3 | Settings sheet | ? opens wide enough to read (≥340 pt on a phone), no keyboard hints; Theme grid (nine, Themes tab), Board size (XS–XL, new sphere on change, Board tab), Invert, Effects (Settings tab) all apply live and read pressed; no Warnings group (themes own depth/seams/marks: Light/Dark depth+seams, mirror materials depth, no seams except Aurora); Done ≥ 44 pt; "Show the tutorial again" reopens the tutorial; closes with × / Done / outside tap and never blocks the board afterwards | |
| 6 | Sphere render | Sphere is centered and fully visible; no clipping at any edge | |
| 7 | Sphere dig | Single tap reveals the intended tile — not a neighbor | |
| 8 | Sphere flag | Long-press flags; flag stands proud of the shell | |
| 9 | Sphere chord | Double-tapping a satisfied number opens its neighbors; works in flag mode too | |
| 10 | Sphere camera | With Settings → Invert off, one-finger drag tumbles freely: the face under the finger follows down/right motion on both axes, including after crossing a pole; inversion choices reverse the selected axes; pinch zooms; no accidental digs while dragging | |
| 11 | Sphere flood | Clearing an empty region animates outward and settles correctly | |
| 12 | Sphere sizes | XS through XL all render; **note the smallest size you can still tap reliably** | |
| 13 | Sphere themes | All nine Themes-tab choices apply live; no theme shows a missing texture or unexplained flat gray | |
| 14 | Settings live preview | Themes and inversion/effects apply without replacing the current run; selecting a different Board size starts a new sphere; the selected controls stay synchronized when the sheet reopens | |
| 15 | Share card | Produces an image; content matches the current board | |
| 16 | Safe areas | Game chrome and tutorial/settings sheets clear the notch/Dynamic Island and home indicator in both orientations | |
| 17 | Autosave | Force-quit mid-run and relaunch: cells, flags, size, time and view restore in place without a launcher or resume prompt; visiting Water Wheel and returning also preserves the sphere run | |
| 18 | Backgrounding | Background 30s and return; no blank WebView, no reset | |
| 19 | Reduced Motion | With the OS setting or Effects reduced, ambient motion settles and endgame feedback stays clear without the full shaking/particle treatment | |
| 20 | Outbound links | Credits open in the system browser and return cleanly; the game is never replaced in-place | |
| 20a | Share | On game end, Share opens the iOS share sheet with the card **as an image** — Messages, Instagram, Bluesky, Photos appear (not a Files-only sheet); canceling returns cleanly; the banner reads Share · Undo · New sphere | |
| 21 | Rotation | Portrait ↔ landscape reflows without losing the run or hiding the quiet bar or the open sheet; **the sphere stays round in both, and returning to portrait looks exactly as it did before the trip** (build 59 stayed stretched); repeat with the sheet open and while a run is in progress | |
| 22 | Android Back | System Back closes the sheet when open, returns from the Water Wheel to the sphere, otherwise exits or follows documented platform behavior without losing the run | |
| 23 | Android system bars | Content clears status/navigation/gesture insets in both orientations | |

## iPad gates

The app ships `TARGETED_DEVICE_FAMILY = "1,2"`, so iPad is a supported device
and Apple reviews it as one. These gates were missing entirely until
2026-08-11; nothing below has ever been checked on a tablet.

| # | Check | Pass criteria | Result |
|---|---|---|---|
| 22 | iPad launch | Launch screen and sphere fill the display; no letterboxing or phone-sized layout stranded in a corner | |
| 23 | iPad sphere | Sphere scales to the larger canvas rather than staying phone-sized; still centered and unclipped | |
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
- [ ] Record the latest App Store Connect build and confirm the candidate's iOS build number exceeds it
- [ ] Record the latest Play build and confirm the candidate's Android `versionCode` exceeds it
