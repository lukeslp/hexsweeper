package app.hexodus.ios;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Pure window-local bounds: the existing game receives one unobstructed rectangle. */
final class GameViewportBounds {
    private GameViewportBounds() {}

    static final class Box {
        final int left, top, right, bottom;

        Box(int left, int top, int right, int bottom) {
            this.left = left;
            this.top = top;
            this.right = right;
            this.bottom = bottom;
        }

        long area() {
            return (long) Math.max(0, right - left) * Math.max(0, bottom - top);
        }

        boolean overlaps(Box other) {
            return left < other.right && right > other.left
                && top < other.bottom && bottom > other.top;
        }
    }

    static Box fit(int width, int height, Box available, List<Box> reportedCutouts,
                   String manufacturer, String model) {
        List<Box> obstacles = new ArrayList<>();
        for (Box cutout : reportedCutouts) {
            // Samsung's compatibility frame can report cameras entirely outside its view.
            Box clipped = new Box(Math.max(0, cutout.left), Math.max(0, cutout.top),
                Math.min(width, cutout.right), Math.min(height, cutout.bottom));
            if (clipped.area() > 0) obstacles.add(clipped);
        }
        if (reportedCutouts.isEmpty() && isFullCover(width, height, manufacturer, model)) {
            // Physical SM-F776 evidence: camera strip begins at y=839 on a 948×1048
            // panel. One UI's full-panel resize mode reports no DisplayCutout.
            int cameraTop = (int) Math.floor(height * (839.0 / 1048.0));
            obstacles.add(new Box(0, cameraTop, width, height));
        }
        if (obstacles.isEmpty()) return available;

        List<Integer> lefts = new ArrayList<>(), tops = new ArrayList<>();
        List<Integer> rights = new ArrayList<>(), bottoms = new ArrayList<>();
        lefts.add(available.left);
        tops.add(available.top);
        rights.add(available.right);
        bottoms.add(available.bottom);
        for (Box obstacle : obstacles) {
            lefts.add(obstacle.right);
            tops.add(obstacle.bottom);
            rights.add(obstacle.left);
            bottoms.add(obstacle.top);
        }
        Box best = null;
        for (int l : lefts) for (int t : tops) for (int r : rights) for (int b : bottoms) {
            Box candidate = new Box(Math.max(available.left, l), Math.max(available.top, t),
                Math.min(available.right, r), Math.min(available.bottom, b));
            if (candidate.area() == 0) continue;
            boolean clear = true;
            for (Box obstacle : obstacles) {
                if (candidate.overlaps(obstacle)) {
                    clear = false;
                    break;
                }
            }
            if (clear && (best == null || candidate.area() > best.area())) best = candidate;
        }
        // A cutout covering the entire window has no playable rectangle. Avoid invalid
        // negative padding while the next window/insets update settles during folding.
        return best != null ? best : new Box(available.left, available.top,
            available.left, available.top);
    }

    private static boolean isFullCover(int width, int height, String manufacturer, String model) {
        if (!"samsung".equalsIgnoreCase(manufacturer) || model == null
            || width <= 0 || height <= width) return false;
        String normalized = model.toUpperCase(Locale.ROOT);
        if (!normalized.startsWith("SM-F766") && !normalized.startsWith("SM-F776")) return false;
        double expected = 948.0 / 1048.0;
        return Math.abs((double) width / height - expected) / expected <= 0.03;
    }
}
