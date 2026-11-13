package app.hexodus.ios;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.HashMap;
import java.util.Map;

public class TravelingDataTest {
    @Test
    public void onlyBestTimesThemeAndSettingsTravel() {
        Map<String, Object> page = new HashMap<>();
        page.put("hexsweeper-sphere-best-v1", "{\"xsmall\":{\"seconds\":41}}");
        page.put("hexsweeper-sphere-theme-v6", "aurora");
        page.put("hexsweeper-sphere-size-v2", "hard");
        page.put("hexsweeper-sphere-invert-v6", "{\"x\":true,\"y\":false}");
        page.put("hexsweeper-effects-v1", "reduced");
        page.put("hexsweeper-sphere-countstyle-v1", "numerals");
        page.put("hexsweeper-sphere-run-v2", "{\"an\":\"unfinished board\"}");
        page.put("hexsweeper-sphere-native-ui-v1", "{\"open\":true}");
        page.put("hexsweeper-sphere-sheet-tab-v1", "themes");
        page.put("hexsweeper-sphere-welcome-v1", "1");
        page.put("something-else", "x");
        Map<String, String> kept = TravelingData.filter(page);
        assertEquals(TravelingData.KEYS, new java.util.ArrayList<>(kept.keySet()));
        assertEquals("aurora", kept.get("hexsweeper-sphere-theme-v6"));
        assertFalse(kept.containsKey("hexsweeper-sphere-run-v2"));
    }

    @Test
    public void dropsValuesThatAreNotPlainSmallText() {
        Map<String, Object> page = new HashMap<>();
        page.put("hexsweeper-sphere-theme-v6", 7);
        page.put("hexsweeper-sphere-size-v2", "");
        page.put("hexsweeper-sphere-best-v1", new String(new char[TravelingData.MAX_VALUE_LENGTH + 1]).replace('\0', 'a'));
        assertTrue(TravelingData.filter(page).isEmpty());
        assertTrue(TravelingData.filter(null).isEmpty());
    }

    @Test
    public void valuesCannotBreakOutOfTheScript() {
        assertEquals("\"a\\\"b\\\\c\"", TravelingData.jsString("a\"b\\c"));
        assertEquals("\"\\u003c/script\\u003e\\u000a\\u2028\"", TravelingData.jsString("</script>\n\u2028"));
        Map<String, String> values = new HashMap<>();
        values.put("hexsweeper-sphere-theme-v6", "\");alert(1);(\"");
        values.put("hexsweeper-sphere-run-v2", "never");
        String script = TravelingData.seedScript(values);
        assertTrue(script.contains("[\"hexsweeper-sphere-theme-v6\",\"\\\");alert(1);(\\\"\"]"));
        assertFalse(script.contains("run-v2"));
        assertTrue(script.contains("localStorage.getItem(p[i][0])===null"));
    }

    @Test
    public void readScriptAsksForTheTravelingKeysOnly() {
        String script = TravelingData.readScript();
        for (String key : TravelingData.KEYS) assertTrue(script.contains("\"" + key + "\""));
        assertFalse(script.contains("run-v2"));
    }
}
