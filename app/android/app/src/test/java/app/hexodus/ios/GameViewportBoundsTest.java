package app.hexodus.ios;

import org.junit.Test;
import java.util.Arrays;
import java.util.Collections;
import static org.junit.Assert.*;

public class GameViewportBoundsTest {
    private static GameViewportBounds.Box full(int width, int height) {
        return new GameViewportBounds.Box(0, 0, width, height);
    }

    private static void assertBox(int left, int top, int right, int bottom, GameViewportBounds.Box box) {
        assertEquals(left, box.left);
        assertEquals(top, box.top);
        assertEquals(right, box.right);
        assertEquals(bottom, box.bottom);
    }

    @Test public void reportedCameraStripLeavesFullWidthAboveIt() {
        GameViewportBounds.Box camera = new GameViewportBounds.Box(428, 839, 948, 1048);
        GameViewportBounds.Box safe = GameViewportBounds.fit(948, 1048, full(948, 1048),
            Collections.singletonList(camera), "samsung", "SM-F776U1");
        assertBox(0, 0, 948, 839, safe);
        assertFalse(safe.overlaps(camera));
    }

    @Test public void compatibilityFrameDoesNotSubtractOutOfViewCameraAgain() {
        // Physical Flip8 Samsung wide frame, measured by the parent workstream.
        GameViewportBounds.Box safe = GameViewportBounds.fit(1422, 1259, full(1422, 1259),
            Collections.singletonList(new GameViewportBounds.Box(642, 1259, 1422, 1572)),
            "samsung", "SM-F776U1");
        assertBox(0, 0, 1422, 1259, safe);
    }

    @Test public void fullCoverWithoutCutoutUsesConservativeMeasuredStrip() {
        assertBox(0, 0, 948, 839, GameViewportBounds.fit(948, 1048, full(948, 1048),
            Collections.emptyList(), "samsung", "SM-F776U1"));
        assertBox(0, 0, 1422, 1258, GameViewportBounds.fit(1422, 1572, full(1422, 1572),
            Collections.emptyList(), "Samsung", "sm-f766b"));
    }

    @Test public void modelFallbackNeverTrimsInnerWideOrOlderFlipScreens() {
        int[][] sizes = {{1080, 2520}, {1422, 1259}, {885, 1572}, {1048, 948}};
        for (int[] size : sizes) {
            assertBox(0, 0, size[0], size[1], GameViewportBounds.fit(size[0], size[1], full(size[0], size[1]),
                Collections.emptyList(), "samsung", "SM-F776U1"));
        }
        for (String model : new String[]{"SM-F741", "Pixel 10", null}) {
            assertBox(0, 0, 948, 1048, GameViewportBounds.fit(948, 1048, full(948, 1048),
                Collections.emptyList(), "samsung", model));
        }
        assertBox(0, 0, 948, 1048, GameViewportBounds.fit(948, 1048, full(948, 1048),
            Collections.emptyList(), "other", "SM-F776U1"));
    }

    @Test public void realCutoutWinsOverModelEvenIfItLeavesMoreSpace() {
        assertBox(0, 0, 948, 900, GameViewportBounds.fit(948, 1048, full(948, 1048),
            Collections.singletonList(new GameViewportBounds.Box(428, 900, 948, 1048)),
            "samsung", "SM-F776U1"));
    }

    @Test public void punchHoleAndBarsAreHandledOnce() {
        GameViewportBounds.Box bars = new GameViewportBounds.Box(0, 24, 1080, 2352);
        assertBox(0, 40, 1080, 2352, GameViewportBounds.fit(1080, 2400, bars,
            Collections.singletonList(new GameViewportBounds.Box(510, 0, 570, 40)),
            "Google", "Pixel"));
    }

    @Test public void clippedOffsetCutoutUsesOnlyIntersectionWithAppWindow() {
        assertBox(0, 0, 948, 800, GameViewportBounds.fit(948, 1048, full(948, 1048),
            Collections.singletonList(new GameViewportBounds.Box(428, 800, 1100, 1200)),
            "samsung", "SM-F776U1"));
    }

    @Test public void multipleCutoutsLeaveLargestUnobstructedRectangle() {
        GameViewportBounds.Box upper = new GameViewportBounds.Box(400, 0, 600, 60);
        GameViewportBounds.Box lower = new GameViewportBounds.Box(500, 800, 1000, 1000);
        GameViewportBounds.Box safe = GameViewportBounds.fit(1000, 1000, full(1000, 1000),
            Arrays.asList(upper, lower), "other", "other");
        assertBox(0, 60, 1000, 800, safe);
        assertFalse(safe.overlaps(upper));
        assertFalse(safe.overlaps(lower));
    }
}
