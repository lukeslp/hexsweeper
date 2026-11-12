package app.hexodus.ios;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class ShareFilesTest {
    private static final byte[] PNG_HEAD = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 13};

    @Test
    public void keepsTheGamesOwnNames() {
        assertEquals("hex-sphere-cleared.png", ShareFiles.safeName("hex-sphere-cleared.png"));
        assertEquals("hex-sphere-run.png", ShareFiles.safeName("hex-sphere-run.png"));
    }

    @Test
    public void fallsBackWhenThereIsNoUsableName() {
        assertEquals("hexsweeper.png", ShareFiles.safeName(null));
        assertEquals("hexsweeper.png", ShareFiles.safeName(""));
        assertEquals("hexsweeper.png", ShareFiles.safeName("../.."));
        assertEquals("hexsweeper.png", ShareFiles.safeName(".png"));
    }

    @Test
    public void neverLeavesTheShareFolder() {
        assertEquals("passwd.png", ShareFiles.safeName("../../etc/passwd"));
        assertEquals("card.png", ShareFiles.safeName("C:\\Users\\me\\card.PNG"));
        assertEquals("hidden.png", ShareFiles.safeName("..hidden"));
        assertFalse(ShareFiles.safeName("a/b\\c d?.png").contains("/"));
        assertEquals("c-d-.png", ShareFiles.safeName("a/b\\c d?.png"));
    }

    @Test
    public void alwaysEndsInPngAndStaysShort() {
        assertEquals("card.jpg.png", ShareFiles.safeName("card.jpg"));
        String longName = ShareFiles.safeName(new String(new char[300]).replace('\0', 'a') + ".png");
        assertEquals(64, longName.length());
        assertTrue(longName.endsWith(".png"));
    }

    @Test
    public void acceptsOnlyPngData() {
        assertTrue(ShareFiles.isPng(PNG_HEAD));
        assertFalse(ShareFiles.isPng(null));
        assertFalse(ShareFiles.isPng(new byte[0]));
        assertFalse(ShareFiles.isPng(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}));
        assertFalse(ShareFiles.isPng("<html>not a picture</html>".getBytes()));
        byte[] huge = new byte[ShareFiles.MAX_BYTES + 1];
        System.arraycopy(PNG_HEAD, 0, huge, 0, PNG_HEAD.length);
        assertFalse(ShareFiles.isPng(huge));
    }
}
