# Quiet cover follow-up — November 4, 2026

Android 1.0.8 (33) updates the existing Flip installation in place. The saved
timer-zero test board and its one flagged cell remained after the update. The
native safe-window wrapper is unchanged from the earlier
[cover measurement validation](flip-cover-20261104.md).

The new generated payload fixes Help/tutorial/nested-history dialog focus:
background controls become inert, Tab remains inside, Escape dismisses through
the existing handler, and closing returns focus to the visible Help action.
No gameplay, tutorial, save schema, permissions or app identity was removed.

## Source provenance

`WWW_SOURCE.txt` pins `ca710f79cce96848327a4b8a4a3bec398d586d45` from
`lukeslp/hexsweeper-private-history`, maintained on
`codex/hexsweeper-talkback-20261104`. This deliberately applies the bounded focus
fix to the previously shipped `d0082f7` payload baseline; it preserves that
baseline's native first-launch tutorial and history UI. The exported game is
generated from canonical source, never patched inside `www/`.

The same correction was integrated into current source `main` at
`24d1ef7c348fe1c841f1d7eecf8506bb8994bdf3`, preserving main's newer immediate-board
entry, tabs, themes and controls. Those independent upstream changes were not
silently mixed into this device-validation update. CI checks the exact recorded
payload source commit rather than moving source `main`.

The candidate APK SHA-256 is
`71969853f459a6bcbe373f822d1f866a7073ce636a54c7b878ce59032339807a`.
Its verified existing certificate is
`404fd13d59f95b59fb9342e20e5953b15603832dda8ca75181c959b41fb5d592`.
The source-aware smoke check, eight JVM tests, lint and signed release build
passed. The source's dialog regression checks passed at 379 × 336, 399 × 353
and 598 × 530 CSS pixels; these are browser checks, separate from device proof.

## Quiet physical checks

On the closed SM-F776U1 cover, Help opened by touch. Escape closed it and left
the visible Help button focused; Space reopened it. The flagged cell, counter
169 and timer zero remained. Screenshots are retained in the coordinating
Ambient Time review; the local captures are
`/tmp/hex-quiet-visible-help-return.png` and
`/tmp/hex-quiet-help-before-fold.png`.

TalkBack was canceled at the owner's request and remains off. The temporary
observer test was removed; keyboard/focus results do not establish screen-reader
acceptance. Physical unfold/refold with the flagged board and open Help sheet
is prepared but not yet verified in this follow-up. No public APK, store release
or F-Droid publication was made.

Rollback restores the prior recorded payload/source pin and native version
through the normal source workflow, retaining saves and signing identity.
Never uninstall the app or replace its key to resolve an update mismatch.
