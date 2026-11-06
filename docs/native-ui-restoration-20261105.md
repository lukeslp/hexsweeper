# Native Help restoration — November 5, 2026

The local Android candidate is **1.0.9 (34)**, installed in place with the
established signing identity. Source-aware smoke, eight JVM tests, lint and the
signed release build passed. APK SHA-256:
`9b6c0ff9235412f5df6829f6627b8a14f77c9875b3d7a9e87d27e98d04e86d04`.
Certificate SHA-256:
`404fd13d59f95b59fb9342e20e5953b15603832dda8ca75181c959b41fb5d592`.
No public release was made.

## Observed failure and bounded correction

On the actual closed Flip, build 33 retained its flagged board after the physical
roundtrip, but the open Help sheet disappeared. Its owned ActivityThread log
reported `relaunchActivityIfWebViewAttached` / `has WebView, Relaunching` on the
SystemUI App Tray return. This was framework recreation, despite handled
configuration changes and a retained task/process. A task ID is not evidence
that the Activity, WebView or DOM survived.

The canonical payload now stores a small, versioned Help projection: open/closed,
tab, scroll and stable focus token. It reads before enabling writers, records
every existing dismissal path and tolerates blocked or malformed storage. Fresh
entry clears stale projections. Existing game autosave remains responsible for
the board; no engine or gameplay state is copied into UI metadata.

`MainActivity` registers a Capacitor WebView listener before bridge creation.
After the owned HTTPS localhost main page loads, it passes only the existence
of a saved Activity bundle to the synchronous page hook. Native generation and
in-flight guards reject old callbacks; the JavaScript hook is idempotent per
document. Later Sphere documents bootstrap fresh, including Wheel → Sphere.
No JavaScript interface, permission or remote resource was added.

`WWW_SOURCE.txt` pins maintenance source
`f7d75468d9e286f073559d652569a35bb3dd3cd9`, preserving the shipped `d0082f7`
tutorial/history baseline. The same protocol is integrated into canonical main
at `9e549c9baba309ea567f6062eea668ea3a981830`, preserving main's newer entry,
tabs, themes and controls. All payload edits came from the exporter.

## Evidence and limits

The real-export browser suite passed at 379×336, 399×353 and 598×530, including
repeated restoration, focus/scroll, dismissal, cold entry, tutorial priority and
corrupt/blocked storage. Astra found no blocking source/native defect.

On the installed build 34, while physically CLOSED0:

- Killing only the background test app after Android saved its Activity state,
  then resuming it from the actual App Tray, restored Help's Keys tab and its
  scrolled position. The process changed from 7254 to 9744.
- Escape dismissed Help; another saved-state restart 9744 → 11323 kept it closed
  and retained the flagged board, counter 169 and timer zero.
- A real Wheel → Sphere navigation, followed by Help setup and another saved
  restart 11323 → 13618, restored the Keys tab and scroll again. This checks that
  writers are enabled for a later main document, not only the first load.

These are native saved-instance/process-restart checks, **not physical folds**.
An earlier `--display 0`/`--display 1` request while the phone stayed closed did
not log a framework relaunch and is not counted as recreation proof. New-build
physical unfold/refold acceptance remains pending.

The existing tutorial wins over stale Help metadata; tutorial replay is not
serialized. A nested history lightbox restores its parent Help, not the image.
DOM focus is distinct from TalkBack focus; TalkBack remains skipped/off at the
owner's request. This single app-storage projection is not independent
multiwindow state. No new Water Wheel state or accessibility model was added.

Canonical main's extra sealed-app suite records an unchanged Wheel favicon
packaging failure in its own integration note. That Wheel export differs from
this deliberately retained maintenance payload; it is not a passing full-suite
claim or a change to the installed candidate.

Rollback removes the native callback and restores the previous source pin through
the normal export workflow, retaining game data and signing identity. Do not
uninstall the game or reset user data to roll back a layout/session change.

## Automated emulator follow-up

The [guarded native restoration suite](native-restoration-emulator-20261105.md)
now exercises real Activity recreation, native Escape without a prior touch,
closed-state persistence and later-document writers using only synthetic emulator
data. It does not close the physical fold or signed-release acceptance gates.

## Later quiet physical return

The installed build34 bytes were re-read and still match the SHA above. On the
actual OPENED3 inner screen after the physical opening, existing Help remained
on its Keys tab. The earlier closed-cover LocalLauncher search/Enter launch
also showed Help. The final refold/no-touch-Escape pair was not independently
completed in this run. Luke subsequently confirmed the apps were working fine;
that is owner confirmation rather than an invented measured fold result.

The [qualified return and artifact-bound media](https://github.com/ambient-time/clocks-app/blob/codex/flip-apps-20261104/docs/reviews/flip-quiet-return-20261105.md)
record the observed path. TalkBack remains off. The current board has advanced
since the old timer-zero flag fixture, so preserve it and do not perform the old
synthetic-flag cleanup automatically. No runtime, payload pin, signing identity,
permission, saved board or public release changed in this documentation update.
