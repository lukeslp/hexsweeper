# Device verification

Run on real hardware before any TestFlight or App Store build. The simulator
does not reproduce touch precision, thermal behaviour, or true safe-area geometry.

Record one row per device. Attach to the build notes.

| Field | Value |
|---|---|
| Device / iOS | |
| Build number | |
| Tester / date | |

## Gates

Everything below must pass **in airplane mode** — the payload is fully offline
and any network dependency is a defect.

| # | Check | Pass criteria | Result |
|---|---|---|---|
| 1 | Cold launch | Launch screen hands off to the sphere with no blank frame between | |
| 2 | First render | Sphere is centred and fully visible; no clipping at any edge | |
| 3 | Dig | Single tap reveals the intended tile — not a neighbour | |
| 4 | Flag | Long-press flags; flag stands proud of the shell | |
| 5 | Chord | Tapping a satisfied number opens its neighbours | |
| 6 | Camera | One-finger drag tumbles freely; pinch zooms; no accidental digs while dragging | |
| 7 | Flood | Clearing an empty region animates outward and settles correctly | |
| 8 | Board sizes | XS through XL all render; **note the smallest size you can still tap reliably** | |
| 9 | Themes | All seven cycle; no theme shows a missing texture or flat grey | |
| 10 | Customize panel | Opens, changes apply live, undo reverts one step | |
| 11 | Share card | Produces an image; content matches the current board | |
| 12 | Safe areas | Chrome pills clear the notch/Dynamic Island and home indicator in both orientations | |
| 13 | Autosave | Force-quit mid-run, relaunch, run resumes | |
| 14 | Backgrounding | Background 30s and return; no blank WebView, no reset | |
| 15 | Reduced Motion | With the OS setting on, endgame effects become instant states | |
| 16 | Outbound links | Credits open in Safari and return cleanly; game is never replaced in-place | |
| 17 | Rotation | Portrait ↔ landscape reflows without losing the run | |

## Known open question

Gate 8 is the one most likely to fail. `pickTile` uses exact polygon hit-testing
with no touch padding, and XL is 2252 faces. If small boards are comfortable but
XL is not, the fix is a per-device board cap in hexsweeper, not here.

## Sign-off

- [ ] All gates pass, or failures are recorded with issue links
- [ ] Build number exceeds every build already in App Store Connect (currently ≥7)
