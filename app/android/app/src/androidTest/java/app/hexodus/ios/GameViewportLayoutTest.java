package app.hexodus.ios;

import android.graphics.Insets;
import android.graphics.Rect;
import android.os.Looper;
import android.view.DisplayCutout;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.FrameLayout;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.FutureTask;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;

/** Exercises real FrameLayout child measurement without launching the game or an Activity. */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 29)
@SuppressWarnings("deprecation")
public class GameViewportLayoutTest {
    @Test
    public void fullWideFullMeasuresTheSameChildInsideTheSafeRectangle() throws Exception {
        onUiThread(() -> {
            GameViewport viewport = new GameViewport(InstrumentationRegistry.getInstrumentation().getTargetContext());
            View child = addPlainChild(viewport);
            viewport.dispatchApplyWindowInsets(bottomCutout(839));

            measureAndLayout(viewport, 1048);
            assertChild(viewport, child, 839, 209);

            // The same reported camera bounds now begin outside this shorter app frame.
            measureAndLayout(viewport, 839);
            assertChild(viewport, child, 839, 0);

            measureAndLayout(viewport, 1048);
            assertChild(viewport, child, 839, 209);
        });
    }

    @Test
    public void insetsOnlyChangeRemeasuresAtTheSameWindowSize() throws Exception {
        onUiThread(() -> {
            GameViewport viewport = new GameViewport(InstrumentationRegistry.getInstrumentation().getTargetContext());
            View child = addPlainChild(viewport);
            viewport.dispatchApplyWindowInsets(bottomCutout(839));
            measureAndLayout(viewport, 1048);
            assertChild(viewport, child, 839, 209);

            viewport.dispatchApplyWindowInsets(bottomCutout(1000));
            // Do not force layout: the insets callback must invalidate the cached measure.
            measureAndLayout(viewport, 1048);
            assertChild(viewport, child, 1000, 48);
        });
    }

    private static void onUiThread(Runnable action) throws Exception {
        // Existing dependencies do not include test:rules' @UiThreadTest. Use the
        // instrumentation primitive directly, and propagate assertions to JUnit.
        FutureTask<Void> task = new FutureTask<>(() -> {
            assertSame(Looper.getMainLooper(), Looper.myLooper());
            action.run();
            return null;
        });
        InstrumentationRegistry.getInstrumentation().runOnMainSync(task);
        task.get();
    }

    private static View addPlainChild(GameViewport viewport) {
        View child = new View(viewport.getContext());
        viewport.addView(child, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return child;
    }

    private static WindowInsets bottomCutout(int top) {
        DisplayCutout cutout = new DisplayCutout(Insets.of(0, 0, 0, 1048 - top),
            null, null, null, new Rect(428, top, 948, 1048));
        return new WindowInsets.Builder()
            .setDisplayCutout(cutout)
            .setSystemWindowInsets(Insets.NONE)
            .setStableInsets(Insets.NONE)
            .build();
    }

    private static void measureAndLayout(GameViewport viewport, int height) {
        viewport.measure(View.MeasureSpec.makeMeasureSpec(948, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        viewport.layout(0, 0, 948, height);
    }

    private static void assertChild(GameViewport viewport, View child, int height, int bottomPadding) {
        assertSame(child, viewport.getChildAt(0));
        assertEquals(948, child.getMeasuredWidth());
        assertEquals(948, child.getWidth());
        assertEquals(height, child.getMeasuredHeight());
        assertEquals(height, child.getHeight());
        assertEquals(bottomPadding, viewport.getPaddingBottom());
    }
}
