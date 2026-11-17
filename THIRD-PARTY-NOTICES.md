# Third-party notices

This repository's own code and artwork are MIT licensed; see
[LICENSE](LICENSE). The items below are bundled under their own terms.

## IBM Plex Sans and IBM Plex Mono

`fonts/IBMPlexSans-400.woff2`, `fonts/IBMPlexSans-600.woff2`,
`fonts/IBMPlexSans-700.woff2`, `fonts/IBMPlexMono-500.woff2` and
`fonts/IBMPlexMono-600.woff2`. The exporter also embeds them as inline data in
some generated pages (`infinite.html`, and the sealed native payload it stages
under `build/app/`).

Copyright © 2017 IBM Corp. with Reserved Font Name "Plex". Licensed under the
SIL Open Font License, Version 1.1. Full text: [fonts/OFL.txt](fonts/OFL.txt).
Source: <https://github.com/IBM/plex>.

## Earth and Moon daymaps

`sphere/assets/textures/earth_daymap_2k.jpg` and
`sphere/assets/textures/moon_2k.jpg`, and their byte-identical copies
`sphere-ux/assets/textures/earth_daymap_2k.jpg` and
`sphere-ux/assets/textures/moon_2k.jpg`, are credited to Solar System Scope / INOVE
(<https://www.solarsystemscope.com/textures/>) under CC BY 4.0
(<https://creativecommons.org/licenses/by/4.0/>). The source chain, checksums
and modification history are in
[sphere/assets/textures/README.md](sphere/assets/textures/README.md) and
[sphere/assets/textures/sources.json](sphere/assets/textures/sources.json).

## Reflection photographs

The WebP files in `sphere/assets/reflections/` (two sizes each of seven
images) are the environment maps for the sphere's reflection materials. Some
generated pages embed them as inline data.

Six are photographs from Unsplash, used under the
[Unsplash License](https://unsplash.com/license) and not covered by the MIT
license: `amber-tempest` (Johannes Plenio), `chromatic-ink` (Daniel Olah),
`galaxy` (Jose G. Ortega Castro), `heat-lightning` (Max LaRochelle),
`ion-storm` (Felix Mittermeier) and `oculus` (Adam Gonzales).

The apps' direct, Google Play and iOS builds embed three of them: Galaxy
([A night sky filled with lots of stars](https://unsplash.com/photos/W6EsQWhEc94),
Jose G. Ortega Castro), Heat Lightning
([Lightning strike at night](https://unsplash.com/photos/uu-Jw5SunYI), Max
LaRochelle) and Ion Storm
([Clouds with thunder digital wallpaper](https://unsplash.com/photos/L4-16dmZ-1c),
Felix Mittermeier). The app's Licenses page and
[app/THIRD-PARTY-NOTICES.md](app/THIRD-PARTY-NOTICES.md) carry the same
credits. The F-Droid build embeds none.

No source is confirmed for `stratosphere`, so it is not credited here and the
MIT license does not cover it. No app build carries it. Source links and the search record are in
[sphere/assets/reflections/SOURCES.md](sphere/assets/reflections/SOURCES.md).

## Classic Minesweeper screenshot

`sphere/assets/classic-minesweeper.png` (also under `sphere-ux/assets/`) is a screenshot of Microsoft's Minesweeper on a Windows XP desktop, shown
as a history note in the help sheet. It is not this project's artwork, its
source is not recorded, and the MIT license here does not cover it. Microsoft,
Windows and Minesweeper are trademarks of Microsoft Corporation. It appears on
the web pages only: no app build carries it (the direct, Google Play and iOS
payload dropped it on November 17, 2026; the F-Droid payload never had it).
