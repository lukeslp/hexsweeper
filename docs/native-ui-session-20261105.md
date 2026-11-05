# Native Help continuity — November 5, 2026

This bounded maintenance candidate starts from `ca710f7`, the shipped game's
`d0082f7` baseline plus the visible Help/tutorial dialog-focus fix. It does not
import newer main's entry/menu changes or change the game engine. Native
integration and physical-device acceptance are separate work in the app shell.

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

The page defines the function synchronously after its existing Help/tab/history
handlers are installed. Native must limit the call to the owned app page;
this is not a new general-purpose JavaScript/native bridge. Call once per
Activity/page. Duplicate calls on one document do nothing.

Only the native app flag plus this explicit bootstrap enables UI snapshots.
`false` clears the prior UI record before tracking the new session. `true`
reads the prior record before any new-document writer can replace it. The
versioned `hexsweeper-sphere-native-ui-v1` localStorage record contains only
`version`, Help `open`, `tab`, panel `scroll`, and a stable DOM `focus` token.
No DOM markup, user input or game state is serialized. Malformed, incompatible
or blocked storage is ignored without interrupting the existing UI.

Restoration opens Help through its existing button, selects its tab through
`HEXSWEEPER_SHOW_SHEET_TAB`, and restores valid visible controls and clamped
scroll position. Existing modal isolation and Close/Done/Escape cleanup remain
in force. An outside Help tap retains its existing non-dismissal behavior.

## Limits and verification

- This restores the parent Help sheet, not a nested history image lightbox.
- Native first-launch tutorial behavior takes precedence over a stale Help
  record. Tutorial replay is not serialized; its existing seen marker and
  normal native entry policy remain responsible for onboarding.
- Focus means DOM focus, not TalkBack focus. No speech or screen-reader
  acceptance is claimed. No Water Wheel UI or game persistence is added.
- Fresh native cold starts deliberately do not resurrect Help; ordinary web
  visits never activate this protocol. Existing last-tab preferences remain.

Export only the ignored test payload and use an existing Playwright install:

```sh
python3 tools/export-collection.py --app
HEX_PLAYWRIGHT_MODULE=/path/to/playwright node tools/test-native-ui-session.mjs
HEX_PLAYWRIGHT_MODULE=/path/to/playwright node tools/test-sphere-dialog-focus.mjs
node sphere/test-variant-contract.js
```

The reload fixture uses the real export at 379×336, 399×353 and 598×530. It
checks open/closed state, tab/scroll/focus, repeated recreation and duplicate
callbacks, Close/Done/Escape, unchanged outside behavior, nested-history
fallback, tutorial priority/replay, fresh-cold reset, non-native gating and
corrupt/blocked storage. These are quiet browser checks, not physical fold
evidence. Native callback wiring, signed build and actual unfold/refold remain
the app-shell owner's checks before delivery.
