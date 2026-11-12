package app.hexodus.ios;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The game is kept clear of the camera cutout, which leaves a strip of the
 * native window showing beside it. The page reports its background color here
 * whenever the theme changes, so that strip matches the theme instead of
 * staying one fixed color (a light band on dark themes in 1.0.6, a dark band
 * on light themes in the 1.0.9 candidate).
 */
@CapacitorPlugin(name = "HexBackdrop")
public class HexBackdropPlugin extends Plugin {
    @PluginMethod
    public void setColor(PluginCall call) {
        Integer color = BackdropColor.parse(call.getString("color"));
        if (color == null) {
            call.reject("Not a solid color");
            return;
        }
        if (getActivity() instanceof MainActivity) {
            MainActivity activity = (MainActivity) getActivity();
            activity.runOnUiThread(() -> activity.setBackdropColor(color));
        }
        call.resolve();
    }
}
