package app.hexodus.ios;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads the page's CSS background color so the strip around a camera cutout can match it. */
final class BackdropColor {
    private static final Pattern RGB = Pattern.compile(
        "^rgba?\\(\\s*(\\d{1,3})\\s*[, ]\\s*(\\d{1,3})\\s*[, ]\\s*(\\d{1,3})\\s*(?:[,/]\\s*([0-9.]+%?)\\s*)?\\)$");
    private static final Pattern HEX = Pattern.compile("^#([0-9a-fA-F]{6})$");

    private BackdropColor() {}

    /** An opaque ARGB color, or null when the text is not a solid color this app would paint. */
    static Integer parse(String css) {
        if (css == null) return null;
        String text = css.trim();
        Matcher hex = HEX.matcher(text);
        if (hex.matches()) return 0xff000000 | Integer.parseInt(hex.group(1), 16);
        Matcher rgb = RGB.matcher(text);
        if (!rgb.matches()) return null;
        int r = Integer.parseInt(rgb.group(1)), g = Integer.parseInt(rgb.group(2)), b = Integer.parseInt(rgb.group(3));
        if (r > 255 || g > 255 || b > 255) return null;
        String alpha = rgb.group(4);
        // A see-through page background says nothing about what is on screen.
        if (alpha != null && !alpha.equals("1") && !alpha.equals("1.0") && !alpha.equals("100%")) return null;
        return 0xff000000 | (r << 16) | (g << 8) | b;
    }
}
