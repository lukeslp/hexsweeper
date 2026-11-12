# Third-party notices

This repository's own code is MIT licensed; see [LICENSE](LICENSE). The items
below are bundled in the tree or pulled in at build time under their own terms.

## IBM Plex Sans and IBM Plex Mono

The sealed game payload (`www/index.html`, `www/wheel.html`) embeds IBM Plex
Sans (400, 600, 700) and IBM Plex Mono (500, 600) as inline WOFF2 data.

Copyright © 2017 IBM Corp. with Reserved Font Name "Plex". Licensed under the
SIL Open Font License, Version 1.1. Full text:
[licenses/IBM-Plex-OFL.txt](licenses/IBM-Plex-OFL.txt). Source:
<https://github.com/IBM/plex>.

## Capacitor

The native shells depend on Capacitor (`@capacitor/core`, `@capacitor/ios`,
`@capacitor/android`, `@capacitor/splash-screen`, `@capacitor/cli`), MIT
licensed. These packages are installed by pnpm, Swift Package Manager and
Gradle at build time and are not checked in. Source:
<https://github.com/ionic-team/capacitor>.

## Android libraries

The Android build links AndroidX libraries (AppCompat, Activity, Core, Core
SplashScreen, CoordinatorLayout, Fragment, WebKit and what they depend on,
copyright The Android Open Source Project), the Apache Cordova Android
framework that Capacitor includes (copyright The Apache Software Foundation)
and the Kotlin standard library (copyright JetBrains s.r.o. and Kotlin
Programming Language contributors). All are under the Apache License,
Version 2.0. Gradle fetches them at build time; none is checked in.

## Reflection photographs

The sealed game payload (`www/index.html`) embeds four reflection images as
inline WebP data, taken from `sphere/assets/reflections/` in the game source.

Three are photographs from Unsplash, used under the
[Unsplash License](https://unsplash.com/license) and not covered by the MIT
license: `galaxy-768.webp` (Jose G. Ortega Castro), `heat-lightning-768.webp`
(Max LaRochelle) and `ion-storm-768.webp` (Felix Mittermeier).

No source is confirmed for `stratosphere-1024.webp`, so it is not credited
here and the MIT license does not cover it. Gilded Ribbon, which also had no
source, left the payload in 1.0.10. Source links and the search record are in
[the reflection source notes](../sphere/assets/reflections/SOURCES.md).

## Help image

`www/assets/classic-board.png` is a screenshot of this project's own Classic
board and is covered by the MIT license. The Windows Minesweeper screenshot
that 1.0.6 carried is not in the app payload from 1.0.10 on. The web game still
shows that screenshot; see the notices at the repository root.

## Notices inside the app

`www/notices.html` is the licenses page the app shows from the **Licenses**
link at the foot of the sheet. The exporter writes it from
`tools/app-notices.html` and the license texts beside it, on the payload's
source commit. Keep it in step with this file when a bundled item changes.
