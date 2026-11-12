package app.hexodus.ios;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class BackdropColorTest {
    @Test
    public void readsWhatAWebViewReportsForASolidBackground() {
        assertEquals(Integer.valueOf(0xffffffff), BackdropColor.parse("rgb(255, 255, 255)"));
        assertEquals(Integer.valueOf(0xff07080c), BackdropColor.parse("rgb(7, 8, 12)"));
        assertEquals(Integer.valueOf(0xff102030), BackdropColor.parse(" rgba(16, 32, 48, 1) "));
        assertEquals(Integer.valueOf(0xff102030), BackdropColor.parse("rgb(16 32 48 / 100%)"));
        assertEquals(Integer.valueOf(0xff0a0b0c), BackdropColor.parse("#0a0B0c"));
    }

    @Test
    public void refusesAnythingThatIsNotASolidColor() {
        assertNull(BackdropColor.parse(null));
        assertNull(BackdropColor.parse(""));
        assertNull(BackdropColor.parse("transparent"));
        assertNull(BackdropColor.parse("rgba(0, 0, 0, 0)"));
        assertNull(BackdropColor.parse("rgba(10, 10, 10, 0.5)"));
        assertNull(BackdropColor.parse("rgb(300, 0, 0)"));
        assertNull(BackdropColor.parse("#fff"));
        assertNull(BackdropColor.parse("linear-gradient(#000, #fff)"));
        assertNull(BackdropColor.parse("rgb(1, 2, 3); drop"));
    }
}
