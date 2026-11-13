package app.hexodus.ios;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * What Android backup may carry to a new phone, and nothing else.
 *
 * The game keeps everything in the WebView's local storage, which is one
 * database file set holding the unfinished board and sheet state as well. A
 * backup cannot take part of that, so the shell copies the few values below
 * into one small preferences file ({@link #PREFS}); the backup rules include
 * that file only. On a fresh install that file is copied back into the page.
 */
final class TravelingData {
    /** The one file the backup rules include (shared_prefs/hexsweeper_backup.xml). */
    static final String PREFS = "hexsweeper_backup";
    /** Stays on the device: records that this install has already taken the copy back. */
    static final String DEVICE_PREFS = "hexsweeper_device";
    static final String DEVICE_SEEDED = "seeded";

    /** Local storage keys that travel: best times, theme, and the settings. */
    static final List<String> KEYS = Collections.unmodifiableList(Arrays.asList(
        "hexsweeper-sphere-best-v1",        // best time per board size
        "hexsweeper-sphere-theme-v6",       // theme
        "hexsweeper-sphere-size-v2",        // board size
        "hexsweeper-sphere-invert-v6",      // drag inversion
        "hexsweeper-effects-v1",            // effects
        "hexsweeper-sphere-countstyle-v1"   // count style
    ));

    /** No single value the game stores comes near this; a larger one is not ours. */
    static final int MAX_VALUE_LENGTH = 8 * 1024;

    private TravelingData() {}

    /** Keeps only the traveling keys with sane values, in a fixed order. */
    static Map<String, String> filter(Map<String, ?> values) {
        Map<String, String> kept = new LinkedHashMap<>();
        if (values == null) return kept;
        for (String key : KEYS) {
            Object value = values.get(key);
            if (!(value instanceof String)) continue;
            String text = (String) value;
            if (text.isEmpty() || text.length() > MAX_VALUE_LENGTH) continue;
            kept.put(key, text);
        }
        return kept;
    }

    /** A JavaScript string literal for any text, safe to place inside a script. */
    static String jsString(String text) {
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '"' || c == '\\') out.append('\\').append(c);
            else if (c < 0x20 || c == '<' || c == '>' || c == '&' || c == 0x2028 || c == 0x2029 || c > 0x7e) {
                out.append(String.format("\\u%04x", (int) c));
            } else out.append(c);
        }
        return out.append('"').toString();
    }

    /** Script that returns the traveling values now in the page, as a JSON object. */
    static String readScript() {
        StringBuilder keys = new StringBuilder("[");
        for (String key : KEYS) keys.append(keys.length() > 1 ? "," : "").append(jsString(key));
        keys.append("]");
        return "(function(){var o={},k=" + keys + ";try{for(var i=0;i<k.length;i++){var v=localStorage.getItem(k[i]);"
            + "if(typeof v==='string')o[k[i]]=v;}}catch(e){return null;}return JSON.stringify(o);})()";
    }

    /**
     * Script that writes the given values into the page where the page has none,
     * and returns how many it wrote. It never replaces a value the page has.
     */
    static String seedScript(Map<String, String> values) {
        StringBuilder pairs = new StringBuilder("[");
        for (Map.Entry<String, String> entry : filter(values).entrySet()) {
            pairs.append(pairs.length() > 1 ? "," : "")
                .append("[").append(jsString(entry.getKey())).append(",").append(jsString(entry.getValue())).append("]");
        }
        pairs.append("]");
        return "(function(){var p=" + pairs + ",n=0;try{for(var i=0;i<p.length;i++){"
            + "if(localStorage.getItem(p[i][0])===null){localStorage.setItem(p[i][0],p[i][1]);n++;}}}catch(e){return -1;}return n;})()";
    }
}
