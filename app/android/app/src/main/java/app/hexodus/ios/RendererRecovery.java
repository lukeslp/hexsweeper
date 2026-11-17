package app.hexodus.ios;

/**
 * Decides what to do when the WebView's renderer process dies.
 *
 * Android 8 and later kill the whole app when a WebView's renderer goes away
 * and no WebViewClient claims it: the low-memory killer taking the renderer,
 * a WebView update from the Play Store, or a renderer crash. MainActivity
 * claims it and rebuilds the Activity, which reloads the board from its
 * autosave. A renderer that keeps dying straight after each rebuild would
 * turn that into an endless reload, so after {@link #MAX_REBUILDS} deaths
 * inside {@link #WINDOW_MS} the Activity closes instead.
 *
 * One instance lives for the process, so it outlasts the Activity rebuilds it
 * counts.
 */
final class RendererRecovery {
    static final long WINDOW_MS = 30_000L;
    static final int MAX_REBUILDS = 3;

    private final long[] recent = new long[MAX_REBUILDS];
    private int count;

    /** Records a renderer death at {@code nowMs} (elapsed realtime) and says whether to rebuild. */
    synchronized boolean shouldRebuild(long nowMs) {
        int kept = 0;
        for (int i = 0; i < count; i++) {
            if (nowMs - recent[i] < WINDOW_MS) recent[kept++] = recent[i];
        }
        count = kept;
        if (count >= MAX_REBUILDS) return false;
        recent[count++] = nowMs;
        return true;
    }
}
