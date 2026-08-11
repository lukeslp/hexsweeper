# Hexsweeper (native) — agent notes

Capacitor shell around three of hexsweeper's games — infinite, bounded, sphere —
behind a picker on iOS and Android. Read `README.md` first; it
explains why the bundle id says `hexodus` and why the build number starts at 7.

## The one rule

**`www/` is generated. Never edit it by hand.** It is vendored from
`lukeslp/hexsweeper` via `python3 tools/export-collection.py --app`. Editing it
here desynchronises the app from the game with no way to tell which is right,
and `scripts/smoke.sh` will fail on the checksums in `WWW_SOURCE.txt`.

Sphere behaviour, themes, chrome, and gameplay bugs are fixed **in hexsweeper**,
then re-vendored. Nothing about the game is authored in this repo.

## What this repo owns

Native shell only: Xcode/Gradle projects, signing metadata, platform manifests,
launch screens, icon and splash assets, Capacitor config, and release process. If a change is not
about one of those, it probably belongs in hexsweeper.

## Re-vendoring

```bash
# in a hexsweeper checkout
python3 tools/export-collection.py --app
cp -R build/app/. ../hexsweeper-app/www/
# then in this repo, refresh WWW_SOURCE.txt (source commit + per-file sha256)
scripts/smoke.sh --with-source ../hexsweeper
```

CI runs that same `--with-source` gate against hexsweeper's `main`, so a
re-vendor that lands here without the matching hexsweeper commit pushed — or a
hexsweeper change that never gets re-vendored — fails the build.

## Build numbers

App Store Connect already holds builds 1–6 under this bundle id from the retired
app and has received builds through 29. Set `CURRENT_PROJECT_VERSION` above the
latest uploaded build for every iOS upload. Android starts at `versionCode 1`
and increments independently for every Play upload.

## Deliberately absent

No bundler, no TypeScript, no unit tests, no `@capacitor/app`, no `CapacitorHttp`.
The payload makes zero network calls and the export asserts that (it fails if any
`src`/`href` points off-device). Do not add a toolchain to a repo whose entire
web surface is one prebuilt file. `capacitor.config` stays `.js` — a `.ts` config
would pull in `typescript` solely to be parsed.

The Foundation Models bridge, the React client, and the `iris` antagonist that
used to live here are gone. Do not reintroduce them; they belong to a different,
abandoned product that merely shared this bundle id.

## Safety

No secrets in this tree. Signing is automatic under team `596T7J7FB6`.
Uploads to App Store Connect or Google Play are Luke's to trigger, never automated from here.
