package app.hexodus.ios;

import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

@SuppressWarnings("deprecation")
public class MainActivity extends BridgeActivity {
    private GameViewport gameViewport;
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
                bootstrapUiSession(webView, uiSessionGeneration, 0);
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
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
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
