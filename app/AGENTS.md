# Hexsweeper (native) — agent notes

Capacitor shell around hexsweeper's sphere game on iOS and Android. The app opens
straight into the sphere; a quiet bar (Undo · New sphere · Flag · ?) is the
only fixed chrome and the ? sheet holds theme, size, best times, invert,
effects and the tutorial. `www/wheel.html` is the hidden Water Wheel, reached
by holding the mine count. `www/notices.html` is the licenses page behind the
sheet's Licenses link; keep it in step with `THIRD-PARTY-NOTICES.md`. Infinite and Classic are web-only. Read `README.md` first; it
explains why the bundle id says `hexodus` and why the build number starts at 7.

## Entry policy

The native payload opens straight to the board, like the web. Its short
tutorial is behind ? ("Show the tutorial"); dismissing it records the seen
marker, and saved runs restore in place. The web game opens the board
without an automatic instructions modal, including when storage is blocked.
Both use the same ? sheet: Play, Themes, Board, Settings, and a Keys tab for
keyboard users. Keep this distinction in canonical source and its exporter;
do not implement it by patching `www/`.

## The one rule

**`www/` is generated. Never edit it by hand.** It is generated from
the game source at the repository root via `python3 tools/export-collection.py --app`. Editing it
here desynchronizes the app from the game with no way to tell which is right,
and `scripts/smoke.sh` will fail on the checksums in `WWW_SOURCE.txt`.

Sphere behavior, themes, chrome, and gameplay bugs are fixed **in the game
source at the repository root**, then re-vendored. Nothing about the game is
authored in this folder.

## What this folder owns

Native shell only: Xcode/Gradle projects, signing metadata, platform manifests,
launch screens, icon and splash assets, Capacitor config, and release process. If a change is not
about one of those, it probably belongs in the game source.

## Re-vendoring

```bash
# from the repository root
python3 tools/export-collection.py --app
cp -R build/app/. app/www/
# then refresh app/WWW_SOURCE.txt (source commit + per-file sha256) and, from app/,
# check against a checkout of that recorded commit
scripts/smoke.sh --with-source /path/to/a/checkout/of/the/recorded/commit
```

Check the source checkout's branch before exporting; an older feature branch
can reintroduce behavior that canonical main has already replaced. Normally use
reviewed current main. A deliberately scoped maintenance snapshot must document
its preserved baseline and divergence, as in the November 4 quiet-focus follow-up.
CI runs `--with-source` against the exact pushed source commit recorded in
`WWW_SOURCE.txt`, not moving source main. A missing source commit or payload that
differs from that commit fails the build.

## Application id on Google Play

Builds made with `-Pplay` (`pnpm android:bundle:play`) take their application
id from `hexsweeperPlayApplicationId` in `android/gradle.properties`. Every
other build is `app.hexodus.ios`. Do not change either id without the owner:
the direct id keeps existing installs updating, and the Play id is permanent
after the first upload. Keep anything keyed to the id reading it from the
build (`${applicationId}`, `getPackageName()`), never a literal.

## Build numbers

App Store Connect already holds builds 1–6 under this bundle id from the retired
app and has received builds through 70. 1.0 (63) was submitted 2026-08-20 and
approved 2026-09-01; 1.0.1 went through builds 64–69 on 2026-09-01/02 (same
payload, icon iterations) and build 69 is attached. 1.0.2 (70) was uploaded
2026-11-14 and submitted for review; the checked-in project is 1.0.2 (71), its
replacement with the November 16 payload. Set `CURRENT_PROJECT_VERSION` above the
latest uploaded build for every iOS upload. Android starts at `versionCode 1`
and increments independently for every Play upload.

## Deliberately absent

No bundler, no TypeScript or JavaScript unit-test toolchain, no `@capacitor/app`,
no `CapacitorHttp`. Native Android JVM and instrumentation suites do exist:
`android/app/src/test/` and `android/app/src/androidTest/`. Use the documented
Gradle checks and the [native restoration record](docs/native-ui-restoration-20261105.md);
do not introduce a web toolchain merely to duplicate the canonical-source tests.
The payload makes zero network calls and the export asserts that (it fails if any
`src`/`href` points off-device). Do not add a toolchain to a repo whose entire
web surface is one prebuilt file. `capacitor.config` stays `.js` — a `.ts` config
would pull in `typescript` solely to be parsed.

The Foundation Models bridge, the React client, and the `iris` antagonist that
used to live here are gone. Do not reintroduce them; they belong to a different,
abandoned product that merely shared this bundle id.

## Safety

No secrets in this tree. iOS signing is automatic under the owner's Apple
developer team, set as `DEVELOPMENT_TEAM` in the Xcode project. Android release
signing reads the `HEXSWEEPER_ANDROID_*` environment variables; keystores and
passwords stay outside the repository. Uploads to App Store Connect, Google
Play or Amazon are the owner's to trigger, never automated from here.
