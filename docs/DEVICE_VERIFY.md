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
| 1 | Cold launch | Launch screen hands off to the covered picker board with no blank frame between | |
| 2 | Picker reveal | The safe opening auto-digs smoothly; Infinite, Classic, and Sphere become unmistakable choices | |
| 3 | Picker routes | Each choice opens the right game; **‹ Games** returns to the already-open picker | |
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
| 16 | Safe areas | Picker and game chrome clear the notch/Dynamic Island and home indicator in both orientations | |
| 17 | Autosave | Force-quit mid-run, relaunch, and resumable runs return intact | |
| 18 | Backgrounding | Background 30s and return; no blank WebView, no reset | |
| 19 | Reduced Motion | Picker reveal and endgame effects become instant states | |
| 20 | Outbound links | Credits open in the system browser and return cleanly; the game is never replaced in-place | |
| 21 | Rotation | Portrait ↔ landscape reflows without losing the run or obscuring picker choices | |
| 22 | Android Back | From a game, **‹ Games** returns to the picker; system Back exits or follows documented platform behaviour without losing state | |
| 23 | Android system bars | Content clears status/navigation/gesture insets in both orientations | |

## Known open question

Gate 12 is the one most likely to fail. `pickTile` uses exact polygon hit-testing
with no touch padding, and XL is 2252 faces. If small boards are comfortable but
XL is not, the fix is a per-device board cap in hexsweeper, not here.

## Sign-off

- [ ] All gates pass, or failures are recorded with issue links
- [ ] iOS build number exceeds the latest App Store Connect build (currently 33)
- [ ] Android `versionCode` exceeds the latest Play build (currently no Play listing; project starts at 1)
