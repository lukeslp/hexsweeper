package app.hexodus.ios;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Test APK only. DOM calls prepare existing UI; restoration is exclusively native-owned. */
final class NativeUiRestorationChecks {
    private static final String KEY = "hexsweeper-sphere-native-ui-v1";
    private final Instrumentation instrumentation;
    private Activity activity;
    private WebView web;
    private final JSONArray observations = new JSONArray();
    private NativeUiRestorationChecks(Instrumentation value) { instrumentation = value; }

    static JSONObject run(Instrumentation instrumentation, Bundle args) throws Exception {
        // Refuse before starting an Activity or touching synthetic application data.
        check("yes".equals(args.getString("nativeUiFixture")), "Explicit nativeUiFixture=yes required");
        check(args.getString("fixtureSerial", "").matches("emulator-[0-9]+"), "Explicit emulator serial required");
        check("ranchu".equals(Build.HARDWARE) && Build.MODEL.startsWith("sdk_gphone"), "Physical devices refused");
        check((instrumentation.getTargetContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0,
            "Only local debug fixture APKs are accepted");
        check("app.hexodus.ios".equals(instrumentation.getTargetContext().getPackageName()), "Wrong target");
        check(instrumentation.getTargetContext().checkSelfPermission("android.permission.INTERNET") != PackageManager.PERMISSION_GRANTED,
            "Offline application required");
        check(Settings.Secure.getInt(instrumentation.getTargetContext().getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED, 0) == 0,
            "Accessibility services must remain off; test will not alter them");
        NativeUiRestorationChecks checks = new NativeUiRestorationChecks(instrumentation);
        try { return checks.exercise(); }
        finally {
            if (checks.activity != null) instrumentation.runOnMainSync(() -> checks.activity.finish());
        }
    }

    private JSONObject exercise() throws Exception {
        Intent intent = new Intent().setClassName("app.hexodus.ios", "app.hexodus.ios.MainActivity");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        activity = instrumentation.startActivitySync(intent);
        attachWeb(); ready();
        js("if(!document.getElementById('tutorial-overlay').hidden)document.getElementById('tutorial-play-btn').click(); return true;");
        await("document.getElementById('tutorial-overlay').hidden");
        prepare();
        JSONObject prepared = state(); record("prepared", prepared);
        recreate();
        assertRestored(prepared); record("recreated-open", state());
        // No content touch, DOM focus repair, or synthetic JS key event between recreation and Escape.
        check(onUiFocus(), "Restored Android WebView lacks native focus before Escape");
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ESCAPE);
        await("!" + openExpression());
        await("JSON.parse(localStorage.getItem(KEY)).open===false");
        record("native-escape", state());
        recreate();
        check(!state().getBoolean("open"), "Dismissed panel reopened after recreation");
        record("recreated-closed", state());
        laterDocument();
        prepare();
        JSONObject later = state(); record("later-document-prepared", later);
        recreate(); assertRestored(later);
        check(onUiFocus(), "Later restored WebView lacks native focus");
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ESCAPE);
        await("!" + openExpression());
        record("later-document-restored-then-escaped", state());
        return new JSONObject().put("observations", observations).put("activityRecreations", 3)
            .put("nativeEscapeWithoutTouch", 2).put("productionNetworkPermission", false)
            .put("model", Build.MODEL).put("api", Build.VERSION.SDK_INT)
            .put("limits", "Activity.recreate in one emulator process; not process death, physical folding, TalkBack or a signed release build. DOM setup uses existing click/focus handlers; native keys traverse the actual Android View.");
    }

    private void prepare() throws Exception {
        js("document.getElementById('qc-help').click();document.getElementById('help-tab-themes').click(); return true;");
        await(openExpression());
        js("document.getElementById('help-tab-themes').focus({preventScroll:true});document.getElementById('help-panel').scrollTop=120;return true;");
        await("document.getElementById('help-panel').scrollTop>0");
        await("JSON.parse(localStorage.getItem(KEY)).open && JSON.parse(localStorage.getItem(KEY)).scroll===document.getElementById('help-panel').scrollTop");
    }

    private void laterDocument() throws Exception {
        js("document.getElementById('qc-help').click();document.getElementById('help-tab-board').click();document.getElementById('help-wheel-btn').click();return true;");
        await("location.pathname.endsWith('/wheel.html') && document.readyState==='complete' && !!document.querySelector('.app-back')");
        js("document.querySelector('.app-back').click();return true;");
        await("location.pathname.endsWith('/index.html') && document.readyState==='complete'");
        ready();
        check(!state().getBoolean("open"), "New owned document must start with a closed projection");
    }

    private void assertRestored(JSONObject before) throws Exception {
        await(openExpression());
        JSONObject after = state();
        check(before.getString("tab").equals(after.getString("tab")), "Selected tab was lost");
        check(Math.abs(before.getDouble("scroll") - after.getDouble("scroll")) <= 2, "Scroll position was lost: " + before + " -> " + after);
        check(before.getString("focus").equals(after.getString("focus")), "DOM focus token was lost");
        check(before.getDouble("timeOrigin") != after.getDouble("timeOrigin"), "Document was not replaced");
    }

    private void recreate() throws Exception {
        Activity old = activity; WebView oldWeb = web;
        Instrumentation.ActivityMonitor monitor = instrumentation.addMonitor("app.hexodus.ios.MainActivity", null, false);
        try {
            instrumentation.runOnMainSync(old::recreate);
            Activity replacement = instrumentation.waitForMonitorWithTimeout(monitor, 20000);
            check(replacement != null && replacement != old, "Activity.recreate did not create a replacement");
            activity = replacement; attachWeb(); ready();
            check(web != oldWeb, "Recreation reused old WebView");
        } finally { instrumentation.removeMonitor(monitor); }
    }

    private void attachWeb() throws Exception {
        long end = SystemClock.uptimeMillis() + 20000;
        do {
            instrumentation.runOnMainSync(() -> web = findWeb(activity.getWindow().getDecorView()));
            if (web != null) return;
            SystemClock.sleep(50);
        } while (SystemClock.uptimeMillis() < end);
        throw new AssertionError("No production WebView attached");
    }
    private static WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i=0;i<group.getChildCount();i++) { WebView found=findWeb(group.getChildAt(i)); if(found!=null)return found; }
        }
        return null;
    }
    private boolean onUiFocus() {
        boolean[] focused = {false}; instrumentation.runOnMainSync(() -> focused[0] = activity.hasWindowFocus() && web.hasFocus()); return focused[0];
    }
    private void ready() throws Exception {
        await("document.readyState==='complete' && typeof window.__restoreNativeUiSession==='function' && localStorage.getItem(KEY)!==null");
        check("true".equals(js("return innerWidth<=640 && innerHeight<=600;")), "Configure a compact dedicated emulator viewport before running");
        long end = SystemClock.uptimeMillis() + 10000;
        boolean[] focused = {false};
        do {
            instrumentation.runOnMainSync(() -> focused[0] = activity.hasWindowFocus());
            if (focused[0]) return;
            SystemClock.sleep(50);
        } while (SystemClock.uptimeMillis() < end);
        throw new AssertionError("Activity window never became foreground");
    }
    private void await(String expression) throws Exception {
        long end = SystemClock.uptimeMillis() + 20000;
        String result = "";
        do {
            result = js("return !!(" + expression + ");");
            if ("true".equals(result)) return;
            SystemClock.sleep(50);
        } while (SystemClock.uptimeMillis() < end);
        throw new AssertionError("Timed out: " + expression + " => " + result);
    }
    private String js(String body) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> web.evaluateJavascript("(function(){const KEY='" + KEY + "';" + body + "})()", value -> {result.set(value);done.countDown();}));
        check(done.await(10, TimeUnit.SECONDS), "evaluateJavascript callback timed out");
        return result.get();
    }
    private JSONObject state() throws Exception { return new JSONObject(js("return {open:!document.getElementById('help-overlay').hidden,scroll:document.getElementById('help-panel').scrollTop,focus:document.activeElement.id,tab:document.querySelector('.help-tab[aria-selected=true]').dataset.tab,stored:JSON.parse(localStorage.getItem(KEY)),url:location.href,timeOrigin:performance.timeOrigin,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};")); }
    private String openExpression() { return "!document.getElementById('help-overlay').hidden"; }
    private void record(String step, JSONObject value) throws Exception {
        JSONObject observation = new JSONObject().put("step",step).put("state",value).put("nativeWebFocus",onUiFocus());
        observations.put(observation);
        Bundle update = new Bundle(); update.putString("nativeUiStep", observation.toString()); instrumentation.sendStatus(0, update);
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
