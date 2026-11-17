package app.hexodus.ios;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The WebView renderer dying (crash, or killed as the low-memory killer and
 * WebView updates do) must rebuild the board, not take the app down. WebView
 * simulates each with chrome://crash and chrome://kill. If the app process
 * died, this test process would die with it and the run would fail.
 * Emulators only: it launches the game and replaces its Activity.
 */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 26)
public class RendererRecoveryTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();

    @Test
    public void rendererCrashRebuildsTheBoard() throws Exception {
        survive("chrome://crash");
    }

    @Test
    public void rendererKillRebuildsTheBoard() throws Exception {
        survive("chrome://kill");
    }

    private void survive(String trigger) throws Exception {
        assumeTrue("Emulator only", "ranchu".equals(Build.HARDWARE));
        int pid = Process.myPid();
        Intent intent = new Intent().setClassName("app.hexodus.ios", "app.hexodus.ios.MainActivity")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        Activity first = instrumentation.startActivitySync(intent);
        try {
            WebView before = boardReady(first);
            Instrumentation.ActivityMonitor monitor = instrumentation.addMonitor(MainActivity.class.getName(), null, false);
            Activity next;
            try {
                instrumentation.runOnMainSync(() -> before.loadUrl(trigger));
                next = instrumentation.waitForMonitorWithTimeout(monitor, 20000);
            } finally {
                instrumentation.removeMonitor(monitor);
            }
            assertNotNull("No rebuilt Activity after " + trigger, next);
            assertNotSame(first, next);
            WebView after = boardReady(next);
            assertNotSame("The dead WebView was reused", before, after);
            assertEquals(pid, Process.myPid());
            first = next;
        } finally {
            Activity last = first;
            instrumentation.runOnMainSync(last::finish);
        }
    }

    /** Waits for the bundled board page to finish booting in this Activity's WebView. */
    private WebView boardReady(Activity activity) throws Exception {
        long end = SystemClock.uptimeMillis() + 30000;
        while (SystemClock.uptimeMillis() < end) {
            AtomicReference<WebView> found = new AtomicReference<>();
            instrumentation.runOnMainSync(() -> found.set(findWeb(activity.getWindow().getDecorView())));
            WebView web = found.get();
            if (web != null && "true".equals(js(web,
                "document.readyState==='complete' && !!window.HEXSWEEPER_SPHERE_GAME && window.HEXSWEEPER_SPHERE_GAME.getState().cells.length>0"))) {
                return web;
            }
            SystemClock.sleep(100);
        }
        throw new AssertionError("Board never finished booting");
    }

    private String js(WebView web, String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> web.evaluateJavascript("(function(){try{return !!(" + expression + ");}catch(e){return false;}})()",
            value -> { result.set(value); done.countDown(); }));
        assertTrue("evaluateJavascript timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private static WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWeb(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
}
