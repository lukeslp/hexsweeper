#!/usr/bin/env bash
# Reproducible Android build wrapper. Capacitor 8 / Gradle 8 are built with a
# supported LTS JDK even when a newer system Java is selected on macOS.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK="${1:-assembleDebug}"

GRADLE_ARGS=()
case "$TASK" in
    # assembleRelease without the signing variables gives the unsigned APK
    # F-Droid would build; see docs/FDROID.md.
    assembleDebug|assembleRelease|bundleRelease) ;;
    bundlePlayRelease)
        # Google Play bundle: the application id comes from
        # hexsweeperPlayApplicationId in android/gradle.properties.
        TASK=bundleRelease
        GRADLE_ARGS=(-Pplay)
        ;;
    *)
        printf 'android-build: unsupported task %s\n' "$TASK" >&2
        exit 2
        ;;
esac

if [ "$(uname -s)" = "Darwin" ] && [ -x /usr/libexec/java_home ]; then
    JAVA_21_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [ -n "$JAVA_21_HOME" ]; then
        export JAVA_HOME="$JAVA_21_HOME"
        export PATH="$JAVA_HOME/bin:$PATH"
    fi
fi

cd "$REPO_ROOT"
pnpm exec cap sync android
exec ./android/gradlew --project-dir android ${GRADLE_ARGS[@]+"${GRADLE_ARGS[@]}"} "$TASK"
