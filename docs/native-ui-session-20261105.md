# Native Help continuity — November 5, 2026

The reviewed maintenance implementation is `f7d7546`, built on `ca710f7` and
the shipped game's `d0082f7` baseline. This source integration merges only that
bounded restoration change onto current main `24d1ef7`. It retains main's
immediate board entry, quiet first-visit cue, themes, tabs and control frames;
it does not restore the maintenance-only tutorial/history UI or change the
game engine. The native release remains pinned to the separate maintenance
revision; this integration is not a new native build or physical-device claim.

Samsung's observed fold return forcibly recreated the WebView through
`ActivityThread.relaunchActivityIfWebViewAttached`. Responsive resize support
therefore did not retain the JavaScript DOM. Browser reload reproduced the
lost Help sheet against the unmodified real `--app` export before this change.

## Native callback contract

After registering its listener before native creation and loading the owned
top-level app page, the shell invokes:

```js
window.__restoreNativeUiSession &&
  window.__restoreNativeUiSession(savedActivityBundleExists);
```

The page defines the function synchronously after its existing Help/tab
handlers are installed. Native must limit the call to the owned app page;
this is not a new general-purpose JavaScript/native bridge. Call once per
Activity/page. Duplicate calls on one document do nothing.

Only the native app flag plus this explicit bootstrap enables UI snapshots.
`false` clears the prior UI record before tracking the new session. `true`
reads the prior record before any new-document writer can replace it. The
versioned `hexsweeper-sphere-native-ui-v1` localStorage record contains only
`version`, Help `open`, `tab`, inner-container `scroll`, and a stable DOM `focus` token.
No DOM markup, user input or game state is serialized. Malformed, incompatible
or blocked storage is ignored without interrupting the existing UI.

Restoration opens Help through its existing button, selects its tab through
`HEXSWEEPER_SHOW_SHEET_TAB`, and restores valid visible controls and clamped
scroll position. Main's existing `#help-tabstack` is the scroll container,
with `#help-panel` retained as a fallback for the maintenance layout. Existing
modal isolation and Close/Done/Escape cleanup remain
in force. An outside Help tap retains its existing non-dismissal behavior.

## Limits and verification

- This restores Help only. Current main has no tutorial or history image
  lightbox; the maintenance implementation restores the parent Help rather
  than its nested history modal. No removed UI is reintroduced here.
- Focus means DOM focus, not TalkBack focus. No speech or screen-reader
  acceptance is claimed. No Water Wheel UI or game persistence is added.
- Fresh native cold starts deliberately do not resurrect Help; ordinary web
  visits never activate this protocol. Existing last-tab preferences remain.

Regenerate tracked exports and the ignored app test payload, then use an
existing Playwright install:

```sh
python3 tools/export-collection.py
python3 tools/export-collection.py --check
python3 tools/export-collection.py --app
HEX_PLAYWRIGHT_MODULE=/path/to/playwright node tools/test-native-ui-session.mjs
HEX_PLAYWRIGHT_MODULE=/path/to/playwright node tools/test-sphere-dialog-focus.mjs
node sphere/test-variant-contract.js
node sphere/test-neighbors.js
```

The reload fixture uses the real export at 379×336, 399×353 and 598×530. It
checks open/closed state, tab/inner-scroll/focus, repeated recreation and
duplicate callbacks, Close/Done/Escape, unchanged outside behavior, preserved
main entry, fresh-cold reset, non-native gating and corrupt/blocked storage.
Nonzero inner scrolling must be exercised by at least one real cover fixture.
The current dialog-focus suite separately checks nested isolation with its
test-only fixture, without adding UI. These are quiet browser checks, not physical fold
evidence. Native callback wiring, signed build and actual unfold/refold remain
the app-shell owner's checks before delivery.

Integration checks passed: the reload suite and current authored/generated-root
dialog-focus suites at all three cover sizes; Sphere variant/help lifecycle,
neighbor/flood, Flux and Glitch state/route lifecycle contracts; launcher,
collection/choices export drift, syntax and whitespace checks. Removing the
appended protocol reproduces main's authored Sphere page and all five changed
tracked generated pages byte-for-byte. Engine, quiet chrome, controls, CSS and
exporter sources remain unchanged.

The extra sealed-app browser suite reached the Wheel check and failed on its
three existing root-relative favicon URLs under `/games/hexsweeper/favicon/`.
They resolve to the local server rather than bundled files. The Wheel export
is byte-identical when HEAD's Sphere source is substituted in memory
(SHA-256 `e179240bb502b801bc9701d3bd75046f92e6f3a6a2706f113922ad27c00ecbcd`).
This baseline packaging issue is recorded, not silently repaired as part of
Help restoration; the complete sealed-app suite is not claimed as passing.
