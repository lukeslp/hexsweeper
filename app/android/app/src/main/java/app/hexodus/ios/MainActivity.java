package app.hexodus.ios;

import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@SuppressWarnings("deprecation")
public class MainActivity extends BridgeActivity {
    private static final String TAG = "Hexsweeper";
    /** Process-wide, so it counts renderer deaths across the Activity rebuilds they cause. */
    private static final RendererRecovery RENDERER_RECOVERY = new RendererRecovery();
    private GameViewport gameViewport;
    /** Set once this Activity's WebView has lost its renderer; it must not be used again. */
    private boolean rendererGone;
    private boolean restoreUiSessionPending;
    private boolean uiSessionBootstrapInFlight;
    private int uiSessionGeneration;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        restoreUiSessionPending = savedInstanceState != null;
        // The game's Share button calls this plugin by name.
        registerPlugin(HexSharePlugin.class);
        // The page reports its background so the cutout strip can match it.
        registerPlugin(HexBackdropPlugin.class);
        // Samsung can recreate an Activity with a WebView during display transfer,
        // even when its configuration changes are handled. Replay only the game's
        // bounded panel projection after its own scripts have initialized.
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                uiSessionGeneration++;
                uiSessionBootstrapInFlight = false;
            }

            @Override
            public void onPageLoaded(WebView webView) {
                syncTravelingData(webView);
                bootstrapUiSession(webView, uiSessionGeneration, 0);
                // A rebuild after a renderer death can come back with the
                // system bars showing; hide them again once the board is up.
                keepScreenImmersive();
            }

            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                return recoverFromRendererGone(webView, detail);
            }
        });
        super.onCreate(savedInstanceState);
        if (getBridge() != null) {
            ViewGroup content = findViewById(android.R.id.content);
            View bridgeRoot = content.getChildAt(0);
            content.removeView(bridgeRoot);
            gameViewport = new GameViewport(this);
            gameViewport.addView(bridgeRoot, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            content.addView(gameViewport, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        keepScreenImmersive();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBack(this);
            }
        });
    }

    // Closes whichever of the game's own sheets is on top and says whether one was.
    private static final String CLOSE_TOP_SHEET_JS =
        "(function(){var s=[['history-lightbox','lightbox-close-btn'],['tutorial-overlay','tutorial-play-btn']," +
        "['help-overlay','help-close-btn']];for(var i=0;i<s.length;i++){var e=document.getElementById(s[i][0])," +
        "b=document.getElementById(s[i][1]);if(e&&b&&!e.hidden){b.click();return true;}}return false;})()";

    /**
     * System Back steps out of what is open before it leaves the app: a sheet on
     * the board closes, and the Licenses page or the Water Wheel returns to the
     * board. With nothing open it leaves the app, as it always has.
     */
    private void handleBack(OnBackPressedCallback callback) {
        WebView webView = getBridge() != null && !rendererGone ? getBridge().getWebView() : null;
        if (webView == null) {
            leaveApp(callback);
            return;
        }
        if (!isBoardPage(webView.getUrl())) {
            if (webView.canGoBack()) webView.goBack();
            else leaveApp(callback);
            return;
        }
        webView.evaluateJavascript(CLOSE_TOP_SHEET_JS, result -> {
            if (!"true".equals(result) && !isFinishing() && !isDestroyed()) leaveApp(callback);
        });
    }

    private void leaveApp(OnBackPressedCallback callback) {
        callback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        callback.setEnabled(true);
    }

    private static boolean isBoardPage(String url) {
        if (url == null) return true;
        String path = Uri.parse(url).getPath();
        return path == null || path.isEmpty() || "/".equals(path) || "/index.html".equals(path);
    }

    /**
     * The page's renderer process died. Left unclaimed, Android 8 and later kill
     * the whole app ("wasn't handled by all associated webviews, killing
     * application"), which a player sees as a crash. That happens when the
     * low-memory killer takes the renderer, when the Play Store updates the
     * WebView, or when the renderer crashes. Drop the dead WebView, as the
     * platform requires, and rebuild the Activity: the board reloads from its
     * autosave and an open sheet comes back through the saved-state path.
     */
    private boolean recoverFromRendererGone(WebView webView, RenderProcessGoneDetail detail) {
        rendererGone = true;
        boolean crashed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null && detail.didCrash();
        Log.w(TAG, "WebView renderer " + (crashed ? "crashed" : "was killed") + "; rebuilding the board");
        ViewParent parent = webView.getParent();
        if (parent instanceof ViewGroup) ((ViewGroup) parent).removeView(webView);
        webView.destroy();
        if (isFinishing() || isDestroyed()) return true;
        if (RENDERER_RECOVERY.shouldRebuild(SystemClock.elapsedRealtime())) {
            recreate();
        } else {
            // The renderer keeps dying right after loading: close rather than loop.
            Log.w(TAG, "WebView renderer died repeatedly; closing");
            finish();
        }
        return true;
    }

    /** Color of the strip the game leaves clear beside a camera cutout. */
    void setBackdropColor(int color) {
        if (gameViewport != null) gameViewport.setBackgroundColor(color);
    }

    private void bootstrapUiSession(WebView webView, int generation, int attempt) {
        if (generation != uiSessionGeneration || uiSessionBootstrapInFlight || isFinishing() || isDestroyed()) return;
        String url = webView.getUrl();
        if (url == null) return;
        Uri uri = Uri.parse(url);
        String path = uri.getPath();
        if (!"https".equals(uri.getScheme()) || !"localhost".equals(uri.getHost()) ||
            uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443) ||
            !(path == null || path.isEmpty() || "/".equals(path) || "/index.html".equals(path))) return;

        uiSessionBootstrapInFlight = true;
        webView.evaluateJavascript(
            "(function(){if(typeof window.__restoreNativeUiSession!=='function')return false;" +
            "window.__restoreNativeUiSession(" + restoreUiSessionPending + ");return true;})()",
            result -> {
                if (generation != uiSessionGeneration) return;
                uiSessionBootstrapInFlight = false;
                if ("true".equals(result)) {
                    restoreUiSessionPending = false;
                } else if (attempt < 10 && !isFinishing() && !isDestroyed()) {
                    // A listener may finish before deferred page setup. Do not
                    // consume restoration until the owned hook accepts it.
                    webView.postDelayed(() -> bootstrapUiSession(webView, generation, attempt + 1), 50);
                }
            }
        );
    }

    @Override
    public void onPause() {
        // A best time or a setting changed since the page loaded: refresh the
        // copy Android backup takes before the app leaves the screen.
        WebView webView = getBridge() != null && !rendererGone ? getBridge().getWebView() : null;
        if (webView != null && isOwnBoardPage(webView.getUrl())) mirrorTravelingData(webView);
        super.onPause();
    }

    /**
     * Android backup carries one small preferences file (see TravelingData and
     * res/xml/data_extraction_rules.xml). On the first board load of an install,
     * a restored copy is written into the page where the page has nothing, and
     * the page reloads once to pick it up. After that the copy only follows the
     * page.
     */
    private void syncTravelingData(WebView webView) {
        if (!isOwnBoardPage(webView.getUrl())) return;
        SharedPreferences device = getSharedPreferences(TravelingData.DEVICE_PREFS, MODE_PRIVATE);
        if (!device.getBoolean(TravelingData.DEVICE_SEEDED, false)) {
            device.edit().putBoolean(TravelingData.DEVICE_SEEDED, true).apply();
            Map<String, String> restored = TravelingData.filter(
                getSharedPreferences(TravelingData.PREFS, MODE_PRIVATE).getAll());
            if (!restored.isEmpty()) {
                webView.evaluateJavascript(TravelingData.seedScript(restored), written -> {
                    if (isFinishing() || isDestroyed()) return;
                    boolean wroteSomething;
                    try {
                        wroteSomething = written != null && Integer.parseInt(written.trim()) > 0;
                    } catch (NumberFormatException e) {
                        wroteSomething = false;
                    }
                    if (wroteSomething) webView.reload();
                    else mirrorTravelingData(webView);
                });
                return;
            }
        }
        mirrorTravelingData(webView);
    }

    private void mirrorTravelingData(WebView webView) {
        webView.evaluateJavascript(TravelingData.readScript(), result -> {
            Map<String, Object> page = new HashMap<>();
            try {
                Object decoded = new JSONTokener(result == null ? "null" : result).nextValue();
                if (!(decoded instanceof String)) return;
                JSONObject values = new JSONObject((String) decoded);
                for (Iterator<String> keys = values.keys(); keys.hasNext(); ) {
                    String key = keys.next();
                    page.put(key, values.optString(key, ""));
                }
            } catch (JSONException e) {
                return;
            }
            Map<String, String> traveling = TravelingData.filter(page);
            // An empty page (storage unreadable, or nothing chosen yet) never erases the copy.
            if (traveling.isEmpty()) return;
            SharedPreferences.Editor editor =
                getSharedPreferences(TravelingData.PREFS, MODE_PRIVATE).edit().clear();
            for (Map.Entry<String, String> entry : traveling.entrySet()) {
                editor.putString(entry.getKey(), entry.getValue());
            }
            editor.apply();
        });
    }

    /** The bundled board page and nothing else: never the Licenses page, the Wheel or a foreign URL. */
    private static boolean isOwnBoardPage(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equals(uri.getScheme()) && "localhost".equals(uri.getHost())
            && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
            && isBoardPage(url);
    }

    @Override
    public void onResume() {
        super.onResume();
        keepScreenImmersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) keepScreenImmersive();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        keepScreenImmersive();
    }

    private void keepScreenImmersive() {
        Window activityWindow = getWindow();
        // Keep the WebView in the real app window so fold and compatibility-frame
        // resizes produce an actual viewport resize instead of drawing off-window.
        activityWindow.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        activityWindow.getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activityWindow.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = activityWindow.getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
                controller.hide(WindowInsets.Type.systemBars());
            }
        }
        if (gameViewport != null) gameViewport.requestApplyInsets();
    }
}
