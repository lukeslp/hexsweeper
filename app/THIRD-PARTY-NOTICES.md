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

The sealed game payload (`www/index.html`) embeds three reflection images as
inline WebP data, taken from `sphere/assets/reflections/` in the game source.
All three are photographs from Unsplash, used under the
[Unsplash License](https://unsplash.com/license) and not covered by the MIT
license, resized and converted to WebP:

- Galaxy, `galaxy-768.webp`: [A night sky filled with lots of stars](https://unsplash.com/photos/W6EsQWhEc94), by Jose G. Ortega Castro.
- Heat Lightning, `heat-lightning-768.webp`: [Lightning strike at night](https://unsplash.com/photos/uu-Jw5SunYI), by Max LaRochelle.
- Ion Storm, `ion-storm-768.webp`: [Clouds with thunder digital wallpaper](https://unsplash.com/photos/L4-16dmZ-1c), by Felix Mittermeier.

The app's Licenses page (`www/notices.html`) gives the same three credits.

Gilded Ribbon and Stratosphere, whose images had no confirmed source, left
the payload in 1.0.10. Source links and the search record are in
[the reflection source notes](../sphere/assets/reflections/SOURCES.md).

The F-Droid build (`www-fdroid/`) leaves these three themes out and embeds no
photograph.

## Classic Minesweeper screenshot

No app payload includes the screenshot of Microsoft's Minesweeper that the
web game shows as a history note in its help sheet. `www/` dropped it on
November 17, 2026 (Android 1.0.14 (39), iOS 1.0.3 (71)); `www-fdroid/` never
had it.

## Notices inside the app

`www/notices.html` is the licenses page the app shows from the **Licenses**
link at the foot of the sheet. The exporter writes it from
`tools/app-notices.html` and the license texts beside it, on the payload's
source commit. Keep it in step with this file when a bundled item changes.
