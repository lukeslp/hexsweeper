package app.hexodus.ios;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Hands the finished-board picture to Android's share sheet. The game already
 * calls {@code Capacitor.Plugins.HexShare.shareImage} (the iOS shell has had it
 * since 1.0); without an Android counterpart the Share button fell through to a
 * blob download, which a WebView ignores, so nothing happened.
 *
 * The picture is written to the app's own cache folder and offered through the
 * app's FileProvider with a read grant for the one app the player picks. No
 * permission is needed and nothing leaves the device unless the player sends it.
 */
@CapacitorPlugin(name = "HexShare")
public class HexSharePlugin extends Plugin {
    private static final String SHARE_DIR = "share";

    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("No image to share");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("The image could not be read");
            return;
        }
        if (!ShareFiles.isPng(bytes)) {
            call.reject("The image could not be read");
            return;
        }
        Context context = getContext();
        File dir = new File(context.getCacheDir(), SHARE_DIR);
        if (!dir.isDirectory() && !dir.mkdirs()) {
            call.reject("The image could not be saved");
            return;
        }
        // One card at a time: an earlier card has been sent or abandoned by now.
        File[] old = dir.listFiles();
        if (old != null) for (File file : old) file.delete();
        File file = new File(dir, ShareFiles.safeName(call.getString("filename")));
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        } catch (IOException e) {
            call.reject("The image could not be saved");
            return;
        }
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        Intent send = new Intent(Intent.ACTION_SEND)
            .setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        // The chooser's preview reads the picture through ClipData.
        send.setClipData(ClipData.newRawUri(null, uri));
        try {
            getActivity().startActivity(Intent.createChooser(send, null));
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("Sharing is not available on this device");
        }
    }
}
