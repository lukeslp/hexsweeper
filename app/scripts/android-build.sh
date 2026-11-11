#!/usr/bin/env bash
# Reproducible Android build wrapper. Capacitor 8 / Gradle 8 are built with a
# supported LTS JDK even when a newer system Java is selected on macOS.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK="${1:-assembleDebug}"

case "$TASK" in
    assembleDebug|bundleRelease) ;;
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
exec ./android/gradlew --project-dir android "$TASK"
