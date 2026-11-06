#!/usr/bin/env python3
"""Run the native restoration checks only on an explicitly named disposable emulator.

Installs local debug app/test APKs and clears ONLY their synthetic target data.
Never use this against a physical device or an emulator holding personal data.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = "app.hexodus.ios"
RUNNER = "androidx.test.runner.AndroidJUnitRunner"
ANDROID = "{http://schemas.android.com/apk/res/android}"


def command(args, timeout=60):
    return subprocess.check_output(args, stderr=subprocess.STDOUT, timeout=timeout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r"emulator-[0-9]+", args.serial):
        parser.error("Physical devices refused; specify emulator-NNNN explicitly")
    if args.output.exists():
        parser.error("Use a new evidence directory")
    sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
    adb = [str(sdk / "platform-tools/adb"), "-s", args.serial]
    avd = command(adb + ["emu", "avd", "name"]).decode().splitlines()[0]
    if not re.fullmatch(r"NativeUi_Restore_[0-9]{8}", avd):
        parser.error("Only a fresh dedicated NativeUi_Restore_YYYYMMDD AVD is allowed")
    if command(adb + ["shell", "getprop", "ro.kernel.qemu"]).strip() != b"1":
        parser.error("QEMU hardware required")
    if command(adb + ["shell", "settings", "get", "secure", "accessibility_enabled"]).strip() not in (b"0", b"null"):
        parser.error("Accessibility services must remain off; no setting will be changed")
    if command(adb + ["shell", "settings", "get", "secure", "immersive_mode_confirmations"]).strip() != b"confirmed":
        parser.error("Acknowledge the dedicated emulator full-screen onboarding before running; it otherwise takes keyboard focus")
    apk = ROOT / "android/app/build/outputs/apk/debug/app-debug.apk"
    test = ROOT / "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
    analyzer = [str(sdk / "cmdline-tools/latest/bin/apkanalyzer"), "manifest", "print"]
    target = ET.fromstring(command(analyzer + [str(apk)]))
    tests = ET.fromstring(command(analyzer + [str(test)]))
    app = target.find("application")
    if target.get("package") != PACKAGE or app is None or app.get(ANDROID + "debuggable") != "true":
        raise ValueError("Expected this project's local debug target")
    for permission in target.findall("uses-permission"):
        if permission.get(ANDROID + "name") != PACKAGE + ".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION":
            raise ValueError("Offline fixture must not request runtime/network permissions")
    instrumentation = tests.find("instrumentation")
    if instrumentation is None or instrumentation.get(ANDROID + "targetPackage") != PACKAGE or instrumentation.get(ANDROID + "name") != RUNNER:
        raise ValueError("Wrong instrumentation target or runner")
    test_package = tests.get("package")
    args.output.mkdir(parents=True)
    for binary in (apk, test):
        command(adb + ["install", "-r", "-t", str(binary)])
    if command(adb + ["shell", "pm", "clear", PACKAGE]).strip() != b"Success":
        raise ValueError("Could not reset synthetic fixture data")
    run = ["shell", "am", "instrument", "-w", "-r", "-e", "nativeUiFixture", "yes", "-e", "fixtureSerial", args.serial]
    if RUNNER == "androidx.test.runner.AndroidJUnitRunner":
        run += ["-e", "class", "app.hexodus.ios.NativeUiRestorationTest"]
    raw = command(adb + run + [test_package + "/" + RUNNER], timeout=180).decode()
    (args.output / "instrumentation.txt").write_text(raw)
    match = re.search(r"(?:INSTRUMENTATION_RESULT|INSTRUMENTATION_STATUS): nativeUiReceipt=(.+)", raw)
    if not match or "INSTRUMENTATION_CODE: -1" not in raw or "FAILURES!!!" in raw:
        raise AssertionError("Native restoration check failed; see retained instrumentation.txt")
    receipt = {"native": json.loads(match.group(1)), "avd": avd, "serial": args.serial,
               "appPackage": PACKAGE, "versionCode": target.get(ANDROID + "versionCode"),
               "versionName": target.get(ANDROID + "versionName"),
               "appApkSha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
               "testApkSha256": hashlib.sha256(test.read_bytes()).hexdigest(),
               "sourceBaseHead": command(["git", "-C", str(ROOT), "rev-parse", "HEAD"]).decode().strip(),
               "testSourceSha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT / "android/app/src/androidTest").rglob("*.java"))},
               "driverSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               "appData": "Only synthetic target package reset on a dedicated emulator",
               "immersiveOnboarding": "Acknowledged before run, never during restoration",
               "displaySize": command(adb + ["shell", "wm", "size"]).decode().strip(),
               "displayDensity": command(adb + ["shell", "wm", "density"]).decode().strip(),
               "limits": "Debug artifact; not installed signed-phone candidate, process death, OEM display transfer or physical folding"}
    (args.output / "result.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print("Native restoration passed; " + str(args.output))


if __name__ == "__main__":
    main()
