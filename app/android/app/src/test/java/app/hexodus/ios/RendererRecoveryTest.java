package app.hexodus.ios;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class RendererRecoveryTest {
    @Test
    public void rebuildsAfterEachOccasionalRendererDeath() {
        RendererRecovery recovery = new RendererRecovery();
        long now = 1_000_000L;
        for (int i = 0; i < 20; i++) {
            assertTrue("death " + i, recovery.shouldRebuild(now));
            now += RendererRecovery.WINDOW_MS; // a fresh window each time
        }
    }

    @Test
    public void stopsRebuildingWhenTheRendererKeepsDying() {
        RendererRecovery recovery = new RendererRecovery();
        long now = 5_000L;
        for (int i = 0; i < RendererRecovery.MAX_REBUILDS; i++) {
            assertTrue(recovery.shouldRebuild(now + i * 1_000L));
        }
        assertFalse(recovery.shouldRebuild(now + 4_000L));
        assertFalse(recovery.shouldRebuild(now + 5_000L));
    }

    @Test
    public void rebuildsAgainOnceTheEarlierDeathsAgeOut() {
        RendererRecovery recovery = new RendererRecovery();
        for (int i = 0; i < RendererRecovery.MAX_REBUILDS; i++) {
            assertTrue(recovery.shouldRebuild(i * 100L));
        }
        assertFalse(recovery.shouldRebuild(500L));
        assertTrue(recovery.shouldRebuild(RendererRecovery.WINDOW_MS + 300L));
    }
}
