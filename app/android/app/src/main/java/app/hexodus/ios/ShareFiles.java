package app.hexodus.ios;

/** Pure checks for the finished-board picture the game hands to the share sheet. */
final class ShareFiles {
    /** The card is a 1080 px PNG well under a megabyte; refuse anything far past that. */
    static final int MAX_BYTES = 8 * 1024 * 1024;
    static final String DEFAULT_NAME = "hexsweeper.png";

    private static final byte[] PNG_SIGNATURE = {
        (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'
    };

    private ShareFiles() {}

    /** A plain file name ending in .png: no folders, no leading dots, no odd characters. */
    static String safeName(String requested) {
        if (requested == null) return DEFAULT_NAME;
        String name = requested.substring(Math.max(requested.lastIndexOf('/'), requested.lastIndexOf('\\')) + 1);
        name = name.replaceAll("[^A-Za-z0-9._-]", "-");
        if (name.toLowerCase(java.util.Locale.ROOT).endsWith(".png")) {
            name = name.substring(0, name.length() - 4);
        }
        name = name.replaceAll("^[.-]+", "");
        if (name.length() > 60) name = name.substring(0, 60);
        return name.isEmpty() ? DEFAULT_NAME : name + ".png";
    }

    static boolean isPng(byte[] bytes) {
        if (bytes == null || bytes.length <= PNG_SIGNATURE.length || bytes.length > MAX_BYTES) return false;
        for (int i = 0; i < PNG_SIGNATURE.length; i++) {
            if (bytes[i] != PNG_SIGNATURE[i]) return false;
        }
        return true;
    }
}
