package app.hexodus.ios;

import android.content.Context;
import android.graphics.Insets;
import android.graphics.Rect;
import android.os.Build;
import android.view.DisplayCutout;
import android.view.WindowInsets;
import android.widget.FrameLayout;

import java.util.ArrayList;
import java.util.List;

/** Native safe viewport around Capacitor, without changing the generated offline game. */
@SuppressWarnings("deprecation")
final class GameViewport extends FrameLayout {
    private WindowInsets lastInsets;

    GameViewport(Context context) {
        super(context);
        setBackgroundColor(0xff07080c);
    }

    @Override
    public WindowInsets onApplyWindowInsets(WindowInsets insets) {
        lastInsets = insets;
        updateBounds();
        // Insets are handled by the native rectangle. Pass explicit zeroes rather than
        // CONSUMED so Capacitor/WebView also clear any previous CSS safe-area values.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            int handled = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout();
            return new WindowInsets.Builder(insets)
                .setInsets(handled, Insets.NONE)
                .setInsetsIgnoringVisibility(handled, Insets.NONE)
                .setDisplayCutout(null)
                .build();
        }
        WindowInsets cleared = insets.replaceSystemWindowInsets(0, 0, 0, 0);
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? cleared.consumeDisplayCutout() : cleared;
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        updateBounds();
        requestApplyInsets();
    }

    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // The window origin can change when Samsung switches its compatibility frame.
        updateBounds();
        super.onLayout(changed, left, top, right, bottom);
    }

    private void updateBounds() {
        int width = getWidth(), height = getHeight();
        if (width <= 0 || height <= 0) return;
        int[] origin = new int[2];
        getLocationInWindow(origin);
        int left = 0, top = 0, right = width, bottom = height;
        List<GameViewportBounds.Box> cutouts = new ArrayList<>();
        if (lastInsets != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = lastInsets.getInsets(WindowInsets.Type.systemBars());
                left = bars.left;
                top = bars.top;
                right -= bars.right;
                bottom -= bars.bottom;
            } else {
                left = lastInsets.getSystemWindowInsetLeft();
                top = lastInsets.getSystemWindowInsetTop();
                right -= lastInsets.getSystemWindowInsetRight();
                bottom -= lastInsets.getSystemWindowInsetBottom();
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                DisplayCutout cutout = lastInsets.getDisplayCutout();
                if (cutout != null) for (Rect rect : cutout.getBoundingRects()) {
                    cutouts.add(new GameViewportBounds.Box(rect.left - origin[0], rect.top - origin[1],
                        rect.right - origin[0], rect.bottom - origin[1]));
                }
            }
        }
        left = Math.max(0, Math.min(width, left));
        top = Math.max(0, Math.min(height, top));
        GameViewportBounds.Box available = new GameViewportBounds.Box(left, top,
            Math.max(left, Math.min(width, right)), Math.max(top, Math.min(height, bottom)));
        GameViewportBounds.Box bounds = GameViewportBounds.fit(width, height, available,
            cutouts, Build.MANUFACTURER, Build.MODEL);
        int bottomPadding = height - bounds.bottom, rightPadding = width - bounds.right;
        if (getPaddingLeft() != bounds.left || getPaddingTop() != bounds.top
            || getPaddingRight() != rightPadding || getPaddingBottom() != bottomPadding) {
            setPadding(bounds.left, bounds.top, rightPadding, bottomPadding);
        }
    }
}
