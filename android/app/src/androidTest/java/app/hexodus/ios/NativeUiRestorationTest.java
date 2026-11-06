package app.hexodus.ios;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.os.Bundle;
import org.junit.Test;
import org.junit.runner.RunWith;
@RunWith(AndroidJUnit4.class)
public class NativeUiRestorationTest {
    @Test public void recreationRestoresNativeFocusAndLaterDocumentWriters() throws Exception {
        Bundle receipt = new Bundle();
        receipt.putString("nativeUiReceipt", NativeUiRestorationChecks.run(InstrumentationRegistry.getInstrumentation(), InstrumentationRegistry.getArguments()).toString());
        InstrumentationRegistry.getInstrumentation().sendStatus(0, receipt);
    }
}
